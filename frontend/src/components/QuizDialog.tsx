import { useRef, useState } from "react";

import type { Quiz } from "../api/quizClient";
import { useDismiss } from "../hooks/useDismiss";
import type { QuizRecord } from "../utils/readingStats";

export type QuizState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; quiz: Quiz };

type QuizDialogProps = {
  chapterTitle: string;
  state: QuizState;
  bestRecord: QuizRecord | undefined;
  onSubmit: (correct: number, total: number) => void;
  onRegenerate: () => void;
  onClose: () => void;
};

export function QuizDialog({
  chapterTitle,
  state,
  bestRecord,
  onSubmit,
  onRegenerate,
  onClose,
}: QuizDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDismiss([panelRef], true, onClose);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [isGraded, setIsGraded] = useState(false);
  const [quizKey, setQuizKey] = useState<Quiz | null>(null);

  const quiz = state.status === "ready" ? state.quiz : null;
  // 새 문제가 오면 답안을 비운다.
  if (quiz !== quizKey) {
    setQuizKey(quiz);
    setAnswers(quiz ? quiz.questions.map(() => null) : []);
    setIsGraded(false);
  }

  const correctCount = quiz
    ? quiz.questions.filter((question, index) => answers[index] === question.answerIndex).length
    : 0;
  const allAnswered = answers.length > 0 && answers.every((answer) => answer !== null);

  const grade = () => {
    if (!quiz) {
      return;
    }
    setIsGraded(true);
    onSubmit(correctCount, quiz.questions.length);
  };

  return (
    <div className="dialog-backdrop">
      <div
        ref={panelRef}
        className="stats-dialog quiz-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${chapterTitle} 퀴즈`}
      >
        <header className="stats-dialog-header">
          <h2>
            🧠 {chapterTitle}
            {bestRecord && (
              <small className="quiz-best">
                최고 {bestRecord.best}/{bestRecord.total}
              </small>
            )}
          </h2>
          <button type="button" className="icon-button" aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </header>

        {state.status === "loading" && (
          <p className="quiz-status">
            <span className="quiz-spinner" aria-hidden="true" />
            AI가 이 장의 본문으로 문제를 만들고 있어요…
          </p>
        )}

        {state.status === "error" && (
          <div className="quiz-status is-error" role="alert">
            <p>{state.message}</p>
            <button type="button" className="primary-button" onClick={onRegenerate}>
              다시 시도
            </button>
          </div>
        )}

        {quiz && (
          <>
            <ol className="quiz-list">
              {quiz.questions.map((question, questionIndex) => (
                <li key={questionIndex} className="quiz-question">
                  <p className="quiz-question-text">{question.question}</p>
                  <div className="quiz-choices" role="radiogroup">
                    {question.choices.map((choice, choiceIndex) => {
                      const isPicked = answers[questionIndex] === choiceIndex;
                      const isAnswer = question.answerIndex === choiceIndex;
                      const result = isGraded ? (isAnswer ? " is-correct" : isPicked ? " is-wrong" : "") : "";
                      return (
                        <button
                          key={choiceIndex}
                          type="button"
                          role="radio"
                          aria-checked={isPicked}
                          disabled={isGraded}
                          className={`quiz-choice${isPicked ? " is-picked" : ""}${result}`}
                          onClick={() =>
                            setAnswers((current) =>
                              current.map((answer, index) => (index === questionIndex ? choiceIndex : answer)),
                            )
                          }
                        >
                          <span className="quiz-choice-mark" aria-hidden="true">
                            {"①②③④⑤⑥"[choiceIndex] ?? choiceIndex + 1}
                          </span>
                          {choice}
                        </button>
                      );
                    })}
                  </div>
                  {isGraded && <p className="quiz-explanation">{question.explanation}</p>}
                </li>
              ))}
            </ol>

            <footer className="quiz-footer">
              {isGraded ? (
                <>
                  <p className="quiz-score">
                    {correctCount === quiz.questions.length
                      ? `만점! ${correctCount}/${quiz.questions.length} 🎉`
                      : `${correctCount}/${quiz.questions.length} 정답`}
                  </p>
                  <button type="button" onClick={() => setQuizKey(null)}>
                    다시 풀기
                  </button>
                  <button type="button" className="primary-button" onClick={onRegenerate}>
                    새 문제 만들기
                  </button>
                </>
              ) : (
                <>
                  <p className="quiz-score">
                    {answers.filter((answer) => answer !== null).length}/{quiz.questions.length} 답함
                  </p>
                  <button type="button" className="primary-button" disabled={!allAnswered} onClick={grade}>
                    채점하기
                  </button>
                </>
              )}
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
