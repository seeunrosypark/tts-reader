import type { Sentence } from "./sentenceSplitter";

function collectTextNodes(root: HTMLElement): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (parent?.closest("pre, code")) {
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

function wrapOffsetRange(
  root: HTMLElement,
  start: number,
  end: number,
  sentenceIndex: number,
): void {
  const textNodes = collectTextNodes(root);
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
): void {
  const playable = sentences.filter((sentence) => !sentence.skip);
  if (playable.length === 0) {
    return;
  }

  let searchFrom = 0;

  for (const sentence of playable) {
    const textNodes = collectTextNodes(element);
    const fullText = textNodes.map((node) => node.textContent ?? "").join("");
    const start = findSentenceStart(fullText, sentence.text, searchFrom);
    if (start === -1) {
      continue;
    }

    const end = start + sentence.text.length;
    wrapOffsetRange(element, start, end, sentence.index);
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
