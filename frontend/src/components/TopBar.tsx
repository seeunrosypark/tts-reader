import { useCallback, useRef, useState } from "react";

import { useDismiss } from "../hooks/useDismiss";
import type { Theme } from "../hooks/useTheme";
import type { RecentFile } from "../utils/recentFiles";
import { ClockIcon, FileIcon, HelpIcon, MoonIcon, SunIcon, TocIcon } from "./icons";
import { RecentFileList } from "./RecentFileList";

export type SaveState = "saving" | "saved" | "memory-only" | null;

type TopBarProps = {
  fileName: string | null;
  saveState: SaveState;
  isTocOpen: boolean;
  hasToc: boolean;
  recentFiles: RecentFile[];
  theme: Theme;
  onToggleTheme: () => void;
  onToggleToc: () => void;
  onOpenFile: () => void;
  onOpenRecent: (file: RecentFile) => void;
};

const SAVE_STATE_LABEL: Record<Exclude<SaveState, null>, string> = {
  saving: "저장 중…",
  saved: "원본에 저장됨",
  "memory-only": "원본 미저장 · Chrome/Edge에서 '열기'로 다시 열어 주세요",
};

const SHORTCUTS: [string, string][] = [
  ["Space", "재생 / 일시정지"],
  ["문장 클릭", "그 문장부터 재생"],
  ["드래그 후 재생", "선택한 문장부터 재생"],
  ["드래그 후 Ctrl+B", "**굵게** 토글 → 원본 파일에 저장"],
];

export function TopBar({
  fileName,
  saveState,
  isTocOpen,
  hasToc,
  recentFiles,
  theme,
  onToggleTheme,
  onToggleToc,
  onOpenFile,
  onOpenRecent,
}: TopBarProps) {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isRecentOpen, setIsRecentOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);
  const recentRef = useRef<HTMLDivElement>(null);
  const closeHelp = useCallback(() => setIsHelpOpen(false), []);
  const closeRecent = useCallback(() => setIsRecentOpen(false), []);
  useDismiss([helpRef], isHelpOpen, closeHelp);
  useDismiss([recentRef], isRecentOpen, closeRecent);

  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <button
          type="button"
          className="icon-button"
          aria-label={isTocOpen ? "목차 닫기" : "목차 열기"}
          aria-pressed={isTocOpen}
          title="목차"
          disabled={!hasToc}
          onClick={onToggleToc}
        >
          <TocIcon />
        </button>
        <span className="app-title">TTS Reader</span>
        {fileName && (
          <span className="file-name" title={fileName}>
            {fileName}
          </span>
        )}
        {saveState && (
          <span className={`save-state save-state-${saveState}`}>
            {SAVE_STATE_LABEL[saveState]}
          </span>
        )}
      </div>

      <div className="top-bar-right">
        {recentFiles.length > 0 && (
          <div className="popover-anchor" ref={recentRef}>
            <button
              type="button"
              className="icon-button"
              aria-label="최근 파일"
              aria-expanded={isRecentOpen}
              title="최근 파일"
              onClick={() => setIsRecentOpen((open) => !open)}
            >
              <ClockIcon />
            </button>
            {isRecentOpen && (
              <div className="popover popover-down recent-popover" role="dialog" aria-label="최근 파일">
                <p className="popover-title">최근 파일</p>
                <RecentFileList
                  files={recentFiles}
                  onOpen={(file) => {
                    closeRecent();
                    onOpenRecent(file);
                  }}
                />
              </div>
            )}
          </div>
        )}
        <button type="button" className="open-button" onClick={onOpenFile}>
          <FileIcon />
          <span>열기</span>
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={theme === "dark" ? "밝은 테마로 전환" : "어두운 테마로 전환"}
          title={theme === "dark" ? "밝은 테마" : "어두운 테마"}
          onClick={onToggleTheme}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>
        <div className="popover-anchor" ref={helpRef}>
          <button
            type="button"
            className="icon-button"
            aria-label="단축키 도움말"
            aria-expanded={isHelpOpen}
            onClick={() => setIsHelpOpen((open) => !open)}
          >
            <HelpIcon />
          </button>
          {isHelpOpen && (
            <div className="popover popover-down" role="dialog" aria-label="단축키">
              <dl className="shortcut-list">
                {SHORTCUTS.map(([key, description]) => (
                  <div key={key} className="shortcut-item">
                    <dt>
                      <kbd>{key}</kbd>
                    </dt>
                    <dd>{description}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
