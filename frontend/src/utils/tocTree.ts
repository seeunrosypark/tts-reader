import type { TocItem } from "./markdownToSentences";

export type TocNode = {
  item: TocItem;
  children: TocNode[];
};

export function buildTocTree(toc: TocItem[]): TocNode[] {
  const root: TocNode[] = [];
  const stack: TocNode[] = [];

  for (const item of toc) {
    const node: TocNode = { item, children: [] };

    while (stack.length > 0 && stack[stack.length - 1].item.level >= item.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  }

  return root;
}

export function getAncestorIds(toc: TocItem[], activeId: string | null): Set<string> {
  if (!activeId) {
    return new Set();
  }

  const activeIndex = toc.findIndex((item) => item.id === activeId);
  if (activeIndex === -1) {
    return new Set();
  }

  const ancestors = new Set<string>();
  let currentLevel = toc[activeIndex].level;

  for (let index = activeIndex - 1; index >= 0; index -= 1) {
    if (toc[index].level < currentLevel) {
      ancestors.add(toc[index].id);
      currentLevel = toc[index].level;
    }
  }

  return ancestors;
}

/** 하위 항목이 있는 노드 중 minLevel 이상인 것의 id. minLevel보다 얕은 노드는 펼친 채로 둔다. */
export function collectExpandableIds(nodes: TocNode[], minLevel = 1): string[] {
  const ids: string[] = [];

  function walk(nodeList: TocNode[]) {
    for (const node of nodeList) {
      if (node.children.length > 0) {
        if (node.item.level < minLevel) {
          walk(node.children);
          continue;
        }
        ids.push(node.item.id);
        walk(node.children);
      }
    }
  }

  walk(nodes);
  return ids;
}
