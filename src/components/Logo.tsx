export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="logo">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="#1A1A1A" />
        <path
          d="M8 34h12l5-12 8 24 6-18 4 6h13"
          fill="none"
          stroke="#58CC02"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="logo-text">StudyPulse</span>
    </span>
  );
}
