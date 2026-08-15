// Verified trust badge — a crisp vector icon (not an emoji, which renders
// inconsistently across platforms). Matches the convention used by major
// platforms (X/Twitter, Instagram, LinkedIn): a solid circle with a white
// checkmark, scaled cleanly at any size.
function VerifiedBadge({ size = 16, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`inline-block flex-shrink-0 ${className}`}
      role="img"
      aria-label="Verified by ProMedicoz"
    >
      <title>Verified by ProMedicoz</title>
      <circle cx="12" cy="12" r="12" fill="#2563EB" />
      <path
        d="M7 12.5L10.3 16L17 9"
        stroke="white"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export default VerifiedBadge;
