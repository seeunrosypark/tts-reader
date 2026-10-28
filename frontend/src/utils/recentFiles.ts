// 파일 핸들은 localStorage에 넣을 수 없어 IndexedDB에 저장한다 (Chrome·Edge).
const DB_NAME = "tts-reader";
const STORE_NAME = "recent-files";
const LIST_KEY = "list";
const MAX_RECENT_FILES = 10;

export type RecentFile = {
  name: string;
  handle: FileSystemFileHandle;
  openedAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function loadRecentFiles(): Promise<RecentFile[]> {
  try {
    return (await withStore<RecentFile[] | undefined>("readonly", (store) => store.get(LIST_KEY))) ?? [];
  } catch {
    return [];
  }
}

function saveRecentFiles(files: RecentFile[]): Promise<IDBValidKey> {
  return withStore("readwrite", (store) => store.put(files, LIST_KEY));
}

async function withoutEntry(
  files: RecentFile[],
  handle: FileSystemFileHandle,
): Promise<RecentFile[]> {
  const kept: RecentFile[] = [];
  for (const file of files) {
    if (!(await file.handle.isSameEntry(handle))) {
      kept.push(file);
    }
  }
  return kept;
}

/** 목록 맨 앞에 추가한다. 같은 파일은 이름이 같아도 위치가 다르면 별개로 취급한다. */
export async function addRecentFile(handle: FileSystemFileHandle): Promise<RecentFile[]> {
  const rest = await withoutEntry(await loadRecentFiles(), handle);
  const next = [{ name: handle.name, handle, openedAt: Date.now() }, ...rest].slice(
    0,
    MAX_RECENT_FILES,
  );
  await saveRecentFiles(next);
  return next;
}

export async function removeRecentFile(handle: FileSystemFileHandle): Promise<RecentFile[]> {
  const next = await withoutEntry(await loadRecentFiles(), handle);
  await saveRecentFiles(next);
  return next;
}
