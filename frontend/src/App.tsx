import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchVoices, type VoiceInfo } from "./api/ttsClient";
import {
  MarkdownViewer,
  type MarkdownViewerHandle,
} from "./components/MarkdownViewer";
import { PlayerControls } from "./components/PlayerControls";
import { TableOfContents } from "./components/TableOfContents";
import { TopBar, type SaveState } from "./components/TopBar";
import { FileIcon } from "./components/icons";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
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
  supportsFileHandles,
  writeMarkdownFile,
  type OpenedMarkdown,
} from "./utils/markdownFile";
import type { Sentence } from "./utils/sentenceSplitter";

const VOICE_STORAGE_KEY = "tts-reader-voice";
const SPEED_STORAGE_KEY = "tts-reader-speed";
const VOLUME_STORAGE_KEY = "tts-reader-volume";
const TOC_COLLAPSED_STORAGE_KEY = "tts-reader-toc-collapsed";
const NARROW_SCREEN_QUERY = "(max-width: 900px)";
const DEFAULT_VOICE = "ko-KR-SunHiNeural";
const DEFAULT_SPEED = 2.0;
const DEFAULT_VOLUME = 0.5;

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

export default function App() {
  const viewerRef = useRef<MarkdownViewerHandle>(null);
  const plainMapperRef = useRef<MarkdownPlainMapper | null>(null);
  const fileHandleRef = useRef<FileSystemFileHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>(null);
  const [isTocOpen, setIsTocOpen] = useState(loadTocOpen);
  const [isDragging, setIsDragging] = useState(false);
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
    setError(PLAYBACK_ERROR_MESSAGE);
  }, []);

  const {
    status,
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
    playableCount: playerPlayableCount,
  } = useTtsPlayer({
    sentences,
    voice,
    speed,
    volume: isMuted ? 0 : volume,
    onHighlightChange: setHighlightedIndex,
    onError: handlePlaybackError,
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
      setMarkdownSource(opened.content);
      setHtml(parsed.html);
      setSentences(parsed.sentences);
      setToc(parsed.toc);
      setFileName(opened.name);
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
    if (status === "playing") {
      setError((current) => (current === PLAYBACK_ERROR_MESSAGE ? null : current));
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
        onToggleToc={handleToggleToc}
        onOpenFile={handleOpenFile}
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
          onNavigate={handleTocNavigate}
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

      {isDragging && (
        <div className="drop-overlay" aria-hidden="true">
          <p>여기에 .md 파일을 놓으세요</p>
        </div>
      )}
    </div>
  );
}
