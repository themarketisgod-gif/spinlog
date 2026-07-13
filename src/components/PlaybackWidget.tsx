'use client';

import { useEffect, useState } from 'react';

interface PlaybackState {
  deviceName: string | null;
  volumePercent: number | null;
  isPlaying: boolean;
  shuffleState: boolean;
  repeatState: string;
}

interface QueueTrack {
  trackName: string;
  artistName: string;
  albumArt: string | null;
}

interface Device {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
}

export default function PlaybackWidget() {
  const [state, setState] = useState<PlaybackState | null>(null);
  const [queue, setQueue] = useState<QueueTrack[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function poll() {
    try {
      const res = await fetch('/api/playback');
      if (!res.ok) return;
      const data = await res.json();
      setState(data.state);
      setQueue(data.queue || []);
      setDevices(data.devices || []);
      if (!selectedDevice) {
        const active = (data.devices || []).find((d: Device) => d.isActive);
        if (active) setSelectedDevice(active.id);
      }
      setChecked(true);
    } catch {
      // ignore, try again next interval
    }
  }

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function control(action: 'play' | 'pause' | 'next' | 'previous') {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/playback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, deviceId: selectedDevice || undefined }),
      });
      const data = await res.json();
      if (!data.ok) setError(data.error || 'Command failed');
      setTimeout(poll, 800);
    } finally {
      setBusy(false);
    }
  }

  if (!checked) return null;

  if (!state && devices.length === 0) {
    return (
      <p className="text-muted text-xs mt-2">
        No active Spotify device — open Spotify somewhere to control playback here.
      </p>
    );
  }

  return (
    <div className="bg-panel border border-line rounded-lg p-4 mt-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-muted font-mono">
          {state?.deviceName ? `Playing on ${state.deviceName}` : 'No device selected'}
          {state?.volumePercent !== null && state?.volumePercent !== undefined && ` · vol ${state.volumePercent}%`}
        </div>

        {devices.length > 0 && (
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="text-xs bg-panel2 border border-line rounded-md px-2 py-1 text-paper focus:outline-none focus:border-brass"
          >
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} {d.isActive ? '(active)' : ''}
              </option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-1 text-[10px] text-muted">
          {state?.shuffleState && <span className="px-1.5 py-0.5 border border-line rounded">shuffle</span>}
          {state?.repeatState && state.repeatState !== 'off' && (
            <span className="px-1.5 py-0.5 border border-line rounded">repeat {state.repeatState}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={() => control('previous')}
          disabled={busy}
          className="w-8 h-8 rounded-full border border-line text-paper hover:border-brass transition disabled:opacity-50"
        >
          ⏮
        </button>
        <button
          onClick={() => control(state?.isPlaying ? 'pause' : 'play')}
          disabled={busy}
          className="w-9 h-9 rounded-full bg-brass text-ink hover:brightness-110 transition disabled:opacity-50"
        >
          {state?.isPlaying ? '⏸' : '▶'}
        </button>
        <button
          onClick={() => control('next')}
          disabled={busy}
          className="w-8 h-8 rounded-full border border-line text-paper hover:border-brass transition disabled:opacity-50"
        >
          ⏭
        </button>
      </div>

      {error && <p className="text-danger text-xs mt-2">{error}</p>}

      {queue.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-widest text-muted font-mono mb-2">Up next</p>
          <div className="space-y-1.5">
            {queue.map((t, i) => (
              <div key={i} className="text-xs text-muted truncate">
                <span className="text-paper">{t.trackName}</span> — {t.artistName}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
