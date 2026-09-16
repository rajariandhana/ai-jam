/**
 * The JAM mark: the letters drawn as strokes on a rounded square, so it looks
 * the same everywhere without loading a font. `public/favicon.svg` is the
 * same drawing with the accent colour written out.
 */
function Logo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="JAM"
      className={className}
    >
      <rect width="64" height="64" rx="14" fill="var(--accent)" />
      <g
        fill="none"
        stroke="#fff"
        strokeWidth="4.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(32 32) scale(1.1) translate(-32 -32)"
      >
        <path d="M15.3 24.3V36a3.7 3.7 0 0 1-7.4 0" />
        <path d="M23 39.7 29 24.3l6 15.4M25.4 35.9h7.2" />
        <path d="M42.9 39.7V24.3l6.5 10.4 6.5-10.4v15.4" />
      </g>
    </svg>
  );
}

export default Logo;
