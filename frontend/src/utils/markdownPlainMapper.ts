export type MarkdownPlainMapper = {
  plainText: string;
  toMarkdownRange: (plainStart: number, plainEnd: number) => {
    mdStart: number;
    mdEnd: number;
  };
};

export function createMarkdownPlainMapper(markdown: string): MarkdownPlainMapper {
  const toMarkdown: number[] = [];
  let plainText = "";

  let index = 0;
  while (index < markdown.length) {
    if (markdown.startsWith("```", index)) {
      const close = markdown.indexOf("```", index + 3);
      index = close === -1 ? markdown.length : close + 3;
      while (index < markdown.length && markdown[index] !== "\n") {
        index += 1;
      }
      if (index < markdown.length) {
        index += 1;
      }
      continue;
    }

    if (markdown[index] === "`") {
      const close = markdown.indexOf("`", index + 1);
      if (close !== -1) {
        index = close + 1;
        continue;
      }
    }

    if (markdown.startsWith("**", index) || markdown.startsWith("__", index)) {
      index += 2;
      continue;
    }

    if (markdown[index] === "*" || markdown[index] === "_") {
      index += 1;
      continue;
    }

    if (markdown[index] === "[") {
      const closeBracket = markdown.indexOf("]", index);
      if (closeBracket !== -1 && markdown[closeBracket + 1] === "(") {
        for (let charIndex = index + 1; charIndex < closeBracket; charIndex += 1) {
          appendPlainChar(markdown, charIndex, toMarkdown, (char) => {
            plainText += char;
          });
        }
        const closeParen = markdown.indexOf(")", closeBracket + 2);
        index = closeParen === -1 ? closeBracket + 1 : closeParen + 1;
        continue;
      }
    }

    if (markdown[index] === "!") {
      index += 1;
      continue;
    }

    const lineStart = index === 0 || markdown[index - 1] === "\n";
    if (lineStart && markdown[index] === "#") {
      while (index < markdown.length && markdown[index] === "#") {
        index += 1;
      }
      if (markdown[index] === " ") {
        index += 1;
      }
      continue;
    }

    if (lineStart && markdown[index] === ">") {
      index += 1;
      if (markdown[index] === " ") {
        index += 1;
      }
      continue;
    }

    appendPlainChar(markdown, index, toMarkdown, (char) => {
      plainText += char;
    });
    index += 1;
  }

  return {
    plainText,
    toMarkdownRange(plainStart: number, plainEnd: number) {
      if (plainStart >= plainEnd || plainStart < 0 || plainEnd > toMarkdown.length) {
        return { mdStart: 0, mdEnd: 0 };
      }

      return {
        mdStart: toMarkdown[plainStart] ?? 0,
        mdEnd: (toMarkdown[plainEnd - 1] ?? markdown.length - 1) + 1,
      };
    },
  };
}

function appendPlainChar(
  markdown: string,
  index: number,
  toMarkdown: number[],
  append: (char: string) => void,
): void {
  const char = markdown[index];
  append(char);
  toMarkdown.push(index);
}

export function findPlainRangeForSelection(
  plainText: string,
  selectedText: string,
  hintStart: number,
): { start: number; end: number } | null {
  const normalizedSelected = selectedText.replace(/\s+/g, " ").trim();
  if (!normalizedSelected) {
    return null;
  }

  const searchWindowStart = Math.max(0, hintStart - 200);
  const searchWindowEnd = Math.min(plainText.length, hintStart + 200);
  const windowText = plainText.slice(searchWindowStart, searchWindowEnd);
  const localIndex = windowText.indexOf(normalizedSelected);

  if (localIndex !== -1) {
    const start = searchWindowStart + localIndex;
    return { start, end: start + normalizedSelected.length };
  }

  const globalIndex = plainText.indexOf(normalizedSelected);
  if (globalIndex !== -1) {
    return {
      start: globalIndex,
      end: globalIndex + normalizedSelected.length,
    };
  }

  return null;
}
