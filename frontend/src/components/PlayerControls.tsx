import { useCallback, useRef, useState, type CSSProperties } from "react";

import type { VoiceInfo } from "../api/ttsClient";
import type { PlayerStatus } from "../hooks/useTtsPlayer";
import type { TocItem } from "../utils/markdownToSentences";
import type { ProgressMode } from "../utils/readingProgress";
import {
  MuteIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  SettingsIcon,
  StopIcon,
  VolumeIcon,
} from "./icons";
import { SettingsPanel } from "./SettingsPanel";

type PlayerControlsProps = {
  status: PlayerStatus;
  speed: number;
  volume: number;
  voice: string;
  voices: VoiceInfo[];
  playableCount: number;
  currentPlayablePosition: number;
  overallProgress: number;
  readingProgress: number;
  progressChapterTitle: string | null;
  progressMode: ProgressMode;
  isMuted: boolean;
  activeHeading: TocItem | null;
  onPlayToggle: () => void;
  onStop: () => void;
  onSkipPrevious: () => void;
  onSkipNext: () => void;
  onSpeedChange: (speed: number) => void;
  onVolumeChange: (volume: number) => void;
  onVoiceChange: (voice: string) => void;
  onSeek: (fraction: number) => void;
  onToggleMute: () => void;
  onProgressModeChange: (mode: ProgressMode) => void;
};

export function PlayerControls({
  status,
  speed,
  volume,
  voice,
  voices,
  playableCount,
  currentPlayablePosition,
  overallProgress,
  readingProgress,
  progressChapterTitle,
  progressMode,
  isMuted,
  activeHeading,
  onPlayToggle,
  onStop,
  onSkipPrevious,
  onSkipNext,
  onSpeedChange,
  onVolumeChange,
  onVoiceChange,
  onSeek,
  onToggleMute,
  onProgressModeChange,
}: PlayerControlsProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [dragValue, setDragValue] = useState<number | null>(null);
  const seekValue = dragValue ?? Math.round(overallProgress * 1000);
  const settingsRef = useRef<HTMLDivElement>(null);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);
  const isPlaying = status === "playing";
  const isPaused = status === "paused";
  const isEmpty = playableCount === 0;
  const position = isEmpty ? 0 : Math.min(currentPlayablePosition, playableCount);
  const progressPercent = isEmpty ? 0 : Math.floor(readingProgress * 100);
  const progressLabel = progressMode === "chapter" ? "장" : "전체";
  const progressTitle =
    progressMode === "chapter"
      ? `${progressChapterTitle ?? "현재 장"} 진행률 · 클릭하면 전체 진행률`
      : "전체 진행률 · 클릭하면 장별 진행률";

  const commitSeek = () => {
    if (dragValue !== null) {
      onSeek(dragValue / 1000);
    }
    setDragValue(null);
  };

  return (
    <footer className="player-bar">
      <input
        type="range"
        className="seek-bar"
        min={0}
        max={1000}
        step={1}
        value={seekValue}
        disabled={isEmpty}
        aria-label="읽기 진행률"
        aria-valuetext={`${position} / ${playableCount}`}
        style={{ "--seek-progress": `${seekValue / 10}%` } as CSSProperties}
        onChange={(event) => setDragValue(Number(event.target.value))}
        onPointerUp={commitSeek}
        onKeyUp={commitSeek}
      />

      <div className="player-inner">
        <div className="player-section" aria-live="polite">
          {activeHeading ? (
            <>
              <span className="player-section-level">H{activeHeading.level}</span>
              <span className="player-section-text" title={activeHeading.text}>
                {activeHeading.text}
              </span>
            </>
          ) : (
            <span className="player-section-empty">
              {isEmpty ? "파일을 열면 여기서 재생합니다" : "재생할 준비가 됐습니다"}
            </span>
          )}
        </div>

        <div className="player-buttons">
          <button
            type="button"
            className="icon-button"
            aria-label="이전 문장"
            title="이전 문장"
            onClick={onSkipPrevious}
            disabled={isEmpty}
          >
            <PrevIcon />
          </button>
          <button
            type="button"
            className="play-button"
            aria-label={isPlaying ? "일시정지" : "재생"}
            title={isPlaying ? "일시정지 (Space)" : "재생 (Space)"}
            onClick={onPlayToggle}
            disabled={isEmpty}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="다음 문장"
            title="다음 문장"
            onClick={onSkipNext}
            disabled={isEmpty}
          >
            <NextIcon />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="정지"
            title="정지"
            onClick={onStop}
            disabled={status === "idle"}
          >
            <StopIcon />
          </button>
        </div>

        <div className="player-extra">
          <button
            type="button"
            className="progress-button"
            title={progressTitle}
            aria-label={`${progressLabel} 진행률 ${progressPercent}%`}
            disabled={isEmpty}
            onClick={() => onProgressModeChange(progressMode === "chapter" ? "overall" : "chapter")}
          >
            <span className="progress-label">{progressLabel}</span>
            {progressPercent}%
          </button>
          <span className="status-text" title="현재 문장 / 전체 문장">
            {position} / {playableCount}
            {isPaused && <span className="status-paused"> · 일시정지</span>}
          </span>
          <button
            type="button"
            className="icon-button"
            aria-pressed={isMuted}
            aria-label={isMuted ? "음소거 해제" : "음소거"}
            title={isMuted ? "음소거 해제" : "음소거"}
            onClick={onToggleMute}
          >
            {isMuted ? <MuteIcon /> : <VolumeIcon />}
          </button>
          <div className="popover-anchor" ref={settingsRef}>
            <button
              type="button"
              className="speed-button"
              aria-haspopup="dialog"
              aria-expanded={isSettingsOpen}
              title="속도 · 볼륨 · 음성"
              onClick={() => setIsSettingsOpen((open) => !open)}
            >
              <SettingsIcon />
              <span>{speed.toFixed(1)}x</span>
            </button>
            <SettingsPanel
              isOpen={isSettingsOpen}
              speed={speed}
              volume={volume}
              voice={voice}
              voices={voices}
              anchorRef={settingsRef}
              onClose={closeSettings}
              onSpeedChange={onSpeedChange}
              onVolumeChange={onVolumeChange}
              onVoiceChange={onVoiceChange}
              progressMode={progressMode}
              onProgressModeChange={onProgressModeChange}
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
