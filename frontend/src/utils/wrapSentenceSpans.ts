import type { Sentence } from "./sentenceSplitter";

/**
 * 블록이 직접 가진 글자 노드. 코드 블록(pre)과, 안쪽에 있는 다른 블록(인용 안의 문단,
 * 목록 안의 하위 목록 등)의 글자는 뺀다. 안쪽 블록은 따로 처리하므로 여기서 세면 두 번 읽는다.
 * 인라인 code는 문장의 일부이므로 포함한다.
 */
function collectTextNodes(root: HTMLElement, blockSelector: string): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest("pre") || parent.closest(blockSelector) !== root) {
        return NodeFilter.FILTER_REJECT;
      }
      return node.textContent?.length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }

  return nodes;
}

function buildOffsetMap(textNodes: Text[]) {
  let offset = 0;
  return textNodes.map((node) => {
    const length = node.textContent?.length ?? 0;
    const entry = { node, start: offset, end: offset + length };
    offset += length;
    return entry;
  });
}

function findSentenceStart(fullText: string, sentence: string, fromIndex: number): number {
  const exact = fullText.indexOf(sentence, fromIndex);
  if (exact !== -1) {
    return exact;
  }

  const collapsedFull = fullText.slice(fromIndex).replace(/\s+/g, " ");
  const collapsedSentence = sentence.replace(/\s+/g, " ");
  const collapsedIndex = collapsedFull.indexOf(collapsedSentence);
  if (collapsedIndex === -1) {
    return -1;
  }

  let rawIndex = fromIndex;
  let collapsedOffset = 0;
  while (collapsedOffset < collapsedIndex && rawIndex < fullText.length) {
    if (/\s/.test(fullText[rawIndex]) && /\s/.test(fullText[rawIndex + 1] ?? "")) {
      rawIndex += 1;
      continue;
    }
    rawIndex += 1;
    collapsedOffset += 1;
  }

  return rawIndex;
}

/** 블록이 직접 가진 글자 (안쪽 블록 제외). */
export function getOwnText(element: HTMLElement, blockSelector: string): string {
  return collectTextNodes(element, blockSelector)
    .map((node) => node.textContent ?? "")
    .join("");
}

function wrapOffsetRange(
  root: HTMLElement,
  blockSelector: string,
  start: number,
  end: number,
  sentenceIndex: number,
): void {
  const textNodes = collectTextNodes(root, blockSelector);
  const map = buildOffsetMap(textNodes);

  for (const entry of map) {
    if (entry.end <= start || entry.start >= end) {
      continue;
    }

    const localStart = Math.max(start, entry.start) - entry.start;
    const localEnd = Math.min(end, entry.end) - entry.start;
    const text = entry.node.textContent ?? "";
    const parent = entry.node.parentNode;
    if (!parent) {
      continue;
    }

    const fragment = document.createDocumentFragment();

    if (localStart > 0) {
      fragment.appendChild(document.createTextNode(text.slice(0, localStart)));
    }

    const span = document.createElement("span");
    span.className = "sentence";
    span.dataset.index = String(sentenceIndex);
    span.textContent = text.slice(localStart, localEnd);
    fragment.appendChild(span);

    if (localEnd < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(localEnd)));
    }

    parent.replaceChild(fragment, entry.node);
  }
}

export function wrapSentencesInElement(
  element: HTMLElement,
  sentences: Sentence[],
  blockSelector: string,
): void {
  const playable = sentences.filter((sentence) => !sentence.skip);
  if (playable.length === 0) {
    return;
  }

  let searchFrom = 0;

  for (const sentence of playable) {
    const textNodes = collectTextNodes(element, blockSelector);
    const fullText = textNodes.map((node) => node.textContent ?? "").join("");
    const start = findSentenceStart(fullText, sentence.text, searchFrom);
    if (start === -1) {
      continue;
    }

    const end = start + sentence.text.length;
    wrapOffsetRange(element, blockSelector, start, end, sentence.index);
    searchFrom = end;
  }
}

export function enhanceCodeBlocks(root: ParentNode): void {
  root.querySelectorAll("pre").forEach((pre) => {
    pre.classList.add("code-block");
    const code = pre.querySelector("code");
    if (!code) {
      return;
    }

    const langClass = Array.from(code.classList).find((className) =>
      className.startsWith("language-"),
    );
    if (langClass) {
      pre.setAttribute("data-lang", langClass.replace("language-", ""));
    }
  });
}
