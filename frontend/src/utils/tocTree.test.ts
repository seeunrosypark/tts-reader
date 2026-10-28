import { describe, expect, it } from "vitest";

import type { TocItem } from "./markdownToSentences";
import { buildTocTree, collectExpandableIds, getAncestorIds } from "./tocTree";

const toc: TocItem[] = [
  { id: "h1", level: 1, text: "책", sentenceIndex: 0 },
  { id: "c1", level: 2, text: "1장", sentenceIndex: 1 },
  { id: "c1-1", level: 3, text: "1.1", sentenceIndex: 2 },
  { id: "c1-1-1", level: 4, text: "1.1.1", sentenceIndex: 3 },
  { id: "c2", level: 2, text: "2장", sentenceIndex: 4 },
  { id: "c3", level: 2, text: "3장", sentenceIndex: 5 },
  { id: "c3-1", level: 3, text: "3.1", sentenceIndex: 6 },
];

describe("buildTocTree", () => {
  it("제목 단계에 따라 중첩한다", () => {
    const tree = buildTocTree(toc);
    expect(tree.map((node) => node.item.id)).toEqual(["h1"]);
    expect(tree[0].children.map((node) => node.item.id)).toEqual(["c1", "c2", "c3"]);
    expect(tree[0].children[0].children[0].children[0].item.id).toBe("c1-1-1");
  });

  it("단계를 건너뛰어도 가장 가까운 상위 제목 아래에 둔다", () => {
    const tree = buildTocTree([
      { id: "a", level: 2, text: "A", sentenceIndex: 0 },
      { id: "b", level: 4, text: "B", sentenceIndex: 1 },
    ]);
    expect(tree[0].children[0].item.id).toBe("b");
  });
});

describe("collectExpandableIds", () => {
  it("하위 항목이 있는 모든 노드", () => {
    expect(collectExpandableIds(buildTocTree(toc))).toEqual(["h1", "c1", "c1-1", "c3"]);
  });

  it("minLevel=2면 H1은 펼친 채로 두고 H2부터 접는다 (모두 접기)", () => {
    expect(collectExpandableIds(buildTocTree(toc), 2)).toEqual(["c1", "c1-1", "c3"]);
  });
});

describe("getAncestorIds", () => {
  it("현재 제목의 모든 상위 제목", () => {
    expect([...getAncestorIds(toc, "c1-1-1")]).toEqual(["c1-1", "c1", "h1"]);
  });

  it("없는 id나 null이면 빈 집합", () => {
    expect(getAncestorIds(toc, null).size).toBe(0);
    expect(getAncestorIds(toc, "nope").size).toBe(0);
  });
});
