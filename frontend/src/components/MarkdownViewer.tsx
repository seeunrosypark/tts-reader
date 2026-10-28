import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  forwardRef,
} from "react";

import { NON_PROSE_SELECTOR, renderMermaidBlocks } from "../utils/renderMermaid";

export type SelectionPlainRange = {
  start: number;
  end: number;
  text: string;
};

export type MarkdownViewerHandle = {
  scrollToHeading: (id: string) => void;
  getSelectionPlainRange: () => SelectionPlainRange | null;
  getSelectionSentenceIndex: () => number | null;
};

type MarkdownViewerProps = {
  html: string;
  highlightedIndex: number | null;
  onSentenceClick?: (index: number) => void;
};

// 사용자가 직접 스크롤한 뒤 이 시간 동안은 하이라이트를 따라가지 않는다.
const FOLLOW_PAUSE_AFTER_USER_SCROLL_MS = 5000;
const SCROLL_KEYS = new Set(["PageUp", "PageDown", "ArrowUp", "ArrowDown", "Home", "End"]);

function readCssPixels(name: string): number {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
}

/** 상단 바와 하단 플레이어에 가려지지 않는 영역 밖에 있으면 화면 가운데로 스크롤한다. */
function followHighlight(target: Element): void {
  const rect = target.getBoundingClientRect();
  const visibleTop = readCssPixels("--top-bar-height");
  const visibleBottom = window.innerHeight - readCssPixels("--player-height");
  if (rect.top >= visibleTop && rect.bottom <= visibleBottom) {
    return;
  }
  target.scrollIntoView({ behavior: "smooth", block: "center" });
}

function reapplyHighlight(
  container: HTMLElement,
  highlightedIndex: number | null,
): Element | null {
  container.querySelectorAll(".sentence.active").forEach((element) => {
    element.classList.remove("active");
  });

  if (highlightedIndex === null) {
    return null;
  }

  const target = container.querySelector(
    `.sentence[data-index="${highlightedIndex}"]`,
  );
  target?.classList.add("active");
  return target;
}

function isSelectionInContainer(
  container: HTMLElement,
  selection: Selection,
): boolean {
  if (selection.rangeCount === 0 || selection.isCollapsed) {
    return false;
  }

  const range = selection.getRangeAt(0);
  return container.contains(range.commonAncestorContainer);
}

function isSelectionInCodeBlock(range: Range): boolean {
  const node =
    range.commonAncestorContainer.nodeType === Node.TEXT_NODE
      ? range.commonAncestorContainer.parentElement
      : (range.commonAncestorContainer as Element);

  return Boolean(node?.closest(NON_PROSE_SELECTOR));
}

function getPlainTextOffset(
  container: HTMLElement,
  targetNode: Node,
  targetOffset: number,
): number {
  let offset = 0;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.parentElement?.closest(NON_PROSE_SELECTOR)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let current = walker.nextNode();
  while (current) {
    if (current === targetNode) {
      return offset + targetOffset;
    }
    offset += current.textContent?.length ?? 0;
    current = walker.nextNode();
  }

  return offset;
}

function getSelectionPlainRangeFromDom(
  container: HTMLElement,
  selection: Selection,
): SelectionPlainRange | null {
  const range = selection.getRangeAt(0);
  const text = range.toString();
  if (!text.trim()) {
    return null;
  }

  const start = getPlainTextOffset(
    container,
    range.startContainer,
    range.startOffset,
  );
  const end = getPlainTextOffset(container, range.endContainer, range.endOffset);

  if (end <= start) {
    return null;
  }

  return { start, end, text };
}

function getSentenceIndexFromRange(container: HTMLElement, range: Range): number | null {
  const startNode =
    range.startContainer.nodeType === Node.TEXT_NODE
      ? range.startContainer.parentElement
      : (range.startContainer as Element);

  const sentenceElement = startNode?.closest(
    '.sentence[data-index]:not([data-skip="true"])',
  );
  if (!sentenceElement || !container.contains(sentenceElement)) {
    return null;
  }

  const index = Number(sentenceElement.getAttribute("data-index"));
  return Number.isFinite(index) ? index : null;
}

export const MarkdownViewer = forwardRef<MarkdownViewerHandle, MarkdownViewerProps>(
  function MarkdownViewer({ html, highlightedIndex, onSentenceClick }, ref) {
    const containerRef = useRef<HTMLElement>(null);
    const highlightedIndexRef = useRef(highlightedIndex);
    const onSentenceClickRef = useRef(onSentenceClick);
    // 이 시각 전까지는 하이라이트 자동 스크롤을 쉰다 (직접 스크롤, 목차 이동).
    const followPausedUntilRef = useRef(0);

    useEffect(() => {
      const pauseFollow = () => {
        followPausedUntilRef.current = Date.now() + FOLLOW_PAUSE_AFTER_USER_SCROLL_MS;
      };
      const handleKey = (event: KeyboardEvent) => {
        if (SCROLL_KEYS.has(event.key)) {
          pauseFollow();
        }
      };
      window.addEventListener("wheel", pauseFollow, { passive: true });
      window.addEventListener("touchmove", pauseFollow, { passive: true });
      window.addEventListener("keydown", handleKey);
      return () => {
        window.removeEventListener("wheel", pauseFollow);
        window.removeEventListener("touchmove", pauseFollow);
        window.removeEventListener("keydown", handleKey);
      };
    }, []);

    useEffect(() => {
      onSentenceClickRef.current = onSentenceClick;
    }, [onSentenceClick]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const handleClick = (event: MouseEvent) => {
        // 드래그 선택은 Ctrl+B·선택 재생용이므로 이동으로 처리하지 않는다.
        if (!window.getSelection()?.isCollapsed) {
          return;
        }
        const target = event.target as Element | null;
        if (!target || target.closest(`a, ${NON_PROSE_SELECTOR}`)) {
          return;
        }
        const sentenceElement = target.closest(
          '.sentence[data-index]:not([data-skip="true"])',
        );
        const index = Number(sentenceElement?.getAttribute("data-index"));
        if (sentenceElement && Number.isFinite(index)) {
          onSentenceClickRef.current?.(index);
        }
      };

      container.addEventListener("click", handleClick);
      return () => container.removeEventListener("click", handleClick);
    }, []);

    useEffect(() => {
      highlightedIndexRef.current = highlightedIndex;
    }, [highlightedIndex]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      container.innerHTML = html;
      reapplyHighlight(container, highlightedIndexRef.current);

      let isStale = false;
      renderMermaidBlocks(container, () => isStale).catch((error) => {
        console.error("mermaid 렌더링 실패", error);
      });
      return () => {
        isStale = true;
      };
    }, [html]);

    useLayoutEffect(() => {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      const target = reapplyHighlight(container, highlightedIndex);
      if (target && Date.now() >= followPausedUntilRef.current) {
        followHighlight(target);
      }
    }, [highlightedIndex]);

    useImperativeHandle(ref, () => ({
      scrollToHeading(id: string) {
        const container = containerRef.current;
        if (!container) {
          return;
        }
        const target = container.querySelector(`#${CSS.escape(id)}`);
        // 제목으로 스크롤하는 동안 첫 문장 하이라이트가 스크롤을 덮어쓰지 않게 한다.
        followPausedUntilRef.current = Date.now() + 1000;
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      },
      getSelectionPlainRange() {
        const container = containerRef.current;
        const selection = window.getSelection();
        if (!container || !selection || !isSelectionInContainer(container, selection)) {
          return null;
        }

        const range = selection.getRangeAt(0).cloneRange();
        if (isSelectionInCodeBlock(range)) {
          return null;
        }

        return getSelectionPlainRangeFromDom(container, selection);
      },
      getSelectionSentenceIndex() {
        const container = containerRef.current;
        const selection = window.getSelection();
        if (!container || !selection || !isSelectionInContainer(container, selection)) {
          return null;
        }

        const range = selection.getRangeAt(0).cloneRange();
        if (isSelectionInCodeBlock(range)) {
          return null;
        }

        return getSentenceIndexFromRange(container, range);
      },
    }));

    return <article ref={containerRef} className="markdown-viewer" />;
  },
);
