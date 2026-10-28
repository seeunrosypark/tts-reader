import { useEffect, type RefObject } from "react";

/** 열린 팝오버를 바깥 클릭이나 Escape로 닫는다. */
export function useDismiss(
  refs: RefObject<HTMLElement | null>[],
  isOpen: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (refs.some((ref) => ref.current?.contains(target))) {
        return;
      }
      onClose();
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
    // refs 배열은 매 렌더 새로 만들어지지만 담긴 ref 객체는 그대로라 의존성에서 뺀다.
  }, [isOpen, onClose]);
}
