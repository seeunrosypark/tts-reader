import { useEffect } from "react";

export type Toast = {
  id: number;
  icon: string;
  title: string;
  detail?: string;
  /** 목표 달성·장 완료처럼 큰 순간에는 색종이를 터뜨린다. */
  celebrate?: boolean;
};

const TOAST_DURATION_MS = 4500;
const CONFETTI_COUNT = 14;

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [onDismiss, toast.id]);

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
