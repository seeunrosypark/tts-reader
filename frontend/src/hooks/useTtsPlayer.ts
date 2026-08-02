import { useCallback, useEffect, useRef, useState } from "react";

import { synthesizeTts } from "../api/ttsClient";
import type { Sentence } from "../utils/sentenceSplitter";

export type PlayerStatus = "idle" | "playing" | "paused";

type UseTtsPlayerOptions = {
  sentences: Sentence[];
  voice: string;
  speed: number;
  volume: number;
  onHighlightChange: (index: number | null) => void;
};

export function useTtsPlayer({
  sentences,
  voice,
  speed,
  volume,
  onHighlightChange,
}: UseTtsPlayerOptions) {
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [currentIndex, setCurrentIndex] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const statusRef = useRef<PlayerStatus>("idle");
  const currentIndexRef = useRef(0);
  const speedRef = useRef(speed);
  const volumeRef = useRef(volume);
  const voiceRef = useRef(voice);
  const prefetchRef = useRef<Map<number, Blob>>(new Map());
  const abortRef = useRef(false);

  const playableSentences = sentences.filter((sentence) => !sentence.skip);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    volumeRef.current = volume;
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    voiceRef.current = voice;
  }, [voice]);

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
      audioRef.current = null;
    }
  }, []);

  const getPlayableIndex = useCallback(
    (sentenceIndex: number) =>
      playableSentences.findIndex((sentence) => sentence.index === sentenceIndex),
    [playableSentences],
  );

  const prefetchSentence = useCallback(
    async (sentenceIndex: number) => {
      if (prefetchRef.current.has(sentenceIndex)) {
        return;
      }

      const sentence = sentences.find((item) => item.index === sentenceIndex);
      if (!sentence || sentence.skip) {
        return;
      }

      const blob = await synthesizeTts(
        sentence.text,
        voiceRef.current,
        speedRef.current,
      );
      prefetchRef.current.set(sentenceIndex, blob);
    },
    [sentences],
  );

  const playSentence = useCallback(
    async (sentenceIndex: number): Promise<boolean> => {
      const sentence = sentences.find((item) => item.index === sentenceIndex);
      if (!sentence || sentence.skip) {
        return false;
      }

      let blob = prefetchRef.current.get(sentenceIndex);
      if (!blob) {
        blob = await synthesizeTts(
          sentence.text,
          voiceRef.current,
          speedRef.current,
        );
      } else {
        prefetchRef.current.delete(sentenceIndex);
      }

      cleanupAudio();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = volumeRef.current;
      audioRef.current = audio;

      setCurrentIndex(sentenceIndex);
      currentIndexRef.current = sentenceIndex;
      onHighlightChange(sentenceIndex);

      const nextPlayable = playableSentences[getPlayableIndex(sentenceIndex) + 1];
      if (nextPlayable) {
        void prefetchSentence(nextPlayable.index);
      }

      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error("Audio playback failed"));
        void audio.play().catch(reject);
      });

      URL.revokeObjectURL(url);
      audioRef.current = null;
      return true;
    },
    [
      cleanupAudio,
      getPlayableIndex,
      onHighlightChange,
      playableSentences,
      prefetchSentence,
      sentences,
    ],
  );

  const runPlaybackLoop = useCallback(
    async (startSentenceIndex?: number) => {
      abortRef.current = false;

      let startAt = startSentenceIndex ?? currentIndexRef.current;
      if (statusRef.current === "idle" && startSentenceIndex === undefined) {
        const first = playableSentences[0];
        startAt = first?.index ?? 0;
        currentIndexRef.current = startAt;
      }

      let startPlayableIndex = getPlayableIndex(startAt);
      if (startPlayableIndex < 0) {
        startPlayableIndex = 0;
      }

      for (let i = startPlayableIndex; i < playableSentences.length; i++) {
        if (abortRef.current || statusRef.current !== "playing") {
          return;
        }

        const sentence = playableSentences[i];
        await playSentence(sentence.index);
      }

      statusRef.current = "idle";
      setStatus("idle");
      onHighlightChange(null);
    },
    [getPlayableIndex, onHighlightChange, playableSentences, playSentence],
  );

  const play = useCallback(
    (startSentenceIndex?: number) => {
      if (playableSentences.length === 0) {
        return;
      }

      prefetchRef.current.clear();

      if (startSentenceIndex !== undefined) {
        const target = playableSentences.find(
          (sentence) => sentence.index >= startSentenceIndex,
        );
        if (target) {
          currentIndexRef.current = target.index;
          setCurrentIndex(target.index);
          onHighlightChange(target.index);
        }
      }

      statusRef.current = "playing";
      setStatus("playing");
      void runPlaybackLoop(startSentenceIndex);
    },
    [onHighlightChange, playableSentences, runPlaybackLoop],
  );

  const pause = useCallback(() => {
    if (statusRef.current !== "playing") {
      return;
    }

    abortRef.current = true;
    statusRef.current = "paused";
    setStatus("paused");
    audioRef.current?.pause();
  }, []);

  const stop = useCallback(() => {
    abortRef.current = true;
    statusRef.current = "idle";
    setStatus("idle");
    currentIndexRef.current = 0;
    setCurrentIndex(0);
    prefetchRef.current.clear();
    cleanupAudio();
    onHighlightChange(null);
  }, [cleanupAudio, onHighlightChange]);

  const resume = useCallback(() => {
    if (statusRef.current !== "paused") {
      return;
    }

    if (audioRef.current) {
      statusRef.current = "playing";
      setStatus("playing");
      abortRef.current = false;
      void audioRef.current.play();
      audioRef.current.onended = () => {
        const nextPlayable = playableSentences[getPlayableIndex(currentIndexRef.current) + 1];
        if (nextPlayable) {
          void runPlaybackLoop(nextPlayable.index);
        } else {
          statusRef.current = "idle";
          setStatus("idle");
          onHighlightChange(null);
        }
      };
      return;
    }

    play();
  }, [getPlayableIndex, onHighlightChange, play, playableSentences, runPlaybackLoop]);

  const skipPrevious = useCallback(() => {
    const playableIndex = getPlayableIndex(currentIndexRef.current);
    if (playableIndex <= 0) {
      return;
    }

    abortRef.current = true;
    cleanupAudio();
    const previous = playableSentences[playableIndex - 1];
    currentIndexRef.current = previous.index;
    setCurrentIndex(previous.index);
    onHighlightChange(previous.index);

    if (statusRef.current === "playing") {
      void runPlaybackLoop();
    }
  }, [
    cleanupAudio,
    getPlayableIndex,
    onHighlightChange,
    playableSentences,
    runPlaybackLoop,
  ]);

  const skipNext = useCallback(() => {
    const playableIndex = getPlayableIndex(currentIndexRef.current);
    if (playableIndex >= playableSentences.length - 1) {
      return;
    }

    abortRef.current = true;
    cleanupAudio();
    const next = playableSentences[playableIndex + 1];
    currentIndexRef.current = next.index;
    setCurrentIndex(next.index);
    onHighlightChange(next.index);

    if (statusRef.current === "playing") {
      void runPlaybackLoop();
    }
  }, [
    cleanupAudio,
    getPlayableIndex,
    onHighlightChange,
    playableSentences,
    runPlaybackLoop,
  ]);

  const jumpToSentence = useCallback(
    (sentenceIndex: number) => {
      const target = playableSentences.find(
        (sentence) => sentence.index >= sentenceIndex,
      );
      if (!target) {
        return;
      }

      abortRef.current = true;
      cleanupAudio();
      prefetchRef.current.clear();
      currentIndexRef.current = target.index;
      setCurrentIndex(target.index);
      onHighlightChange(target.index);

      if (statusRef.current === "playing") {
        statusRef.current = "playing";
        void runPlaybackLoop(target.index);
      }
    },
    [
      cleanupAudio,
      onHighlightChange,
      playableSentences,
      runPlaybackLoop,
    ],
  );

  useEffect(() => {
    return () => {
      abortRef.current = true;
      cleanupAudio();
    };
  }, [cleanupAudio]);

  const currentPlayablePosition = Math.max(getPlayableIndex(currentIndex), 0) + 1;

  return {
    status,
    currentIndex,
    currentPlayablePosition,
    play,
    pause,
    resume,
    stop,
    skipPrevious,
    skipNext,
    jumpToSentence,
    playableCount: playableSentences.length,
  };
}
