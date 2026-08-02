import type { TocItem } from "../utils/markdownToSentences";

type StickySectionHeadingProps = {
  heading: TocItem | null;
};

export function StickySectionHeading({ heading }: StickySectionHeadingProps) {
  if (!heading) {
    return null;
  }

  return (
    <div className="sticky-section-heading" aria-live="polite">
      <span className={`sticky-section-level level-${heading.level}`}>
        H{heading.level}
      </span>
      <span className="sticky-section-text">{heading.text}</span>
    </div>
  );
}
