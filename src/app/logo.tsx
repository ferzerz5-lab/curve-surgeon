export function CurveSurgeonMark({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="brand-mark"
    >
      <rect x="0.5" y="0.5" width="39" height="39" rx="9" fill="#14171c" stroke="#262b33" />
      {/* pulse blip resolving into the bonding curve's ascending price line */}
      <path
        d="M4 22 H11 L14 12 L18 28 L21 22 H24 C 27 22 27.5 12 31 10 C 33 8.7 34.5 8 36 8"
        stroke="#5b9dff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="36" cy="8" r="2" fill="#f0a94e" />
    </svg>
  );
}
