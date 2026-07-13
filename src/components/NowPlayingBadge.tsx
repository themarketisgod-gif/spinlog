'use client';

import { useEffect, useRef, useState } from 'react';

interface NowPlaying {
  trackName: string;
  artistName: string;
  albumArt: string | null;
  isPlaying: boolean;
  progressMs: number | null;
  durationMs: number | null;
}

function formatMs(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function NowPlayingBadge({ username }: { username: string }) {
  const [data, setData] = useState<NowPlaying | null>(null);
  const [checked, setChecked] = useState(false);
  const [displayMs, setDisplayMs] = useState(0);
  const fetchedAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/now-playing/${username}`);
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) {
          setData(json.nowPlaying);
          fetchedAtRef.current = Date.now();
          setDisplayMs(json.nowPlaying?.progressMs ?? 0);
          setChecked(true);
        }
      } catch {
        // ignore transient errors, try again next interval
      }
    }

    poll();
    const interval = setInterval(poll, 20000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [username]);

  // Interpolate progress smoothly between 20s polls, rather than jumping.
  useEffect(() => {
    if (!data?.isPlaying || !data.durationMs) return;
    const tick = setInterval(() => {
      const elapsed = Date.now() - fetchedAtRef.current;
      const next = Math.min(data.durationMs!, (data.progressMs ?? 0) + elapsed);
      setDisplayMs(next);
    }, 1000);
    return () => clearInterval(tick);
  }, [data]);

  if (!checked || !data || !data.isPlaying) return null;

  const progressPct = data.durationMs ? Math.min(100, (displayMs / data.durationMs) * 100) : 0;

  return (
    <div className="flex items-center gap-3 bg-panel border border-signal/40 rounded-lg px-3 py-2 mt-4">
      <div className="w-9 h-9 rounded bg-panel2 flex-shrink-0 overflow-hidden">
        {data.albumArt ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.albumArt} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted text-xs">
            ♫
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-signal font-mono mb-0.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-signal opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-signal" />
          </span>
          Listening now
        </div>
        <div className="truncate text-paper text-sm">{data.trackName}</div>
        <div className="truncate text-muted text-xs">{data.artistName}</div>

        {data.durationMs && (
          <div className="mt-1.5">
            <div className="h-1 bg-panel2 rounded-full overflow-hidden">
              <div
                className="h-full bg-signal rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted font-mono mt-0.5">
              <span>{formatMs(displayMs)}</span>
              <span>{formatMs(data.durationMs)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
