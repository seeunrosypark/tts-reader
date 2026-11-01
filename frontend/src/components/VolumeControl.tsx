import { useCallback, useRef, useState, type CSSProperties } from "react";

import { useDismiss } from "../hooks/useDismiss";
import { MuteIcon, VolumeIcon } from "./icons";

type VolumeControlProps = {
  volume: number;
  isMuted: boolean;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
};

/** 스피커 아이콘을 누르면 위로 세로 볼륨 막대가 열린다. */
export function VolumeControl({ volume, isMuted, onVolumeChange, onToggleMute }: VolumeControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setIsOpen(false), []);
  useDismiss([anchorRef, panelRef], isOpen, close);

  const shownVolume = isMuted ? 0 : volume;
  const percentText = `${Math.round(shownVolume * 100)}%`;

  return (
    <div className="popover-anchor volume-control" ref={anchorRef}>
      <button
        type="button"
        className="icon-button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`볼륨 ${percentText}`}
        title={`볼륨 ${percentText}`}
        onClick={() => setIsOpen((open) => !open)}
      >
        {isMuted || volume === 0 ? <MuteIcon /> : <VolumeIcon />}
      </button>

      {isOpen && (
        <div ref={panelRef} className="volume-popover" role="dialog" aria-label="볼륨">
          <output className="volume-value">{percentText}</output>
          <input
            type="range"
            className="volume-slider"
            min={0}
            max={1}
            step={0.05}
            value={shownVolume}
            aria-label="볼륨"
            aria-valuetext={percentText}
            style={{ "--volume-progress": `${shownVolume * 100}%` } as CSSProperties}
            onChange={(event) => {
              if (isMuted) {
                onToggleMute();
              }
              onVolumeChange(Number(event.target.value));
            }}
          />
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
        </div>
      )}
    </div>
  );
}
