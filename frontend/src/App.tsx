import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { generateQuiz, type Quiz } from "./api/quizClient";
import { fetchVoices, type VoiceInfo } from "./api/ttsClient";
import {
  MarkdownViewer,
  type MarkdownViewerHandle,
} from "./components/MarkdownViewer";
import { PlayerControls } from "./components/PlayerControls";
import { QuizDialog, type QuizState } from "./components/QuizDialog";
import { TableOfContents } from "./components/TableOfContents";
import { RecentFileList } from "./components/RecentFileList";
import { StatsDialog } from "./components/StatsDialog";
import { Toasts, type Toast } from "./components/Toasts";
import { TopBar, type SaveState } from "./components/TopBar";
import { FileIcon } from "./components/icons";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useMediaSession } from "./hooks/useMediaSession";
import { useReadingStats } from "./hooks/useReadingStats";
import { applyQuizResult, chapterCoverage, levelFromXp, XP, type Reward } from "./utils/achievements";
import { useTheme } from "./hooks/useTheme";
import { useTtsPlayer } from "./hooks/useTtsPlayer";
import { toggleBoldInMarkdown } from "./utils/markdownBold";
import {
  findActiveTocItem,
  parseLocalMarkdown,
  type TocItem,
} from "./utils/markdownToSentences";
import {
  createMarkdownPlainMapper,
  findPlainRangeForSelection,
  type MarkdownPlainMapper,
} from "./utils/markdownPlainMapper";
import {
  isMarkdownFileName,
  pickMarkdownFile,
  readDroppedMarkdown,
  readPlainFile,
  reopenHandle,
  supportsFileHandles,
  writeMarkdownFile,
  type OpenedMarkdown,
} from "./utils/markdownFile";
import { findReadingPosition, saveReadingPosition } from "./utils/readingPositions";
import { chapterText, computeReadingProgress, listChapters, type Chapter } from "./utils/readingProgress";
import {
  addSpeechSample,
  charsPerSecond,
  isMeasured,
  loadSpeechRates,
  saveSpeechRates,
} from "./utils/speechRate";
import { computeStreak } from "./utils/readingStats";
import {
  addRecentFile,
  loadRecentFiles,
  removeRecentFile,
  type RecentFile,
} from "./utils/recentFiles";
import type { Sentence } from "./utils/sentenceSplitter";

const VOICE_STORAGE_KEY = "tts-reader-voice";
const SPEED_STORAGE_KEY = "tts-reader-speed";
const VOLUME_STORAGE_KEY = "tts-reader-volume";
const TOC_COLLAPSED_STORAGE_KEY = "tts-reader-toc-collapsed";
const NARROW_SCREEN_QUERY = "(max-width: 900px)";
const DEFAULT_VOICE = "ko-KR-SunHiNeural";
const DEFAULT_SPEED = 2.0;
const DEFAULT_VOLUME = 0.5;
// 백엔드 /api/quiz가 받는 본문 길이와 맞춘다.
const QUIZ_MIN_TEXT_LENGTH = 200;
const QUIZ_MAX_TEXT_LENGTH = 200_000;

function loadStoredVoice(): string {
  return localStorage.getItem(VOICE_STORAGE_KEY) ?? DEFAULT_VOICE;
}

function loadStoredSpeed(): number {
  const value = Number(localStorage.getItem(SPEED_STORAGE_KEY));
  return Number.isFinite(value) && value >= 0.5 && value <= 4 ? value : DEFAULT_SPEED;
}

function loadStoredVolume(): number {
  const stored = localStorage.getItem(VOLUME_STORAGE_KEY);
  if (stored === null) {
    return DEFAULT_VOLUME;
  }
  const value = Number(stored);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : DEFAULT_VOLUME;
}

function isNarrowScreen(): boolean {
  return window.matchMedia(NARROW_SCREEN_QUERY).matches;
}

function loadTocOpen(): boolean {
  return !isNarrowScreen() && localStorage.getItem(TOC_COLLAPSED_STORAGE_KEY) !== "true";
}

const PLAYBACK_ERROR_MESSAGE =
  "음성을 받아 오지 못해 일시정지했습니다. 백엔드와 인터넷 연결을 확인한 뒤 다시 재생하세요.";
const AUTOPLAY_BLOCKED_MESSAGE =
  "브라우저가 자동 재생을 막아 일시정지했습니다. 재생 버튼을 눌러 주세요.";

export default function App() {
  const viewerRef = useRef<MarkdownViewerHandle>(null);
  const plainMapperRef = useRef<MarkdownPlainMapper | null>(null);
  const fileHandleRef = useRef<FileSystemFileHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 파일을 연 직후 문장 목록이 반영되면 마지막으로 읽던 위치로 옮긴다.
  const pendingResumeRef = useRef(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>(null);
  const [isTocOpen, setIsTocOpen] = useState(loadTocOpen);
  const [isDragging, setIsDragging] = useState(false);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const { theme, toggleTheme } = useTheme();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const nextToastIdRef = useRef(0);
  const [quizTarget, setQuizTarget] = useState<{ fileName: string; chapter: Chapter } | null>(null);
  const [quizState, setQuizState] = useState<QuizState>({ status: "loading" });
  // 같은 장을 다시 열 때 API를 또 부르지 않도록 이번 세션 동안 문제를 기억한다.
  const quizCacheRef = useRef(new Map<string, Quiz>());
  const quizAbortRef = useRef<AbortController | null>(null);
  // 장 완료 알림에서 바로 퀴즈를 열 때 쓴다 (아래에서 채운다).
  const openQuizByTitleRef = useRef<(title: string) => void>(() => {});

  const pushToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = ++nextToastIdRef.current;
    setToasts((current) => [...current, { ...toast, id }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const handleReward = useCallback(
    (reward: Reward) => {
      switch (reward.type) {
        case "goal-reached":
          pushToast({
            icon: "🎯",
            title: "오늘의 목표 달성!",
            detail:
              reward.streak > 1 ? `🔥 ${reward.streak}일 연속` : "내일도 이어서 연속 기록을 만들어 보세요",
            celebrate: true,
          });
          break;
        case "chapter-complete":
          pushToast({
            icon: "🏆",
            title: `${reward.title} 완료!`,
            detail: "정독했는지 퀴즈로 확인해 볼까요?",
            celebrate: true,
            action: { label: "퀴즈 풀기", onClick: () => openQuizByTitleRef.current(reward.title) },
          });
          break;
        case "book-complete":
          pushToast({ icon: "📚", title: "완독했습니다!", detail: reward.fileName, celebrate: true });
          break;
        case "level-up":
          pushToast({ icon: "⬆️", title: `레벨 ${reward.level} 달성!`, celebrate: true });
          break;
        case "badge":
          pushToast({ icon: reward.badge.icon, title: `배지 획득: ${reward.badge.name}`, detail: reward.badge.description });
          break;
        case "quiz-perfect":
          pushToast({ icon: "🧠", title: `${reward.title} 퀴즈 만점!`, detail: `+${XP.quizPerfect} XP`, celebrate: true });
          break;
      }
    },
    [pushToast],
  );

  const { stats, recordListening, applyChange, setGoalMinutes } = useReadingStats(handleReward);
  // 문장이 끝날 때 최신 파일·문장·목차·속도로 기록하도록 ref로 들고 있는다.
  const listenContextRef = useRef<{
    fileName: string | null;
    sentences: Sentence[];
    toc: TocItem[];
    speed: number;
    voice: string;
  }>({ fileName: null, sentences: [], toc: [], speed: 1, voice: DEFAULT_VOICE });
  // 남은 시간 계산용: 음성마다 1배속에서 1초에 읽는 글자 수를 실제로 들은 문장으로 학습한다.
  const [speechRates, setSpeechRates] = useState(loadSpeechRates);
  const handleSentenceListened = useCallback(
    (sentence: Sentence, seconds: number) => {
      const { voice, speed: playedSpeed } = listenContextRef.current;
      setSpeechRates((current) => {
        const next = addSpeechSample(current, voice, sentence.text.length, seconds * playedSpeed);
        saveSpeechRates(next);
        return next;
      });
      recordListening({ ...listenContextRef.current, sentence, seconds });
    },
    [recordListening],
  );
  const [markdownSource, setMarkdownSource] = useState("");
  const [html, setHtml] = useState("");
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [voice, setVoice] = useState(loadStoredVoice);
  const [speed, setSpeed] = useState(loadStoredSpeed);
  const [volume, setVolume] = useState(loadStoredVolume);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePlaybackError = useCallback((playbackError: unknown) => {
    console.error(playbackError);
    const isAutoplayBlocked =
      playbackError instanceof DOMException && playbackError.name === "NotAllowedError";
    setError(isAutoplayBlocked ? AUTOPLAY_BLOCKED_MESSAGE : PLAYBACK_ERROR_MESSAGE);
  }, []);

  const {
    status,
    currentIndex,
    currentPlayablePosition,
    sentenceProgress,
    overallProgress,
    play,
    pause,
    resume,
    stop,
    skipPrevious,
    skipNext,
    jumpToSentence,
    seekToFraction,
    playableCount: playerPlayableCount,
  } = useTtsPlayer({
    sentences,
    voice,
    speed,
    volume: isMuted ? 0 : volume,
    onHighlightChange: setHighlightedIndex,
    onError: handlePlaybackError,
    onSentenceListened: handleSentenceListened,
  });

  const applyParsedMarkdown = useCallback(
    (markdown: string, preserveHighlightIndex: number | null) => {
      plainMapperRef.current = createMarkdownPlainMapper(markdown);
      const parsed = parseLocalMarkdown(markdown);
      setMarkdownSource(markdown);
      setHtml(parsed.html);
      setSentences(parsed.sentences);
      setToc(parsed.toc);

      if (preserveHighlightIndex === null) {
        setHighlightedIndex(null);
        return;
      }

      const previousSentence = sentences.find(
        (sentence) => sentence.index === preserveHighlightIndex,
      );
      if (!previousSentence) {
        setHighlightedIndex(preserveHighlightIndex);
        return;
      }

      const matched = parsed.sentences.find(
        (sentence) => sentence.text === previousSentence.text && !sentence.skip,
      );
      setHighlightedIndex(matched?.index ?? preserveHighlightIndex);
    },
    [sentences],
  );

  const loadMarkdown = useCallback(
    (opened: OpenedMarkdown) => {
      stop();
      plainMapperRef.current = createMarkdownPlainMapper(opened.content);
      const parsed = parseLocalMarkdown(opened.content);
      fileHandleRef.current = opened.handle;
      pendingResumeRef.current = true;
      setMarkdownSource(opened.content);
      setHtml(parsed.html);
      setSentences(parsed.sentences);
      setToc(parsed.toc);
      setFileName(opened.name);
      if (opened.handle) {
        addRecentFile(opened.handle).then(setRecentFiles, () => {});
      }
      setSaveState(null);
      setHighlightedIndex(null);
      setError(null);
      window.scrollTo({ top: 0 });
    },
    [stop],
  );

  const showError = useCallback(
    (fallback: string) => (caught: unknown) => {
      setError(caught instanceof Error ? caught.message : fallback);
    },
    [],
  );

  const handleOpenFile = useCallback(() => {
    if (!supportsFileHandles()) {
      fileInputRef.current?.click();
      return;
    }
    pickMarkdownFile()
      .then((opened) => opened && loadMarkdown(opened))
      .catch(showError("파일을 열지 못했습니다."));
  }, [loadMarkdown, showError]);

  const handleOpenRecent = useCallback(
    (file: RecentFile) => {
      reopenHandle(file.handle)
        .then(loadMarkdown)
        .catch((openError: unknown) => {
          // 옮겨지거나 삭제된 파일은 목록에서 뺀다.
          if (openError instanceof DOMException && openError.name === "NotFoundError") {
            removeRecentFile(file.handle).then(setRecentFiles, () => {});
            setError(`'${file.name}' 파일을 찾을 수 없어 최근 목록에서 뺐습니다.`);
            return;
          }
          showError("파일을 열지 못했습니다.")(openError);
        });
    },
    [loadMarkdown, showError],
  );

  useEffect(() => {
    if (supportsFileHandles()) {
      void loadRecentFiles().then(setRecentFiles);
    }
  }, []);

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const pending = readDroppedMarkdown(event.dataTransfer);
    if (!pending) {
      setError(".md 파일만 열 수 있습니다.");
      return;
    }
    pending
      .then((opened) => opened && loadMarkdown(opened))
      .catch(showError("파일을 열지 못했습니다."));
  };

  const handlePlay = useCallback(
    (startSentenceIndex?: number) => {
      if (playerPlayableCount === 0) {
        return;
      }
      play(startSentenceIndex);
    },
    [play, playerPlayableCount],
  );

  const resolvePlayStartIndex = useCallback(() => {
    const index = viewerRef.current?.getSelectionSentenceIndex();
    return index ?? undefined;
  }, []);

  const handlePlayToggle = useCallback(() => {
    if (playerPlayableCount === 0) {
      return;
    }
    if (status === "playing") {
      pause();
      return;
    }
    if (status === "paused") {
      resume();
      return;
    }

    const selectionSentenceIndex = resolvePlayStartIndex();
    handlePlay(selectionSentenceIndex);
  }, [handlePlay, pause, playerPlayableCount, resolvePlayStartIndex, resume, status]);

  const handleBoldSelection = useCallback(async () => {
    const selectionRange = viewerRef.current?.getSelectionPlainRange();
    const mapper = plainMapperRef.current;

    if (!selectionRange || !mapper || !markdownSource) {
      return;
    }

    const resolvedRange =
      findPlainRangeForSelection(
        mapper.plainText,
        selectionRange.text,
        selectionRange.start,
      ) ?? selectionRange;

    const { mdStart, mdEnd } = mapper.toMarkdownRange(
      resolvedRange.start,
      resolvedRange.end,
    );

    if (mdEnd <= mdStart) {
      return;
    }

    const nextMarkdown = toggleBoldInMarkdown(markdownSource, mdStart, mdEnd);
    if (nextMarkdown === markdownSource) {
      return;
    }

    const preserveHighlight = highlightedIndex;
    const handle = fileHandleRef.current;

    try {
      if (handle) {
        setSaveState("saving");
        await writeMarkdownFile(handle, nextMarkdown);
      }
      applyParsedMarkdown(nextMarkdown, preserveHighlight);
      setSaveState(handle ? "saved" : "memory-only");
      window.getSelection()?.removeAllRanges();
    } catch (saveError) {
      setSaveState(null);
      showError("원본 파일 저장에 실패했습니다.")(saveError);
    }
  }, [applyParsedMarkdown, highlightedIndex, markdownSource, showError]);

  useKeyboardShortcuts({
    onPlayToggle: handlePlayToggle,
    onBoldSelection: () => {
      void handleBoldSelection();
    },
  });

  useEffect(() => {
    fetchVoices("ko-KR")
      .then(setVoices)
      .catch(showError("음성 목록을 불러오지 못했습니다. 백엔드가 실행 중인지 확인하세요."));
  }, [showError]);

  useEffect(() => {
    if (!pendingResumeRef.current || !fileName) {
      return;
    }
    pendingResumeRef.current = false;
    const resumeIndex = findReadingPosition(fileName, sentences);
    if (resumeIndex !== null) {
      jumpToSentence(resumeIndex);
    }
  }, [fileName, jumpToSentence, sentences]);

  useEffect(() => {
    if (highlightedIndex === null || !fileName || pendingResumeRef.current) {
      return;
    }
    const sentence = sentences.find((item) => item.index === highlightedIndex);
    if (sentence && !sentence.skip) {
      saveReadingPosition(fileName, sentence);
    }
  }, [fileName, highlightedIndex, sentences]);

  useEffect(() => {
    if (status === "playing") {
      setError((current) =>
        current === PLAYBACK_ERROR_MESSAGE || current === AUTOPLAY_BLOCKED_MESSAGE ? null : current,
      );
    }
  }, [status]);

  const activeTocId = useMemo(
    () => findActiveTocItem(toc, highlightedIndex),
    [toc, highlightedIndex],
  );

  const activeHeading = useMemo(
    () => toc.find((item) => item.id === activeTocId) ?? null,
    [activeTocId, toc],
  );

  const handleVoiceChange = (nextVoice: string) => {
    setVoice(nextVoice);
    localStorage.setItem(VOICE_STORAGE_KEY, nextVoice);
  };

  useMediaSession({
    status,
    title: activeHeading?.text ?? fileName,
    album: fileName,
    onPlay: () => (status === "paused" ? resume() : handlePlay()),
    onPause: pause,
    onStop: stop,
    onPrevious: skipPrevious,
    onNext: skipNext,
  });

  useEffect(() => {
    listenContextRef.current = { fileName, sentences, toc, speed, voice };
  }, [fileName, sentences, speed, toc, voice]);

  const chapterStatus = useMemo(() => {
    const heard = (fileName && stats.heard[fileName]) || [];
    const completed = (fileName && stats.completedChapters[fileName]) || {};
    const quizzes = (fileName && stats.quizzes[fileName]) || {};
    return Object.fromEntries(
      listChapters(toc).map((chapter) => [
        chapter.id,
        {
          coverage: chapterCoverage(chapter, sentences, heard),
          isComplete: Boolean(completed[chapter.title]),
          quiz: quizzes[chapter.title],
        },
      ]),
    );
  }, [fileName, sentences, stats.completedChapters, stats.heard, stats.quizzes, toc]);

  const loadQuiz = useCallback((target: { fileName: string; chapter: Chapter }, forceNew: boolean) => {
    quizAbortRef.current?.abort();
    const cacheKey = `${target.fileName}\n${target.chapter.title}`;
    const cached = quizCacheRef.current.get(cacheKey);
    if (cached && !forceNew) {
      setQuizState({ status: "ready", quiz: cached });
      return;
    }

    const text = chapterText(target.chapter, listenContextRef.current.sentences);
    if (text.length < QUIZ_MIN_TEXT_LENGTH) {
      setQuizState({ status: "error", message: "본문이 너무 짧아 퀴즈를 만들 수 없어요." });
      return;
    }
    if (text.length > QUIZ_MAX_TEXT_LENGTH) {
      setQuizState({ status: "error", message: "장이 너무 길어 한 번에 퀴즈를 만들 수 없어요." });
      return;
    }

    const controller = new AbortController();
    quizAbortRef.current = controller;
    setQuizState({ status: "loading" });
    generateQuiz(target.chapter.title, text, controller.signal)
      .then((quiz) => {
        quizCacheRef.current.set(cacheKey, quiz);
        if (!controller.signal.aborted) {
          setQuizState({ status: "ready", quiz });
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setQuizState({ status: "error", message: err instanceof Error ? err.message : String(err) });
        }
      });
  }, []);

  const openQuiz = useCallback(
    (chapter: Chapter | undefined) => {
      if (!fileName || !chapter) {
        return;
      }
      const target = { fileName, chapter };
      setQuizTarget(target);
      loadQuiz(target, false);
    },
    [fileName, loadQuiz],
  );

  const closeQuiz = useCallback(() => {
    quizAbortRef.current?.abort();
    setQuizTarget(null);
  }, []);

  useEffect(() => {
    openQuizByTitleRef.current = (title) => openQuiz(listChapters(toc).find((chapter) => chapter.title === title));
  }, [openQuiz, toc]);

  // 다른 파일을 열면 이전 파일의 퀴즈는 닫는다.
  useEffect(() => closeQuiz, [fileName, closeQuiz]);

  const handleQuizSubmit = useCallback(
    (correct: number, total: number) => {
      if (!quizTarget) {
        return;
      }
      applyChange((current) =>
        applyQuizResult(current, {
          fileName: quizTarget.fileName,
          chapterTitle: quizTarget.chapter.title,
          correct,
          total,
          now: new Date(),
        }),
      );
    },
    [applyChange, quizTarget],
  );

  const now = new Date();
  const streak = computeStreak(stats, now);

  const readingProgress = useMemo(
    () => computeReadingProgress(sentences, toc, currentIndex, sentenceProgress),
    [currentIndex, sentenceProgress, sentences, toc],
  );

  const handleSpeedChange = (nextSpeed: number) => {
    setSpeed(nextSpeed);
    localStorage.setItem(SPEED_STORAGE_KEY, String(nextSpeed));
  };

  const handleVolumeChange = (nextVolume: number) => {
    setVolume(nextVolume);
    setIsMuted(false);
    localStorage.setItem(VOLUME_STORAGE_KEY, String(nextVolume));
  };

  const handleSentenceClick = (sentenceIndex: number) => {
    if (status === "playing") {
      jumpToSentence(sentenceIndex);
      return;
    }
    handlePlay(sentenceIndex);
  };

  const handleTocNavigate = (item: TocItem) => {
    viewerRef.current?.scrollToHeading(item.id);
    jumpToSentence(item.sentenceIndex);
    if (isNarrowScreen()) {
      setIsTocOpen(false);
    }
  };

  const handleToggleToc = () => {
    setIsTocOpen((open) => {
      if (!isNarrowScreen()) {
        localStorage.setItem(TOC_COLLAPSED_STORAGE_KEY, String(open));
      }
      return !open;
    });
  };

  const hasToc = toc.length > 0;

  return (
    <div
      className="app"
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsDragging(false);
        }
      }}
      onDrop={handleDrop}
    >
      <TopBar
        fileName={fileName}
        saveState={saveState}
        isTocOpen={isTocOpen && hasToc}
        hasToc={hasToc}
        recentFiles={recentFiles}
        theme={theme}
        streak={streak}
        level={levelFromXp(stats.xp)}
        onOpenStats={() => setIsStatsOpen(true)}
        onToggleTheme={toggleTheme}
        onToggleToc={handleToggleToc}
        onOpenFile={handleOpenFile}
        onOpenRecent={handleOpenRecent}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,text/markdown"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) {
            return;
          }
          if (!isMarkdownFileName(file.name)) {
            setError(".md 파일만 열 수 있습니다.");
            return;
          }
          readPlainFile(file)
            .then(loadMarkdown)
            .catch(showError("파일을 읽지 못했습니다."));
        }}
      />

      <div className="app-layout">
        {hasToc && isTocOpen && (
          <div
            className="toc-backdrop"
            aria-hidden="true"
            onClick={() => setIsTocOpen(false)}
          />
        )}
        <TableOfContents
          toc={toc}
          activeId={activeTocId}
          isOpen={isTocOpen && hasToc}
          chapterStatus={chapterStatus}
          onNavigate={handleTocNavigate}
          onStartQuiz={(tocId) => openQuiz(listChapters(toc).find((chapter) => chapter.id === tocId))}
        />

        <main className="app-main">
          {error && (
            <p className="error-message" role="alert">
              <span>{error}</span>
              <button type="button" aria-label="닫기" onClick={() => setError(null)}>
                ×
              </button>
            </p>
          )}

          {html ? (
            <MarkdownViewer
              ref={viewerRef}
              html={html}
              highlightedIndex={highlightedIndex}
              onSentenceClick={handleSentenceClick}
            />
          ) : (
            <section className="empty-state">
              <FileIcon />
              <h2>마크다운 파일을 열어 주세요</h2>
              <p>파일을 이 창에 끌어다 놓거나 아래 버튼을 누르세요.</p>
              <button type="button" className="primary-button" onClick={handleOpenFile}>
                파일 열기
              </button>
              {recentFiles.length > 0 && (
                <div className="empty-state-recent">
                  <p className="popover-title">최근 파일</p>
                  <RecentFileList files={recentFiles} onOpen={handleOpenRecent} />
                </div>
              )}
            </section>
          )}
        </main>
      </div>

      <PlayerControls
        status={status}
        speed={speed}
        volume={volume}
        voice={voice}
        voices={voices}
        playableCount={playerPlayableCount}
        currentPlayablePosition={currentPlayablePosition}
        overallProgress={overallProgress}
        readingProgress={readingProgress}
        charsPerSecond={charsPerSecond(speechRates, voice)}
        isSpeechRateMeasured={isMeasured(speechRates, voice)}
        isMuted={isMuted}
        activeHeading={activeHeading}
        onPlayToggle={handlePlayToggle}
        onStop={stop}
        onSkipPrevious={skipPrevious}
        onSkipNext={skipNext}
        onSpeedChange={handleSpeedChange}
        onVolumeChange={handleVolumeChange}
        onVoiceChange={handleVoiceChange}
        onSeek={seekToFraction}
        onToggleMute={() => setIsMuted((muted) => !muted)}
      />

      {isStatsOpen && (
        <StatsDialog
          stats={stats}
          onClose={() => setIsStatsOpen(false)}
          onGoalMinutesChange={setGoalMinutes}
        />
      )}

      {quizTarget && (
        <QuizDialog
          chapterTitle={quizTarget.chapter.title}
          state={quizState}
          bestRecord={stats.quizzes[quizTarget.fileName]?.[quizTarget.chapter.title]}
          onSubmit={handleQuizSubmit}
          onRegenerate={() => loadQuiz(quizTarget, true)}
          onClose={closeQuiz}
        />
      )}

      <Toasts toasts={toasts} onDismiss={dismissToast} />

      {isDragging && (
        <div className="drop-overlay" aria-hidden="true">
          <p>여기에 .md 파일을 놓으세요</p>
        </div>
      )}
    </div>
  );
}
