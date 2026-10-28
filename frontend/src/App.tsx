import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  fetchBookFileContent,
  fetchBookFiles,
  fetchReaderConfig,
  fetchVoices,
  saveBookFileContent,
  type BookFile,
  type VoiceInfo,
} from "./api/ttsClient";
import { FileSelector } from "./components/FileSelector";
import {
  MarkdownViewer,
  type MarkdownViewerHandle,
} from "./components/MarkdownViewer";
import { PlayerControls } from "./components/PlayerControls";
import { StickySectionHeading } from "./components/StickySectionHeading";
import { TableOfContents } from "./components/TableOfContents";
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
import type { Sentence } from "./utils/sentenceSplitter";

const VOICE_STORAGE_KEY = "tts-reader-voice";
const SPEED_STORAGE_KEY = "tts-reader-speed";
const VOLUME_STORAGE_KEY = "tts-reader-volume";
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

export default function App() {
  const viewerRef = useRef<MarkdownViewerHandle>(null);
  const plainMapperRef = useRef<MarkdownPlainMapper | null>(null);
  const [files, setFiles] = useState<BookFile[]>([]);
  const [bookDir, setBookDir] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isServerFile, setIsServerFile] = useState(true);
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
    (markdown: string, filename: string | null, fromServer: boolean) => {
      stop();
      plainMapperRef.current = createMarkdownPlainMapper(markdown);
      const parsed = parseLocalMarkdown(markdown);
      setMarkdownSource(markdown);
      setHtml(parsed.html);
      setSentences(parsed.sentences);
      setToc(parsed.toc);
      setSelectedFile(filename);
      setIsServerFile(fromServer);
      setHighlightedIndex(null);
      setError(null);
    },
    [stop],
  );

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

    try {
      if (isServerFile && selectedFile) {
        await saveBookFileContent(selectedFile, nextMarkdown);
      }
      applyParsedMarkdown(nextMarkdown, preserveHighlight);
      window.getSelection()?.removeAllRanges();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "마크다운 저장에 실패했습니다.",
      );
    }
  }, [
    applyParsedMarkdown,
    highlightedIndex,
    isServerFile,
    markdownSource,
    selectedFile,
  ]);

  useKeyboardShortcuts({
    onPlayToggle: handlePlayToggle,
    onBoldSelection: () => {
      void handleBoldSelection();
    },
  });

  useEffect(() => {
    async function bootstrap() {
      try {
        const [bookFiles, voiceList, config] = await Promise.all([
          fetchBookFiles(),
          fetchVoices("ko-KR"),
          fetchReaderConfig(),
        ]);
        setFiles(bookFiles);
        setBookDir(config.bookDir);
        setVoices(voiceList);

        const startupFile = config.defaultFile
          ? bookFiles.find((file) => file.name === config.defaultFile)
          : null;
        if (startupFile) {
          const content = await fetchBookFileContent(startupFile.name);
          loadMarkdown(content, startupFile.name, true);
        }
      } catch (bootstrapError) {
        setError(
          bootstrapError instanceof Error
            ? bootstrapError.message
            : "초기화에 실패했습니다.",
        );
      }
    }

    void bootstrap();
  }, [loadMarkdown]);

  const activeTocId = useMemo(
    () => findActiveTocItem(toc, highlightedIndex),
    [toc, highlightedIndex],
  );

  const activeHeading = useMemo(
    () => toc.find((item) => item.id === activeTocId) ?? null,
    [activeTocId, toc],
  );

  const handleSelectPreset = async (filename: string) => {
    try {
      const content = await fetchBookFileContent(filename);
      loadMarkdown(content, filename, true);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "파일을 불러오지 못했습니다.",
      );
    }
  };

  const handleSelectLocalFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      loadMarkdown(String(reader.result ?? ""), file.name, false);
    };
    reader.onerror = () => {
      setError("로컬 파일을 읽지 못했습니다.");
    };
    reader.readAsText(file, "utf-8");
  };

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
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Markdown TTS Reader</h1>
        <p>
          마크다운 원고를 문장 단위로 하이라이트하며 읽어줍니다.{" "}
          <span className="shortcut-hint">
            문장 클릭: 그 문장부터 재생 · Space: 재생/일시정지 · 드래그 선택 후 Ctrl+B: **bold** 토글
          </span>
        </p>
      </header>

      <FileSelector
        files={files}
        bookDir={bookDir}
        selectedFile={selectedFile}
        onSelectPreset={handleSelectPreset}
        onSelectLocalFile={handleSelectLocalFile}
      />

      <div className="app-layout">
        <TableOfContents
          toc={toc}
          activeId={activeTocId}
          onNavigate={handleTocNavigate}
        />

        <main className="app-main">
          <div className="reader-sticky-header">
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
              onPlay={handlePlay}
              onPause={pause}
              onResume={resume}
              onStop={stop}
              onSkipPrevious={skipPrevious}
              onSkipNext={skipNext}
              onSpeedChange={handleSpeedChange}
              onVolumeChange={handleVolumeChange}
              onVoiceChange={handleVoiceChange}
              onSeek={seekToFraction}
              onToggleMute={() => setIsMuted((muted) => !muted)}
              resolvePlayStartIndex={resolvePlayStartIndex}
            />
            <StickySectionHeading heading={activeHeading} />
          </div>

          {error && <p className="error-message">{error}</p>}

          {html ? (
            <MarkdownViewer
              ref={viewerRef}
              html={html}
              highlightedIndex={highlightedIndex}
              onSentenceClick={handleSentenceClick}
            />
          ) : (
            <p className="placeholder">마크다운 파일을 선택하세요.</p>
          )}
        </main>
      </div>
    </div>
  );
}
