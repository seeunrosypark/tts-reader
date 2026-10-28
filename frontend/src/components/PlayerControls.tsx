import { useRef, useState, type CSSProperties } from "react";

import type { VoiceInfo } from "../api/ttsClient";
import type { PlayerStatus } from "../hooks/useTtsPlayer";
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
  isMuted: boolean;
  onPlay: (startSentenceIndex?: number) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSkipPrevious: () => void;
  onSkipNext: () => void;
  onSpeedChange: (speed: number) => void;
  onVolumeChange: (volume: number) => void;
  onVoiceChange: (voice: string) => void;
  onSeek: (fraction: number) => void;
  onToggleMute: () => void;
  resolvePlayStartIndex?: () => number | undefined;
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
  isMuted,
  onPlay,
  onPause,
  onResume,
  onStop,
  onSkipPrevious,
  onSkipNext,
  onSpeedChange,
  onVolumeChange,
  onVoiceChange,
  onSeek,
  onToggleMute,
  resolvePlayStartIndex,
}: PlayerControlsProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [dragValue, setDragValue] = useState<number | null>(null);
  const seekValue = dragValue ?? Math.round(overallProgress * 1000);
  const settingsRef = useRef<HTMLDivElement>(null);
  const isPlaying = status === "playing";
  const isPaused = status === "paused";

  const handlePlayToggle = () => {
    if (isPlaying) {
      onPause();
      return;
    }
    if (isPaused) {
      onResume();
      return;
    }
    onPlay(resolvePlayStartIndex?.());
  };

  return (
    <section className="player-controls">
      <div className="control-row player-main-row">
        <div className="player-buttons">
          <button
            type="button"
            onClick={handlePlayToggle}
            disabled={playableCount === 0}
          >
            {isPlaying ? "일시정지" : isPaused ? "계속 재생" : "재생"}
          </button>
          <button type="button" onClick={onStop} disabled={status === "idle"}>
            정지
          </button>
          <button
            type="button"
            onClick={onSkipPrevious}
            disabled={playableCount === 0}
          >
            이전 문장
          </button>
          <button type="button" onClick={onSkipNext} disabled={playableCount === 0}>
            다음 문장
          </button>
          <span className="status-text">
            문장{" "}
            {playableCount === 0
              ? 0
              : Math.min(currentPlayablePosition, playableCount)}{" "}
            / {playableCount}
          </span>
        </div>

        <div className="settings-wrapper" ref={settingsRef}>
          <button
            type="button"
            className="mute-button"
            aria-pressed={isMuted}
            title={isMuted ? "음소거 해제" : "음소거"}
            onClick={onToggleMute}
          >
            {isMuted ? "🔇" : "🔊"}
          </button>
          <button
            type="button"
            className="settings-button"
            aria-haspopup="dialog"
            aria-expanded={isSettingsOpen}
            onClick={() => setIsSettingsOpen((open) => !open)}
          >
            설정
          </button>
          <SettingsPanel
            isOpen={isSettingsOpen}
            speed={speed}
            volume={volume}
            voice={voice}
            voices={voices}
            anchorRef={settingsRef}
            onClose={() => setIsSettingsOpen(false)}
            onSpeedChange={onSpeedChange}
            onVolumeChange={onVolumeChange}
            onVoiceChange={onVoiceChange}
          />
        </div>
      </div>

      <input
        type="range"
        className="seek-bar"
        min={0}
        max={1000}
        step={1}
        value={seekValue}
        disabled={playableCount === 0}
        aria-label="읽기 진행률"
        aria-valuetext={`${Math.min(currentPlayablePosition, playableCount)} / ${playableCount}`}
        style={{ "--seek-progress": `${seekValue / 10}%` } as CSSProperties}
        onChange={(event) => setDragValue(Number(event.target.value))}
        onPointerUp={() => {
          if (dragValue !== null) {
            onSeek(dragValue / 1000);
          }
          setDragValue(null);
        }}
        onKeyUp={() => {
          if (dragValue !== null) {
            onSeek(dragValue / 1000);
          }
          setDragValue(null);
        }}
      />
    </section>
  );
}
