import type { Mermaid } from "mermaid";

const MERMAID_BLOCK_SELECTOR = 'pre.code-block[data-lang="mermaid"]';

export const DIAGRAM_CLASS = "mermaid-diagram";

/** 문장·선택 계산에서 빼야 하는 영역 (코드 블록과 그 자리에 그린 다이어그램). */
export const NON_PROSE_SELECTOR = `pre, code, .${DIAGRAM_CLASS}`;

let mermaidPromise: Promise<Mermaid> | null = null;
let renderCount = 0;

// mermaid는 용량이 커서 다이어그램이 있는 문서를 열 때만 불러온다.
function loadMermaid(): Promise<Mermaid> {
  mermaidPromise ??= import("mermaid").then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      suppressErrorRendering: true,
    });
    return mermaid;
  });
  return mermaidPromise;
}

/** ```mermaid 코드 블록을 SVG 다이어그램으로 바꾼다. 문법 오류인 블록은 코드 그대로 두고 표시만 한다. */
export async function renderMermaidBlocks(
  container: HTMLElement,
  isStale: () => boolean,
): Promise<void> {
  const blocks = Array.from(
    container.querySelectorAll<HTMLElement>(MERMAID_BLOCK_SELECTOR),
  );
  if (blocks.length === 0) {
    return;
  }

  const mermaid = await loadMermaid();

  for (const pre of blocks) {
    if (isStale()) {
      return;
    }

    const id = `mermaid-${++renderCount}`;
    try {
      const { svg } = await mermaid.render(id, pre.textContent ?? "");
      if (isStale()) {
        return;
      }
      const figure = document.createElement("figure");
      figure.className = DIAGRAM_CLASS;
      figure.innerHTML = svg;
      pre.replaceWith(figure);
    } catch (error) {
      document.getElementById(`d${id}`)?.remove();
      pre.classList.add("mermaid-error");
      pre.setAttribute(
        "data-lang",
        `mermaid · 그릴 수 없음: ${error instanceof Error ? error.message.split("\n")[0] : "문법 오류"}`,
      );
    }
  }
}
