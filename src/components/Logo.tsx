/** The mark: a 3×3 dot matrix with one dot picked. */
export function LogoMark({ size = 26 }: { size?: number }) {
  const dots = [0, 1, 2].flatMap((y) => [0, 1, 2].map((x) => ({ x, y })));
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden className="logo-mark">
      {dots.map(({ x, y }) =>
        x === 2 && y === 0 ? null : (
          <circle key={`${x}${y}`} cx={4 + x * 9} cy={4 + y * 9} r={2.3} fill="currentColor" opacity={0.28 + (x + (2 - y)) * 0.08} />
        ),
      )}
      <circle cx={22} cy={4} r={4} fill="var(--pink)" className="logo-pick" />
    </svg>
  );
}
