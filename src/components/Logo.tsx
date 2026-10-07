/** The "CM" monogram (same letters in the square logo and the round favicon, src/app/icon.svg). */
function Monogram() {
  return (
    <>
      <path d="M538 365 A270 270 0 0 0 538 905 L538 785 A150 150 0 0 1 538 485 Z" />
      <rect x="537" y="365" width="183" height="120" />
      <polygon points="538,567 635,636 635,905 537,905 537,567" />
      <polygon points="853,588 970,507 970,905 853,905" />
      <polygon points="635,636 710,688 853,588 853,732 722,822 635,760" />
    </>
  );
}

/**
 * Content Machine logo mark: rounded square (default) or circle.
 * The shape uses the text color and the letters the page background, so it flips in dark mode.
 */
export function LogoMark({
  size = 32,
  shape = "square",
  className = "",
}: {
  size?: number;
  shape?: "square" | "circle";
  className?: string;
}) {
  const square = shape === "square";
  return (
    <svg
      viewBox={square ? "153 170 931 931" : "142 151 970 970"}
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Content Machine"
    >
      {square ? (
        <rect x="153" y="170" width="931" height="931" rx="198" className="fill-fg" />
      ) : (
        <circle cx="627" cy="636" r="485" className="fill-fg" />
      )}
      <g className="fill-bg">
        <Monogram />
      </g>
    </svg>
  );
}
