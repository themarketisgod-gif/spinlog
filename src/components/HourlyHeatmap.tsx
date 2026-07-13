export default function HourlyHeatmap({ hours }: { hours: number[] }) {
  const max = Math.max(1, ...hours);
  const w = 700;
  const h = 70;
  const cellW = w / 24;

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" role="img" aria-label="Plays by hour of day">
        {hours.map((count, hour) => {
          const intensity = count / max;
          const x = hour * cellW + 1;
          return (
            <rect
              key={hour}
              x={x}
              y={0}
              width={cellW - 2}
              height={48}
              rx={3}
              fill="#C9974B"
              opacity={count === 0 ? 0.08 : 0.15 + intensity * 0.85}
            />
          );
        })}
        {[0, 6, 12, 18, 23].map((hour) => (
          <text
            key={hour}
            x={hour * cellW + cellW / 2}
            y={64}
            textAnchor="middle"
            fontSize="9"
            fontFamily="var(--font-plex-mono)"
            fill="#8B93A1"
          >
            {hour === 0 ? '12a' : hour === 12 ? '12p' : hour > 12 ? `${hour - 12}p` : `${hour}a`}
          </text>
        ))}
      </svg>
      <p className="text-muted text-xs mt-1">
        Approximate — based on server time, not your local timezone.
      </p>
    </div>
  );
}
