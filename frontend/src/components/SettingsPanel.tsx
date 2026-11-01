import { useRef } from "react";

import type { VoiceInfo } from "../api/ttsClient";
import { useDismiss } from "../hooks/useDismiss";

type SettingsPanelProps = {
  isOpen: boolean;
  speed: number;
  voice: string;
  voices: VoiceInfo[];
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  onSpeedChange: (speed: number) => void;
  onVoiceChange: (voice: string) => void;
};

export function SettingsPanel({
  isOpen,
  speed,
  voice,
  voices,
  anchorRef,
  onClose,
  onSpeedChange,
  onVoiceChange,
}: SettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDismiss([anchorRef, panelRef], isOpen, onClose);

  if (!isOpen) {
    return null;
  }

  return (
    <div ref={panelRef} className="popover popover-up settings-panel" role="dialog" aria-label="재생 속도와 음성">
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
