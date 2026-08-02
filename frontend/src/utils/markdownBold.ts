export function toggleBoldInMarkdown(
  markdown: string,
  mdStart: number,
  mdEnd: number,
): string {
  if (mdStart < 0 || mdEnd <= mdStart || mdEnd > markdown.length) {
    return markdown;
  }

  const before = markdown.slice(Math.max(0, mdStart - 2), mdStart);
  const after = markdown.slice(mdEnd, mdEnd + 2);

  if (before === "**" && after === "**") {
    return (
      markdown.slice(0, mdStart - 2) +
      markdown.slice(mdStart, mdEnd) +
      markdown.slice(mdEnd + 2)
    );
  }

  return (
    markdown.slice(0, mdStart) +
    "**" +
    markdown.slice(mdStart, mdEnd) +
    "**" +
    markdown.slice(mdEnd)
  );
}
