import { useCallback, useRef, useState, type CSSProperties } from "react";

import type { VoiceInfo } from "../api/ttsClient";
import type { PlayerStatus } from "../hooks/useTtsPlayer";
import type { TocItem } from "../utils/markdownToSentences";
import type { RangeProgress, ReadingProgress } from "../utils/readingProgress";
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
  readingProgress: ReadingProgress;
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
};

function percent({ progress, count }: RangeProgress): number {
  return count === 0 ? 0 : Math.floor(progress * 100);
}

function ProgressRow({ label, range, title }: { label: string; range: RangeProgress; title: string }) {
  return (
    <div className="progress-row" title={title}>
      <span className="progress-label">{label}</span>
      <span className="progress-percent">{percent(range)}%</span>
      <span className="progress-count">
        {range.position} / {range.count}
      </span>
    </div>
  );
}

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
}: PlayerControlsProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [dragValue, setDragValue] = useState<number | null>(null);
  const seekValue = dragValue ?? Math.round(overallProgress * 1000);
  const settingsRef = useRef<HTMLDivElement>(null);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);
  const isPlaying = status === "playing";
  const isEmpty = playableCount === 0;
  const position = isEmpty ? 0 : Math.min(currentPlayablePosition, playableCount);

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
          <div className="progress-stats">
            <ProgressRow
              label="전체"
              range={readingProgress.overall}
              title="문서 전체 진행률 · 현재 문장 / 전체 문장"
            />
            {readingProgress.chapter && (
              <ProgressRow
                label="장"
                range={readingProgress.chapter}
                title={`${readingProgress.chapter.title ?? "머리말"} 진행률 · 장 안의 현재 문장 / 장 문장 수`}
              />
            )}
          </div>
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
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
