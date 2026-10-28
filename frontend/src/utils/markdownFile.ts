export type OpenedMarkdown = {
  name: string;
  content: string;
  // 원본에 다시 쓸 수 있는 핸들. 지원하지 않는 브라우저나 <input type="file">로 연 경우 null.
  handle: FileSystemFileHandle | null;
};

const MARKDOWN_EXTENSIONS = [".md", ".markdown"];

const PICKER_TYPES = [
  { description: "Markdown", accept: { "text/markdown": MARKDOWN_EXTENSIONS } },
];

export function isMarkdownFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return MARKDOWN_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

export function supportsFileHandles(): boolean {
  return typeof window.showOpenFilePicker === "function";
}

async function readHandle(handle: FileSystemFileHandle): Promise<OpenedMarkdown> {
  const file = await handle.getFile();
  return { name: file.name, content: await file.text(), handle };
}

/** 최근 파일 목록 등 저장해 둔 핸들을 다시 연다. 브라우저를 다시 켜면 읽기 권한을 다시 묻는다. */
export async function reopenHandle(handle: FileSystemFileHandle): Promise<OpenedMarkdown> {
  const descriptor: FileSystemHandlePermissionDescriptor = { mode: "read" };
  if ((await handle.queryPermission?.(descriptor)) !== "granted") {
    const permission = await handle.requestPermission?.(descriptor);
    if (permission !== "granted") {
      throw new Error("파일을 읽을 권한이 없습니다.");
    }
  }
  return readHandle(handle);
}

export async function readPlainFile(file: File): Promise<OpenedMarkdown> {
  return { name: file.name, content: await file.text(), handle: null };
}

/** 파일 선택 창을 띄운다. 사용자가 취소하면 null. */
export async function pickMarkdownFile(): Promise<OpenedMarkdown | null> {
  try {
    const [handle] = await window.showOpenFilePicker!({
      types: PICKER_TYPES,
      multiple: false,
    });
    return readHandle(handle);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return null;
    }
    throw error;
  }
}

/** drop 이벤트 핸들러 안에서 동기적으로 호출해야 한다 (await 이후엔 DataTransfer가 비워진다). */
export function readDroppedMarkdown(
  dataTransfer: DataTransfer,
): Promise<OpenedMarkdown | null> | null {
  const item = Array.from(dataTransfer.items).find((entry) => entry.kind === "file");
  const file = item?.getAsFile();
  if (!item || !file || !isMarkdownFileName(file.name)) {
    return null;
  }

  const handlePromise = item.getAsFileSystemHandle?.() ?? null;

  return (async () => {
    const handle = await handlePromise?.catch(() => null);
    if (handle instanceof FileSystemFileHandle) {
      return readHandle(handle);
    }
    return readPlainFile(file);
  })();
}

export async function writeMarkdownFile(
  handle: FileSystemFileHandle,
  content: string,
): Promise<void> {
  const descriptor: FileSystemHandlePermissionDescriptor = { mode: "readwrite" };
  if ((await handle.queryPermission?.(descriptor)) !== "granted") {
    const permission = await handle.requestPermission?.(descriptor);
    if (permission !== "granted") {
      throw new Error("원본 파일에 쓸 권한이 없습니다.");
    }
  }

  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}
