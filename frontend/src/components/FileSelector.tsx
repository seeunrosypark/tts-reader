import type { BookFile } from "../api/ttsClient";

type FileSelectorProps = {
  files: BookFile[];
  bookDir: string | null;
  selectedFile: string | null;
  onSelectPreset: (filename: string) => void;
  onSelectLocalFile: (file: File) => void;
};

export function FileSelector({
  files,
  bookDir,
  selectedFile,
  onSelectPreset,
  onSelectLocalFile,
}: FileSelectorProps) {
  return (
    <section className="file-selector">
      <div className="control-row">
        <label htmlFor="preset-select">폴더 내 파일</label>
        <select
          id="preset-select"
          value={selectedFile ?? ""}
          onChange={(event) => {
            if (event.target.value) {
              onSelectPreset(event.target.value);
            }
          }}
        >
          <option value="">
            {files.length > 0 ? "선택하세요" : "폴더에 .md 파일이 없습니다"}
          </option>
          {files.map((file) => (
            <option key={file.name} value={file.name}>
              {file.name}
            </option>
          ))}
        </select>
      </div>

      {bookDir ? (
        <p className="file-selector-hint">읽기 폴더: {bookDir}</p>
      ) : null}

      <div className="control-row">
        <label htmlFor="local-file">로컬 파일</label>
        <input
          id="local-file"
          type="file"
          accept=".md,text/markdown"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              onSelectLocalFile(file);
            }
          }}
        />
      </div>
    </section>
  );
}
