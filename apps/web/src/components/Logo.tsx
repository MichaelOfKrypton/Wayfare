import { useId } from 'react';

/**
 * Wayfare mark: a solid-white compass on a navy tile. The tile has a gentle
 * navy gradient and a light edge so it stays crisp on the dark gray header.
 * public/favicon.svg uses the same artwork.
 */
export function Logo({ size = 32 }: { size?: number }) {
  const gradient = useId();
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b4ea8" />
          <stop offset="1" stopColor="#1e3a8a" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${gradient})`} />
      <rect
        x="0.75"
        y="0.75"
        width="62.5"
        height="62.5"
        rx="14.25"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.18"
        strokeWidth="1.5"
      />
      <CompassGlyph />
    </svg>
  );
}

/** The compass drawn in currentColor-free white, shared by the logo. */
function CompassGlyph() {
  return (
    <>
      <circle cx="32" cy="32" r="19" fill="none" stroke="#fff" strokeWidth="3.25" />
      <path
        d="M32 9.5v4.5M32 50v4.5M9.5 32H14M50 32h4.5"
        stroke="#fff"
        strokeWidth="3.25"
        strokeLinecap="round"
      />
      <g className="logo-needle">
        <path d="M32 16 36.25 32 32 48 27.75 32Z" fill="#fff" transform="rotate(40 32 32)" />
      </g>
      <circle cx="32" cy="32" r="2.25" fill="#1e3a8a" />
    </>
  );
}

/**
 * The compass alone, in currentColor, for large decorative watermarks.
 * Purely decorative: hidden from assistive technology.
 */
export function CompassWatermark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="19" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="32" cy="32" r="23.5" fill="none" stroke="currentColor" strokeWidth="0.4" />
      <path
        d="M32 6v7M32 51v7M6 32h7M51 32h7"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path d="M32 16 35.5 32 32 48 28.5 32Z" fill="currentColor" transform="rotate(40 32 32)" />
      <circle cx="32" cy="32" r="1.6" fill="currentColor" />
    </svg>
  );
}
