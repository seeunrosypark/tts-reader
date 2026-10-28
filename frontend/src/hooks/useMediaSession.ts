import { useEffect, useRef } from "react";

import type { PlayerStatus } from "./useTtsPlayer";

type UseMediaSessionOptions = {
  status: PlayerStatus;
  title: string | null;
  album: string | null;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onPrevious: () => void;
  onNext: () => void;
};

const PLAYBACK_STATE: Record<PlayerStatus, MediaSessionPlaybackState> = {
  idle: "none",
  playing: "playing",
  paused: "paused",
};

/** 키보드 미디어 키, 이어폰 버튼, OS 미디어 컨트롤로 재생을 조작할 수 있게 한다. */
export function useMediaSession({
  status,
  title,
  album,
  onPlay,
  onPause,
  onStop,
  onPrevious,
  onNext,
}: UseMediaSessionOptions) {
  // 핸들러는 매 렌더 바뀌므로 ref로 최신 값을 읽고, 등록은 한 번만 한다.
  const handlersRef = useRef({ onPlay, onPause, onStop, onPrevious, onNext });

  useEffect(() => {
    handlersRef.current = { onPlay, onPause, onStop, onPrevious, onNext };
  }, [onNext, onPause, onPlay, onPrevious, onStop]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) {
      return;
    }

    const session = navigator.mediaSession;
    const actions: [MediaSessionAction, () => void][] = [
      ["play", () => handlersRef.current.onPlay()],
      ["pause", () => handlersRef.current.onPause()],
      ["stop", () => handlersRef.current.onStop()],
      ["previoustrack", () => handlersRef.current.onPrevious()],
      ["nexttrack", () => handlersRef.current.onNext()],
    ];

    for (const [action, handler] of actions) {
      try {
        session.setActionHandler(action, handler);
      } catch {
        // 브라우저가 지원하지 않는 동작은 건너뛴다.
      }
    }

    return () => {
      for (const [action] of actions) {
        try {
          session.setActionHandler(action, null);
        } catch {
          // 위와 같음
        }
      }
    };
  }, []);

  useEffect(() => {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = PLAYBACK_STATE[status];
    }
  }, [status]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) {
      return;
    }
    navigator.mediaSession.metadata = title
      ? new MediaMetadata({ title, artist: "TTS Reader", album: album ?? undefined })
      : null;
  }, [album, title]);
}
