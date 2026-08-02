import { useEffect, useMemo, useRef, useState } from "react";

import type { TocItem } from "../utils/markdownToSentences";
import {
  buildTocTree,
  collectExpandableIds,
  getAncestorIds,
  type TocNode,
} from "../utils/tocTree";

const TOC_SIDEBAR_COLLAPSED_KEY = "tts-reader-toc-collapsed";
const TOC_SECTIONS_COLLAPSED_KEY = "tts-reader-toc-sections-collapsed";

type TableOfContentsProps = {
  toc: TocItem[];
  activeId: string | null;
  onNavigate: (item: TocItem) => void;
};

function loadSidebarCollapsedState(): boolean {
  return localStorage.getItem(TOC_SIDEBAR_COLLAPSED_KEY) === "true";
}

function loadSectionsCollapsedState(): Set<string> {
  try {
    const raw = localStorage.getItem(TOC_SECTIONS_COLLAPSED_KEY);
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function saveSectionsCollapsedState(collapsedIds: Set<string>) {
  localStorage.setItem(
    TOC_SECTIONS_COLLAPSED_KEY,
    JSON.stringify(Array.from(collapsedIds)),
  );
}

type TocAccordionItemProps = {
  node: TocNode;
  activeId: string | null;
  collapsedIds: Set<string>;
  onToggle: (id: string) => void;
  onNavigate: (item: TocItem) => void;
};

function TocAccordionItem({
  node,
  activeId,
  collapsedIds,
  onToggle,
  onNavigate,
}: TocAccordionItemProps) {
  const hasChildren = node.children.length > 0;
  const isSectionCollapsed = collapsedIds.has(node.item.id);
  const isActive = activeId === node.item.id;

  return (
    <li
      data-toc-id={node.item.id}
      className={`toc-accordion-item level-${node.item.level}${isActive ? " active" : ""}`}
    >
      <div className="toc-row">
        {hasChildren ? (
          <button
            type="button"
            className="toc-expand-button"
            aria-expanded={!isSectionCollapsed}
            aria-label={isSectionCollapsed ? "하위 목차 펼치기" : "하위 목차 접기"}
            onClick={() => onToggle(node.item.id)}
          >
            {isSectionCollapsed ? "▶" : "▼"}
          </button>
        ) : (
          <span className="toc-expand-spacer" aria-hidden="true" />
        )}
        <button
          type="button"
          className="toc-link-button"
          onClick={() => onNavigate(node.item)}
        >
          {node.item.text}
        </button>
      </div>

      {hasChildren && !isSectionCollapsed && (
        <ul className="toc-children">
          {node.children.map((child) => (
            <TocAccordionItem
              key={child.item.id}
              node={child}
              activeId={activeId}
              collapsedIds={collapsedIds}
              onToggle={onToggle}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function TableOfContents({
  toc,
  activeId,
  onNavigate,
}: TableOfContentsProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    loadSidebarCollapsedState,
  );
  const [collapsedSectionIds, setCollapsedSectionIds] = useState(
    loadSectionsCollapsedState,
  );

  const tocTree = useMemo(() => buildTocTree(toc), [toc]);
  const ancestorIds = useMemo(
    () => getAncestorIds(toc, activeId),
    [toc, activeId],
  );

  useEffect(() => {
    if (!activeId || ancestorIds.size === 0) {
      return;
    }

    setCollapsedSectionIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of ancestorIds) {
        if (next.delete(id)) {
          changed = true;
        }
      }
      if (changed) {
        saveSectionsCollapsedState(next);
      }
      return changed ? next : prev;
    });
  }, [activeId, ancestorIds]);

  useEffect(() => {
    if (!activeId || !listRef.current || isSidebarCollapsed) {
      return;
    }

    const activeElement = listRef.current.querySelector(
      `[data-toc-id="${activeId}"]`,
    );
    activeElement?.scrollIntoView({ block: "nearest" });
  }, [activeId, isSidebarCollapsed, collapsedSectionIds]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(TOC_SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  };

  const toggleSection = (id: string) => {
    setCollapsedSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      saveSectionsCollapsedState(next);
      return next;
    });
  };

  const expandAllSections = () => {
    setCollapsedSectionIds(new Set());
    saveSectionsCollapsedState(new Set());
  };

  const collapseAllSections = () => {
    const allExpandable = new Set(collectExpandableIds(tocTree));
    setCollapsedSectionIds(allExpandable);
    saveSectionsCollapsedState(allExpandable);
  };

  return (
    <nav
      className={`toc-sidebar${isSidebarCollapsed ? " collapsed" : ""}`}
      aria-label="목차"
    >
      <div className="toc-header">
        {!isSidebarCollapsed && <h2 className="toc-title">목차</h2>}
        <button
          type="button"
          className="toc-toggle-button"
          aria-expanded={!isSidebarCollapsed}
          aria-label={isSidebarCollapsed ? "목차 펼치기" : "목차 접기"}
          onClick={toggleSidebar}
        >
          {isSidebarCollapsed ? "목차 ▶" : "◀ 접기"}
        </button>
      </div>

      {!isSidebarCollapsed && (
        <>
          {toc.length === 0 ? (
            <p className="toc-empty">목차가 없습니다.</p>
          ) : (
            <>
              <div className="toc-section-actions">
                <button type="button" onClick={expandAllSections}>
                  전체 펼치기
                </button>
                <button type="button" onClick={collapseAllSections}>
                  전체 접기
                </button>
              </div>
              <ul ref={listRef} className="toc-list">
                {tocTree.map((node) => (
                  <TocAccordionItem
                    key={node.item.id}
                    node={node}
                    activeId={activeId}
                    collapsedIds={collapsedSectionIds}
                    onToggle={toggleSection}
                    onNavigate={onNavigate}
                  />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </nav>
  );
}
