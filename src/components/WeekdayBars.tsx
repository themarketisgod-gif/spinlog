export default function WeekdayBars({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const w = 700;
  const h = 100;
  const barW = w / data.length;
  const plotH = 70;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" role="img" aria-label="Plays by day of week">
      {data.map((d, i) => {
        const barH = (d.count / max) * plotH;
        const x = i * barW + barW * 0.25;
        const barWidth = barW * 0.5;
        const y = plotH - barH;
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={barWidth} height={Math.max(barH, d.count > 0 ? 3 : 0)} rx={2} fill="#6FA88F" opacity={0.85} />
            <text x={x + barWidth / 2} y={h - 6} textAnchor="middle" fontSize="10" fontFamily="var(--font-plex-mono)" fill="#8B93A1">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
