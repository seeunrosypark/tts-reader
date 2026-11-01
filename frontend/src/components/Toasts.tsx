import { useEffect } from "react";

export type Toast = {
  id: number;
  icon: string;
  title: string;
  detail?: string;
  /** 목표 달성·장 완료처럼 큰 순간에는 색종이를 터뜨린다. */
  celebrate?: boolean;
  action?: { label: string; onClick: () => void };
};

const TOAST_DURATION_MS = 4500;
// 버튼이 있는 알림은 누를 시간을 넉넉히 준다.
const ACTION_TOAST_DURATION_MS = 10000;
const CONFETTI_COUNT = 14;

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const duration = toast.action ? ACTION_TOAST_DURATION_MS : TOAST_DURATION_MS;
    const timer = window.setTimeout(() => onDismiss(toast.id), duration);
    return () => window.clearTimeout(timer);
  }, [onDismiss, toast.action, toast.id]);

  return (
    <div className="toast" role="status" onClick={() => onDismiss(toast.id)}>
      {toast.celebrate && (
        <div className="confetti" aria-hidden="true">
          {Array.from({ length: CONFETTI_COUNT }, (_, index) => (
            <span key={index} style={{ "--i": index } as React.CSSProperties} />
          ))}
        </div>
      )}
      <span className="toast-icon" aria-hidden="true">
        {toast.icon}
      </span>
      <div className="toast-body">
        <p className="toast-title">{toast.title}</p>
        {toast.detail && <p className="toast-detail">{toast.detail}</p>}
      </div>
      {toast.action && (
        <button
          type="button"
          className="toast-action"
          onClick={(event) => {
            event.stopPropagation();
            toast.action!.onClick();
            onDismiss(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
