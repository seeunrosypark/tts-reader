import { useCallback, useEffect, useRef, useState } from "react";

import { synthesizeTts } from "../api/ttsClient";
import type { Sentence } from "../utils/sentenceSplitter";

export type PlayerStatus = "idle" | "playing" | "paused";

const AUDIO_CACHE_LIMIT = 50;
const PREFETCH_AHEAD = 2;

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
  const [sentenceProgress, setSentenceProgress] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const statusRef = useRef<PlayerStatus>("idle");
  const currentIndexRef = useRef(0);
  const speedRef = useRef(speed);
  const volumeRef = useRef(volume);
  const voiceRef = useRef(voice);
  // 키에 음성·속도를 포함해 설정 변경 시 이전 오디오가 재생되지 않도록 한다.
  const audioCacheRef = useRef<Map<string, Promise<Blob>>>(new Map());
  // 재생 루프마다 증가. 늦게 도착한 오디오가 이전 루프에서 재생되는 것을 막는다.
  const generationRef = useRef(0);

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

  const moveTo = useCallback(
    (sentenceIndex: number) => {
      currentIndexRef.current = sentenceIndex;
      setCurrentIndex(sentenceIndex);
      setSentenceProgress(0);
      onHighlightChange(sentenceIndex);
    },
    [onHighlightChange],
  );

  const getPlayableIndex = useCallback(
    (sentenceIndex: number) =>
      playableSentences.findIndex((sentence) => sentence.index === sentenceIndex),
    [playableSentences],
  );

  const loadAudio = useCallback((sentence: Sentence): Promise<Blob> => {
    const cache = audioCacheRef.current;
    const key = JSON.stringify([sentence.text, voiceRef.current, speedRef.current]);
    const cached = cache.get(key);
    if (cached) {
      cache.delete(key);
      cache.set(key, cached);
      return cached;
    }

    const request = synthesizeTts(sentence.text, voiceRef.current, speedRef.current);
    cache.set(key, request);
    request.catch(() => {
      if (cache.get(key) === request) {
        cache.delete(key);
      }
    });
    if (cache.size > AUDIO_CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) {
        cache.delete(oldest);
      }
    }
    return request;
  }, []);

  const playSentence = useCallback(
    async (sentenceIndex: number, generation: number): Promise<boolean> => {
      const sentence = sentences.find((item) => item.index === sentenceIndex);
      if (!sentence || sentence.skip) {
        return false;
      }

      moveTo(sentenceIndex);
      const current = loadAudio(sentence);
      const playableIndex = getPlayableIndex(sentenceIndex);
      for (let ahead = 1; ahead <= PREFETCH_AHEAD; ahead++) {
        const next = playableSentences[playableIndex + ahead];
        if (next) {
          void loadAudio(next);
        }
      }

      const blob = await current;
      if (generation !== generationRef.current) {
        return false;
      }

      cleanupAudio();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = volumeRef.current;
      audio.ontimeupdate = () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          setSentenceProgress(audio.currentTime / audio.duration);
        }
      };
      audioRef.current = audio;

      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error("Audio playback failed"));
        void audio.play().catch(reject);
      });

      URL.revokeObjectURL(url);
      audioRef.current = null;
      return true;
    },
    [cleanupAudio, getPlayableIndex, loadAudio, moveTo, playableSentences, sentences],
  );

  const finishPlayback = useCallback(() => {
    statusRef.current = "idle";
    setStatus("idle");
    currentIndexRef.current = 0;
    setCurrentIndex(0);
    setSentenceProgress(0);
    onHighlightChange(null);
  }, [onHighlightChange]);

  const runPlaybackLoop = useCallback(async () => {
    const generation = ++generationRef.current;

    let startPlayableIndex = getPlayableIndex(currentIndexRef.current);
    if (startPlayableIndex < 0) {
      startPlayableIndex = Math.max(
        playableSentences.findIndex(
          (sentence) => sentence.index >= currentIndexRef.current,
        ),
        0,
      );
    }

    for (let i = startPlayableIndex; i < playableSentences.length; i++) {
      if (generation !== generationRef.current || statusRef.current !== "playing") {
        return;
      }
      await playSentence(playableSentences[i].index, generation);
    }

    if (generation === generationRef.current) {
      finishPlayback();
    }
  }, [finishPlayback, getPlayableIndex, playableSentences, playSentence]);

  const play = useCallback(
    (startSentenceIndex?: number) => {
      if (playableSentences.length === 0) {
        return;
      }

      if (startSentenceIndex !== undefined) {
        const target = playableSentences.find(
          (sentence) => sentence.index >= startSentenceIndex,
        );
        if (target) {
          moveTo(target.index);
        }
      }

      cleanupAudio();
      statusRef.current = "playing";
      setStatus("playing");
      void runPlaybackLoop();
    },
    [cleanupAudio, moveTo, playableSentences, runPlaybackLoop],
  );

  const pause = useCallback(() => {
    if (statusRef.current !== "playing") {
      return;
    }

    generationRef.current++;
    statusRef.current = "paused";
    setStatus("paused");
    audioRef.current?.pause();
  }, []);

  const stop = useCallback(() => {
    generationRef.current++;
    cleanupAudio();
    finishPlayback();
  }, [cleanupAudio, finishPlayback]);

  const resume = useCallback(() => {
    if (statusRef.current !== "paused") {
      return;
    }

    if (audioRef.current) {
      statusRef.current = "playing";
      setStatus("playing");
      const audio = audioRef.current;
      void audio.play();
      audio.onended = () => {
        const nextPlayable = playableSentences[getPlayableIndex(currentIndexRef.current) + 1];
        if (nextPlayable) {
          currentIndexRef.current = nextPlayable.index;
          void runPlaybackLoop();
        } else {
          finishPlayback();
        }
      };
      return;
    }

    play();
  }, [finishPlayback, getPlayableIndex, play, playableSentences, runPlaybackLoop]);

  const jumpToPlayable = useCallback(
    (playableIndex: number) => {
      const target = playableSentences[playableIndex];
      if (!target) {
        return;
      }

      generationRef.current++;
      cleanupAudio();
      moveTo(target.index);

      if (statusRef.current === "playing") {
        void runPlaybackLoop();
      }
    },
    [cleanupAudio, moveTo, playableSentences, runPlaybackLoop],
  );

  const skipPrevious = useCallback(() => {
    const playableIndex = getPlayableIndex(currentIndexRef.current);
    if (playableIndex > 0) {
      jumpToPlayable(playableIndex - 1);
    }
  }, [getPlayableIndex, jumpToPlayable]);

  const skipNext = useCallback(() => {
    const playableIndex = getPlayableIndex(currentIndexRef.current);
    if (playableIndex < playableSentences.length - 1) {
      jumpToPlayable(playableIndex + 1);
    }
  }, [getPlayableIndex, jumpToPlayable, playableSentences.length]);

  const jumpToSentence = useCallback(
    (sentenceIndex: number) => {
      const playableIndex = playableSentences.findIndex(
        (sentence) => sentence.index >= sentenceIndex,
      );
      if (playableIndex >= 0) {
        jumpToPlayable(playableIndex);
      }
    },
    [jumpToPlayable, playableSentences],
  );

  const seekToFraction = useCallback(
    (fraction: number) => {
      const count = playableSentences.length;
      if (count === 0) {
        return;
      }
      jumpToPlayable(Math.min(Math.floor(fraction * count), count - 1));
    },
    [jumpToPlayable, playableSentences.length],
  );

  useEffect(() => {
    return () => {
      generationRef.current++;
      cleanupAudio();
    };
  }, [cleanupAudio]);

  const currentPlayablePosition = Math.max(getPlayableIndex(currentIndex), 0) + 1;
  const overallProgress =
    playableSentences.length === 0
      ? 0
      : (currentPlayablePosition - 1 + sentenceProgress) / playableSentences.length;

  return {
    status,
    currentIndex,
    currentPlayablePosition,
    overallProgress,
    play,
    pause,
    resume,
    stop,
    skipPrevious,
    skipNext,
    jumpToSentence,
    seekToFraction,
    playableCount: playableSentences.length,
  };
}
