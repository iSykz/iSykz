/** Logo do Zerou: Z em forma de gráfico (do vermelho ao verde) + nome monolinha. */
export function Logo({ altura = 30 }: { altura?: number }) {
  return (
    <svg
      viewBox="12 12 486 112"
      height={altura}
      role="img"
      aria-label="Zerou"
      style={{ display: "block", width: "auto" }}
    >
      <defs>
        <linearGradient id="zerou-grad" gradientUnits="userSpaceOnUse" x1="33" y1="35" x2="79" y2="77">
          <stop offset="0" stopColor="#ff5a5f" />
          <stop offset=".5" stopColor="#ffb547" />
          <stop offset="1" stopColor="#22c38e" />
        </linearGradient>
      </defs>
      <g transform="translate(12 12)">
        <rect width="112" height="112" rx="26" fill="#0f1720" />
        <path
          d="M33 35H79L33 77H79"
          fill="none"
          stroke="url(#zerou-grad)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g fill="none" stroke="currentColor" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round">
        <path d="M150 36H190L150 100H190" />
        <path d="M212 68H272A30 32 0 1 0 264 90" />
        <path d="M294 100V36M294 64Q294 36 326 36" />
        <ellipse cx="378" cy="68" rx="30" ry="32" stroke="var(--primaria)" />
        <path d="M430 36V72A28 28 0 0 0 486 72V36M486 36V100" />
      </g>
    </svg>
  );
}
