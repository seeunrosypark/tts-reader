import type { ReactNode } from "react";

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const PlayIcon = () => (
  <Svg>
    <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
  </Svg>
);

export const PauseIcon = () => (
  <Svg>
    <rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" />
    <rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" />
  </Svg>
);

export const StopIcon = () => (
  <Svg>
    <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" />
  </Svg>
);

export const PrevIcon = () => (
  <Svg>
    <path d="M18 18 9 12l9-6z" fill="currentColor" />
    <path d="M6 6v12" />
  </Svg>
);

export const NextIcon = () => (
  <Svg>
    <path d="m6 18 9-6-9-6z" fill="currentColor" />
    <path d="M18 6v12" />
  </Svg>
);

export const VolumeIcon = () => (
  <Svg>
    <path d="M11 5 6 9H3v6h3l5 4z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    <path d="M18.5 5.5a9 9 0 0 1 0 13" />
  </Svg>
);

export const MuteIcon = () => (
  <Svg>
    <path d="M11 5 6 9H3v6h3l5 4z" />
    <path d="m22 9-6 6" />
    <path d="m16 9 6 6" />
  </Svg>
);

export const SettingsIcon = () => (
  <Svg>
    <path d="M4 7h10" />
    <path d="M18 7h2" />
    <circle cx="16" cy="7" r="2" />
    <path d="M4 17h2" />
    <path d="M10 17h10" />
    <circle cx="8" cy="17" r="2" />
  </Svg>
);

export const TocIcon = () => (
  <Svg>
    <path d="M4 6h16" />
    <path d="M4 12h10" />
    <path d="M4 18h13" />
  </Svg>
);

export const FileIcon = () => (
  <Svg>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </Svg>
);

export const HelpIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6" />
    <path d="M12 17h.01" />
  </Svg>
);
