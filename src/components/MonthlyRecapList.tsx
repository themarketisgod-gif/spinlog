import Link from 'next/link';

export default function MonthlyRecapList({
  data,
  profileUsername,
}: {
  data: { monthLabel: string; artist: string | null; count: number }[];
  profileUsername?: string;
}) {
  return (
    <div className="space-y-0">
      {data.map((m) => (
        <div key={m.monthLabel} className="ledger-row flex items-center justify-between py-2.5">
          <span className="font-mono text-xs text-muted w-14 flex-shrink-0">{m.monthLabel}</span>
          {m.artist ? (
            profileUsername ? (
              <Link
                href={`/u/${profileUsername}/artist/${encodeURIComponent(m.artist)}`}
                className="flex-1 text-paper truncate px-3 hover:text-brass transition"
              >
                {m.artist}
              </Link>
            ) : (
              <span className="flex-1 text-paper truncate px-3">{m.artist}</span>
            )
          ) : (
            <span className="flex-1 text-muted italic px-3">No scrobbles</span>
          )}
          {m.count > 0 && <span className="font-mono text-xs text-muted flex-shrink-0">{m.count}×</span>}
        </div>
      ))}
    </div>
  );
}
