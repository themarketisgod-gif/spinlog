export default function ActivityBars({ counts }: { counts: { label: string; count: number }[] }) {
  const max = Math.max(1, ...counts.map((c) => c.count));
  const w = 700;
  const h = 140;
  const barW = w / counts.length;
  const padTop = 10;
  const padBottom = 24;
  const plotH = h - padTop - padBottom;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" role="img" aria-label="Plays per day, last two weeks">
      {counts.map((c, i) => {
        const barH = (c.count / max) * plotH;
        const x = i * barW + barW * 0.22;
        const barWidth = barW * 0.56;
        const y = padTop + (plotH - barH);
        return (
          <g key={c.label}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barH, c.count > 0 ? 3 : 0)}
              rx={2}
              fill={c.count > 0 ? '#C9974B' : '#242B36'}
              opacity={c.count > 0 ? 0.9 : 1}
            />
            <text
              x={x + barWidth / 2}
              y={h - 6}
              textAnchor="middle"
              fontSize="9"
              fontFamily="var(--font-plex-mono)"
              fill="#8B93A1"
            >
              {c.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
