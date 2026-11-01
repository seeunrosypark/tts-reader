import { useCallback, useRef, useState, type CSSProperties } from "react";

import type { VoiceInfo } from "../api/ttsClient";
import type { PlayerStatus } from "../hooks/useTtsPlayer";
import type { TocItem } from "../utils/markdownToSentences";
import type { RangeProgress, ReadingProgress } from "../utils/readingProgress";
import { estimateSeconds, formatRemaining } from "../utils/speechRate";
import {
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  SettingsIcon,
  StopIcon,
} from "./icons";
import { SettingsPanel } from "./SettingsPanel";
import { VolumeControl } from "./VolumeControl";

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
  /** 현재 음성이 1배속에서 1초에 읽는 글자 수 */
  charsPerSecond: number;
  isSpeechRateMeasured: boolean;
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

/** "ko-KR-SunHiNeural" → "SunHi" */
function voiceLabel(shortName: string): string {
  return shortName.split("-").pop()?.replace(/Neural$/, "") ?? shortName;
}

function percent({ progress, count }: RangeProgress): number {
  return count === 0 ? 0 : Math.floor(progress * 100);
}

type ProgressRowProps = {
  label: string;
  range: RangeProgress;
  title: string;
  /** 1배속 기준 초당 글자 수 × 재생 속도 */
  charsPerSecondAtSpeed: number;
  rateNote: string;
};

function ProgressRow({ label, range, title, charsPerSecondAtSpeed, rateNote }: ProgressRowProps) {
  const remaining = formatRemaining(estimateSeconds(range.remainingChars, charsPerSecondAtSpeed, 1));
  const total = formatRemaining(estimateSeconds(range.totalChars, charsPerSecondAtSpeed, 1));
  return (
    <div className="progress-row" title={`${title}\n남은 시간 ${remaining} / 전체 ${total} (${rateNote})`}>
      <span className="progress-label">{label}</span>
      <span className="progress-percent">{percent(range)}%</span>
      <span className="progress-count">
        {range.position} / {range.count}
      </span>
      <span className="progress-remaining">
        {remaining}
        <span className="progress-remaining-suffix"> 남음</span>
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
  charsPerSecond,
  isSpeechRateMeasured,
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
  const charsPerSecondAtSpeed = charsPerSecond * speed;
  const rateNote = `${speed}배속 · ${
    isSpeechRateMeasured ? "이 음성으로 들은 기록 기준" : "기본 낭독 속도 기준, 들을수록 정확해짐"
  }`;
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
            className="icon-button stop-button"
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
              charsPerSecondAtSpeed={charsPerSecondAtSpeed}
              rateNote={rateNote}
              label="전체"
              range={readingProgress.overall}
              title="문서 전체 진행률 · 현재 문장 / 전체 문장"
            />
            {readingProgress.chapter && (
              <ProgressRow
                charsPerSecondAtSpeed={charsPerSecondAtSpeed}
                rateNote={rateNote}
                label="장"
                range={readingProgress.chapter}
                title={`${readingProgress.chapter.title ?? "머리말"} 진행률 · 장 안의 현재 문장 / 장 문장 수`}
              />
            )}
          </div>
          <span className="player-divider" aria-hidden="true" />
          <VolumeControl
            volume={volume}
            isMuted={isMuted}
            onVolumeChange={onVolumeChange}
            onToggleMute={onToggleMute}
          />
          <span className="player-divider" aria-hidden="true" />
          <div className="popover-anchor" ref={settingsRef}>
            <button
              type="button"
              className="speed-button"
              aria-haspopup="dialog"
              aria-expanded={isSettingsOpen}
              title="재생 속도 · 음성"
              onClick={() => setIsSettingsOpen((open) => !open)}
            >
              <SettingsIcon />
              <span className="speed-value">{speed.toFixed(1)}x</span>
              <span className="speed-voice">{voiceLabel(voice)}</span>
            </button>
            <SettingsPanel
              isOpen={isSettingsOpen}
              speed={speed}
              voice={voice}
              voices={voices}
              anchorRef={settingsRef}
              onClose={closeSettings}
              onSpeedChange={onSpeedChange}
              onVoiceChange={onVoiceChange}
            />
          </div>
        </div>
      </div>
    </footer>
  );
}
