import { useEffect, useRef } from "react";

import type { VoiceInfo } from "../api/ttsClient";

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
};

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
}: SettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      onClose();
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [anchorRef, isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div ref={panelRef} className="settings-panel" role="dialog" aria-label="TTS 설정">
      <div className="settings-panel-row">
        <label htmlFor="speed-slider">속도: {speed.toFixed(1)}x</label>
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
        <label htmlFor="volume-slider">볼륨: {Math.round(volume * 100)}%</label>
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
    </div>
  );
}
