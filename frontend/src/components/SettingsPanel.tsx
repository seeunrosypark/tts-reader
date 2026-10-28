import { useRef } from "react";

import type { VoiceInfo } from "../api/ttsClient";
import { useDismiss } from "../hooks/useDismiss";
import type { ProgressMode } from "../utils/readingProgress";

type SettingsPanelProps = {
  isOpen: boolean;
  speed: number;
  volume: number;
  voice: string;
  voices: VoiceInfo[];
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  onSpeedChange: (speed: number) => void;
  onVolumeChange: (volume: number) => void;
  onVoiceChange: (voice: string) => void;
  progressMode: ProgressMode;
  onProgressModeChange: (mode: ProgressMode) => void;
};

const PROGRESS_MODES: [ProgressMode, string][] = [
  ["overall", "전체"],
  ["chapter", "장별"],
];

export function SettingsPanel({
  isOpen,
  speed,
  volume,
  voice,
  voices,
  anchorRef,
  onClose,
  onSpeedChange,
  onVolumeChange,
  onVoiceChange,
  progressMode,
  onProgressModeChange,
}: SettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDismiss([anchorRef, panelRef], isOpen, onClose);

  if (!isOpen) {
    return null;
  }

  return (
    <div ref={panelRef} className="popover popover-up settings-panel" role="dialog" aria-label="TTS 설정">
      <div className="settings-panel-row">
        <label htmlFor="speed-slider">
          속도 <output>{speed.toFixed(1)}x</output>
        </label>
        <input
          id="speed-slider"
          type="range"
          min="0.5"
          max="4"
          step="0.1"
          value={speed}
          onChange={(event) => onSpeedChange(Number(event.target.value))}
        />
      </div>
      <div className="settings-panel-row">
        <label htmlFor="volume-slider">
          볼륨 <output>{Math.round(volume * 100)}%</output>
        </label>
        <input
          id="volume-slider"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(event) => onVolumeChange(Number(event.target.value))}
        />
      </div>
      <div className="settings-panel-row">
        <label htmlFor="voice-select">음성</label>
        <select
          id="voice-select"
          value={voice}
          onChange={(event) => onVoiceChange(event.target.value)}
        >
          {voices.map((item) => (
            <option key={item.shortName} value={item.shortName}>
              {item.friendlyName} ({item.gender})
            </option>
          ))}
        </select>
      </div>
      <div className="settings-panel-row">
        <span className="settings-panel-label" id="progress-mode-label">
          진행률 표시
        </span>
        <div className="segmented" role="radiogroup" aria-labelledby="progress-mode-label">
          {PROGRESS_MODES.map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={progressMode === mode}
              onClick={() => onProgressModeChange(mode)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
