import { useEffect } from "react";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

type UseKeyboardShortcutsOptions = {
  onPlayToggle: () => void;
  onBoldSelection: () => void;
};

export function useKeyboardShortcuts({
  onPlayToggle,
  onBoldSelection,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        onPlayToggle();
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        onBoldSelection();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onBoldSelection, onPlayToggle]);
}
