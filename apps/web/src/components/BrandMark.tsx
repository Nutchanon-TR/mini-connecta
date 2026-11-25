export function BrandMark({ discover = false }: { discover?: boolean }) {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M25.85 17.74A10 10 0 1 1 16 6"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <circle cx="23.66" cy="9.57" r="3.6" fill={discover ? 'var(--accent-hover)' : 'var(--tea)'} />
    </svg>
  );
}
