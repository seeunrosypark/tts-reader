import json
from typing import Optional

import anthropic
from pydantic import BaseModel, ValidationError

MODEL = "claude-opus-5-5"
FALLBACK_BETA = "server-side-fallback-2026-07-01"

SYSTEM_PROMPT = """당신은 책의 한 장을 정독했는지 확인하는 퀴즈 출제자입니다.
주어진 장의 본문만 근거로 4지선다 문제를 만듭니다.

- 본문을 꼼꼼히 읽었다면 맞힐 수 있고, 훑어보거나 제목만 봤다면 헷갈리는 문제를 냅니다.
  핵심 개념, 이유와 근거, 비교·트레이드오프, 수치나 순서처럼 본문에 분명히 나온 내용을 고루 다룹니다.
- 상식이나 본문 밖 지식만으로 풀리는 문제, 말장난, 본문에 없는 내용은 내지 않습니다.
- 오답 보기는 그럴듯해야 하지만 본문 기준으로 분명히 틀려야 합니다. 정답 위치는 고르게 섞습니다.
- 해설에는 정답의 근거를 본문 내용으로 한두 문장 적습니다.
- 본문과 같은 언어(보통 한국어)로 씁니다."""

QUIZ_SCHEMA = {
    "type": "object",
    "properties": {
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "choices": {"type": "array", "items": {"type": "string"}},
                    "answerIndex": {"type": "integer"},
                    "explanation": {"type": "string"},
                },
                "required": ["question", "choices", "answerIndex", "explanation"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["questions"],
    "additionalProperties": False,
}


class QuizQuestion(BaseModel):
    question: str
    choices: list[str]
    answerIndex: int
    explanation: str


class Quiz(BaseModel):
    questions: list[QuizQuestion]


class QuizError(Exception):
    """사용자에게 그대로 보여 줄 수 있는 퀴즈 생성 실패."""

    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


NO_KEY_MESSAGE = "Claude API 키가 없습니다. ANTHROPIC_API_KEY를 설정하고 서버를 다시 켜 주세요."

_client: Optional[anthropic.AsyncAnthropic] = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic()
    return _client


def _valid_questions(quiz: Quiz) -> list[QuizQuestion]:
    return [
        question
        for question in quiz.questions
        if len(question.choices) >= 2 and 0 <= question.answerIndex < len(question.choices)
    ]


async def generate_quiz(title: str, text: str, count: int) -> Quiz:
    client = _get_client()
    prompt = f"""<chapter title="{title}">
{text}
</chapter>

위 장의 본문으로 4지선다 문제 {count}개를 만들어 주세요."""

    try:
        response = await client.beta.messages.create(
            model=MODEL,
            max_tokens=16000,
            betas=[FALLBACK_BETA],
            fallbacks="default",
            system=SYSTEM_PROMPT,
            output_config={
                "effort": "medium",
                "format": {"type": "json_schema", "schema": QUIZ_SCHEMA},
            },
            messages=[{"role": "user", "content": prompt}],
        )
    except TypeError as exc:
        # 키·토큰·로그인 프로필이 하나도 없으면 SDK가 요청 시점에 TypeError를 낸다.
        raise QuizError(503, NO_KEY_MESSAGE) from exc
    except anthropic.AuthenticationError as exc:
        raise QuizError(503, "Claude API 키가 올바르지 않습니다. ANTHROPIC_API_KEY를 확인해 주세요.") from exc
    except anthropic.PermissionDeniedError as exc:
        raise QuizError(503, "이 API 키로는 Claude 모델을 쓸 수 없습니다.") from exc
    except anthropic.RateLimitError as exc:
        raise QuizError(429, "요청이 많아 잠시 막혔습니다. 조금 뒤에 다시 시도해 주세요.") from exc
    except anthropic.BadRequestError as exc:
        raise QuizError(400, f"퀴즈 요청이 거절되었습니다: {exc.message}") from exc
    except anthropic.APIStatusError as exc:
        raise QuizError(502, f"Claude API 오류 ({exc.status_code}). 잠시 뒤 다시 시도해 주세요.") from exc
    except anthropic.APIConnectionError as exc:
        raise QuizError(502, "Claude API에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.") from exc

    if response.stop_reason == "refusal":
        raise QuizError(422, "이 장으로는 퀴즈를 만들 수 없다고 응답했습니다.")
    if response.stop_reason == "max_tokens":
        raise QuizError(502, "퀴즈가 너무 길어 중간에 끊겼습니다. 다시 시도해 주세요.")

    raw = next((block.text for block in response.content if block.type == "text"), "")
    try:
        quiz = Quiz.model_validate(json.loads(raw))
    except (json.JSONDecodeError, ValidationError) as exc:
        raise QuizError(502, "퀴즈 형식이 올바르지 않습니다. 다시 시도해 주세요.") from exc

    questions = _valid_questions(quiz)
    if not questions:
        raise QuizError(502, "쓸 수 있는 문제가 없습니다. 다시 시도해 주세요.")
    return Quiz(questions=questions)
