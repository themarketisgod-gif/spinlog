'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Dashboard({
  sleepCount,
  pendingRecsCount,
  rediscoveriesCount,
}: {
  sleepCount: number;
  pendingRecsCount: number;
  rediscoveriesCount: number;
}) {
  const [cleaning, setCleaning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  async function cleanupSleep() {
    setCleaning(true);
    try {
      const res = await fetch('/api/cleanup-sleep-plays', { method: 'POST' });
      const data = await res.json();
      setMessage(res.ok ? `Removed ${data.removed} plays.` : data.error || 'Something went wrong.');
      if (res.ok) router.refresh();
    } finally {
      setCleaning(false);
      setConfirming(false);
    }
  }

  const hasTasks = sleepCount > 0 || pendingRecsCount > 0 || rediscoveriesCount > 0;

  if (!hasTasks) {
    return (
      <div className="flex items-center gap-2 bg-panel border border-line rounded-lg px-4 py-3 mb-6">
        <span className="text-signal">✓</span>
        <span className="text-paper text-sm">All clear — nothing needs your attention right now.</span>
      </div>
    );
  }

  return (
    <div className="bg-panel border border-line rounded-lg px-4 py-3 mb-6">
      <p className="text-xs uppercase tracking-widest text-muted font-mono mb-2.5">Dashboard</p>
      <div className="space-y-2">
        {sleepCount > 0 && (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-paper">
              😴 {sleepCount} scrobble{sleepCount !== 1 ? 's' : ''} logged during possible sleep sessions
            </span>
            {confirming ? (
              <span className="text-xs flex items-center gap-1.5 flex-shrink-0">
                <button onClick={cleanupSleep} disabled={cleaning} className="text-danger hover:underline disabled:opacity-50">
                  {cleaning ? 'Removing…' : 'Confirm'}
                </button>
                <span className="text-muted">/</span>
                <button onClick={() => setConfirming(false)} className="text-muted hover:text-paper">
                  Cancel
                </button>
              </span>
            ) : (
              <span className="flex items-center gap-2 flex-shrink-0">
                <Link href="?tab=personality#bedtime" className="text-xs text-brass hover:underline">
                  Review →
                </Link>
                <button
                  onClick={() => setConfirming(true)}
                  className="text-xs px-3 py-1 rounded-full border border-line text-muted hover:text-brass hover:border-brass transition"
                >
                  Clean up
                </button>
              </span>
            )}
          </div>
        )}
        {pendingRecsCount > 0 && (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-paper">
              💌 {pendingRecsCount} recommendation{pendingRecsCount !== 1 ? 's' : ''} waiting from friends
            </span>
            <Link href="/log" className="text-xs text-brass hover:underline flex-shrink-0">
              Review →
            </Link>
          </div>
        )}
        {rediscoveriesCount > 0 && (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-paper">
              🔁 {rediscoveriesCount} track{rediscoveriesCount !== 1 ? 's' : ''} worth revisiting
            </span>
            <Link href="?tab=overview#rediscover" className="text-xs text-brass hover:underline flex-shrink-0">
              View →
            </Link>
          </div>
        )}
      </div>
      {message && <p className="text-signal text-xs mt-2.5">{message}</p>}
    </div>
  );
}
