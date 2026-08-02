import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  forwardRef,
} from "react";

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
};

function reapplyHighlight(
  container: HTMLElement,
  highlightedIndex: number | null,
): void {
  container.querySelectorAll(".sentence.active").forEach((element) => {
    element.classList.remove("active");
  });

  if (highlightedIndex === null) {
    return;
  }

  const target = container.querySelector(
    `.sentence[data-index="${highlightedIndex}"]`,
  );
  if (!target) {
    return;
  }

  target.classList.add("active");
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

  return Boolean(node?.closest("pre, code"));
}

function getPlainTextOffset(
  container: HTMLElement,
  targetNode: Node,
  targetOffset: number,
): number {
  let offset = 0;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.parentElement?.closest("pre, code")) {
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
  function MarkdownViewer({ html, highlightedIndex }, ref) {
    const containerRef = useRef<HTMLElement>(null);
    const highlightedIndexRef = useRef(highlightedIndex);

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
    }, [html]);

    useLayoutEffect(() => {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      reapplyHighlight(container, highlightedIndex);
    }, [highlightedIndex]);

    useImperativeHandle(ref, () => ({
      scrollToHeading(id: string) {
        const container = containerRef.current;
        if (!container) {
          return;
        }
        const target = container.querySelector(`#${CSS.escape(id)}`);
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
