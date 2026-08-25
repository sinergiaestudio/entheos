import type { ReactNode } from "react";

export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10M9 20v-6h6v6"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    timeline: <><path d="M7 4v16M7 7h10M7 12h7M7 17h9"/><circle cx="7" cy="7" r="1.5"/><circle cx="7" cy="12" r="1.5"/><circle cx="7" cy="17" r="1.5"/></>,
    document: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></>,
    menu: <><path d="M5 7h14M5 12h14M5 17h14"/></>,
    moon: <path d="M19 15.5A8 8 0 0 1 8.5 5 8 8 0 1 0 19 15.5Z"/>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    weight: <><path d="M5 7a7 7 0 0 1 14 0v13H5Z"/><path d="M9 9a3 3 0 0 1 6 0M12 9l2-2"/></>,
    heart: <path d="M20.8 5.9c-1.5-2.3-4.8-2.5-6.8-.5L12 7.3l-2-2c-2-2-5.3-1.8-6.8.5-1.2 1.9-.8 4.4.8 6l8 7.7 8-7.7c1.6-1.5 2-4 .8-5.9Z"/>,
    activity: <><path d="M4 15h3l2-6 4 10 2-7h5"/><circle cx="18" cy="5" r="2"/></>,
    nutrition: <><path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M16 3v18M16 3c4 2 4 7 0 9"/></>,
    upload: <><path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 14v6h14v-6"/></>,
    shield: <><path d="M12 3 5 6v5c0 4.7 2.9 8.1 7 10 4.1-1.9 7-5.3 7-10V6Z"/><path d="m9 12 2 2 4-5"/></>,
    spark: <><path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4Z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7Z"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    download: <><path d="M12 4v12M7 11l5 5 5-5"/><path d="M5 20h14"/></>,
  };
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name] || paths.menu}
    </svg>
  );
}
