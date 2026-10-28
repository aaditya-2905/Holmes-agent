import type { JSX } from "preact";

type P = JSX.SVGAttributes<SVGSVGElement>;

const base = (d: JSX.Element, p: P) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    {...p}
  >
    {d}
  </svg>
);

export const IconPlus = (p: P) => base(<path d="M12 5v14M5 12h14" />, p);
export const IconSend = (p: P) => base(<path d="M5 12h14M13 6l6 6-6 6" />, p);
export const IconStop = (p: P) => base(<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />, p);
export const IconMenu = (p: P) => base(<path d="M4 7h16M4 12h16M4 17h16" />, p);
export const IconClose = (p: P) => base(<path d="M6 6l12 12M18 6 6 18" />, p);
export const IconTrash = (p: P) => base(<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />, p);
export const IconChevron = (p: P) => base(<path d="m9 6 6 6-6 6" />, p);
export const IconCopy = (p: P) =>
  base(
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </>,
    p,
  );
export const IconCheck = (p: P) => base(<path d="m5 12 5 5 9-10" />, p);
export const IconSun = (p: P) =>
  base(
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>,
    p,
  );
export const IconMoon = (p: P) => base(<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />, p);
export const IconLayers = (p: P) => base(<path d="m12 3 9 5-9 5-9-5 9-5zM3 13l9 5 9-5" />, p);
export const IconCpu = (p: P) =>
  base(
    <>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
    </>,
    p,
  );
export const IconNet = (p: P) =>
  base(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </>,
    p,
  );
export const IconAlert = (p: P) => base(<path d="M12 3 2 20h20L12 3zM12 10v4M12 17h.01" />, p);
export const IconBox = (p: P) => base(<path d="m21 8-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8" />, p);
export const IconDisk = (p: P) =>
  base(
    <>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </>,
    p,
  );
export const IconPulse = (p: P) => base(<path d="M3 12h4l3-8 4 16 3-8h4" />, p);
export const IconShield = (p: P) => base(<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z" />, p);

export const Logo = () => (
  <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
    <defs>
      <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="var(--accent)" />
        <stop offset="1" stop-color="var(--accent-2)" />
      </linearGradient>
    </defs>
    <circle cx="14" cy="14" r="7" fill="none" stroke="url(#lg)" stroke-width="3" />
    <path d="M19.5 19.5 25 25" stroke="url(#lg)" stroke-width="3.2" stroke-linecap="round" />
    <path
      d="M10.5 14h2l1-2.5 2 5 1-2.5h1.5"
      fill="none"
      stroke="var(--accent)"
      stroke-width="1.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
);
