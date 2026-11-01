export type QuizQuestion = {
  question: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
};

export type Quiz = { questions: QuizQuestion[] };

/** 백엔드가 Claude로 장 본문에서 4지선다 퀴즈를 만든다. 실패하면 보여 줄 수 있는 메시지로 던진다. */
export async function generateQuiz(title: string, text: string, signal?: AbortSignal): Promise<Quiz> {
  let response: Response;
  try {
    response = await fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, text }),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new Error("서버에 연결하지 못했습니다. 백엔드가 켜져 있는지 확인해 주세요.");
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: unknown } | null;
    throw new Error(
      typeof body?.detail === "string" ? body.detail : `퀴즈를 만들지 못했습니다 (${response.status}).`,
    );
  }
  return response.json();
}
