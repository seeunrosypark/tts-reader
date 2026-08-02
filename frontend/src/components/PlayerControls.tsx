import { useRef, useState } from "react";

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
  onPlay: (startSentenceIndex?: number) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSkipPrevious: () => void;
  onSkipNext: () => void;
  onSpeedChange: (speed: number) => void;
  onVolumeChange: (volume: number) => void;
  onVoiceChange: (voice: string) => void;
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
  onPlay,
  onPause,
  onResume,
  onStop,
  onSkipPrevious,
  onSkipNext,
  onSpeedChange,
  onVolumeChange,
  onVoiceChange,
  resolvePlayStartIndex,
}: PlayerControlsProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
    </section>
  );
}
