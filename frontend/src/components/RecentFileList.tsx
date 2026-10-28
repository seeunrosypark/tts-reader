import type { RecentFile } from "../utils/recentFiles";
import { FileIcon } from "./icons";

type RecentFileListProps = {
  files: RecentFile[];
  onOpen: (file: RecentFile) => void;
};

const relativeTime = new Intl.RelativeTimeFormat("ko", { numeric: "auto" });

function formatOpenedAt(openedAt: number): string {
  const minutes = Math.round((openedAt - Date.now()) / 60_000);
  if (minutes > -60) {
    return relativeTime.format(minutes, "minute");
  }
  const hours = Math.round(minutes / 60);
  if (hours > -24) {
    return relativeTime.format(hours, "hour");
  }
  return relativeTime.format(Math.round(hours / 24), "day");
}

export function RecentFileList({ files, onOpen }: RecentFileListProps) {
  return (
    <ul className="recent-file-list">
      {files.map((file) => (
        <li key={`${file.name}-${file.openedAt}`}>
          <button type="button" onClick={() => onOpen(file)} title={file.name}>
            <FileIcon />
            <span className="recent-file-name">{file.name}</span>
            <span className="recent-file-time">{formatOpenedAt(file.openedAt)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
