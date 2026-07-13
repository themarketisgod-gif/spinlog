'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface SearchResult {
  trackName: string;
  artistName: string;
  artistNames: string[];
  albumName: string;
  albumArt: string | null;
  durationMs: number;
  spotifyUri: string;
  primaryArtistId: string | null;
  releaseYear: number | null;
}

const SOURCE_OPTIONS = [
  { value: 'other', label: 'Other / unspecified' },
  { value: 'apple_music', label: 'Apple Music' },
  { value: 'youtube_music', label: 'YouTube Music' },
  { value: 'pandora', label: 'Pandora' },
  { value: 'vinyl', label: 'Vinyl / physical' },
  { value: 'live', label: 'Live show' },
];

const MOOD_OPTIONS = [
  { value: '', label: 'Skip — no mood' },
  { value: 'happy', label: '😊 Happy' },
  { value: 'sad', label: '😢 Sad' },
  { value: 'hype', label: '⚡ Hype' },
  { value: 'chill', label: '😌 Chill' },
  { value: 'heartbroken', label: '💔 Heartbroken' },
  { value: 'angry', label: '😠 Angry' },
  { value: 'focus', label: '🎯 Focus' },
  { value: 'love', label: '🥰 In Love' },
];

export default function LogForm() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [manual, setManual] = useState(false);
  const [manualTrack, setManualTrack] = useState('');
  const [manualArtist, setManualArtist] = useState('');
  const [manualSource, setManualSource] = useState('other');
  const [mood, setMood] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const router = useRouter();

  useEffect(() => {
    if (manual || !query.trim()) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results || []);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [query, manual]);

  async function logPlay(payload: Partial<SearchResult> & { manualSource?: string; mood?: string }) {
    setStatus('saving');
    try {
      await fetch('/api/scrobble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setStatus('saved');
      setQuery('');
      setResults([]);
      setManualTrack('');
      setManualArtist('');
      router.refresh();
      setTimeout(() => setStatus('idle'), 1800);
    } catch {
      setStatus('idle');
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setManual(false)}
          className={`text-xs px-3 py-1.5 rounded-full border transition ${
            !manual ? 'bg-brass text-ink border-brass' : 'border-line text-muted'
          }`}
        >
          Search Spotify
        </button>
        <button
          onClick={() => setManual(true)}
          className={`text-xs px-3 py-1.5 rounded-full border transition ${
            manual ? 'bg-brass text-ink border-brass' : 'border-line text-muted'
          }`}
        >
          Type it in
        </button>
      </div>

      {!manual ? (
        <div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Track or artist name…"
            className="w-full bg-panel2 border border-line rounded-md px-3 py-2.5 text-sm text-paper placeholder:text-muted focus:outline-none focus:border-brass"
          />
          <div className="mt-3">
            <label className="text-xs text-muted block mb-1.5">Mood (optional)</label>
            <select
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              className="bg-panel2 border border-line rounded-md px-3 py-2 text-sm text-paper focus:outline-none focus:border-brass"
            >
              {MOOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3">
            {searching && <p className="text-muted text-xs">Searching…</p>}
            {results.map((r) => (
              <button
                key={r.spotifyUri}
                onClick={() => logPlay({ ...r, mood: mood || undefined })}
                className="w-full flex items-center gap-3 py-2.5 ledger-row text-left hover:bg-panel2 transition rounded px-1"
              >
                <div className="w-10 h-10 rounded bg-panel2 flex-shrink-0 overflow-hidden">
                  {r.albumArt && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.albumArt} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-paper text-sm">{r.trackName}</div>
                  <div className="truncate text-muted text-xs">{r.artistName}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            logPlay({ trackName: manualTrack, artistName: manualArtist, manualSource, mood: mood || undefined });
          }}
          className="space-y-3"
        >
          <input
            value={manualTrack}
            onChange={(e) => setManualTrack(e.target.value)}
            placeholder="Track name"
            className="w-full bg-panel2 border border-line rounded-md px-3 py-2.5 text-sm text-paper placeholder:text-muted focus:outline-none focus:border-brass"
          />
          <input
            value={manualArtist}
            onChange={(e) => setManualArtist(e.target.value)}
            placeholder="Artist"
            className="w-full bg-panel2 border border-line rounded-md px-3 py-2.5 text-sm text-paper placeholder:text-muted focus:outline-none focus:border-brass"
          />
          <div>
            <label className="text-xs text-muted block mb-1.5">Where did you hear it?</label>
            <select
              value={manualSource}
              onChange={(e) => setManualSource(e.target.value)}
              className="w-full bg-panel2 border border-line rounded-md px-3 py-2.5 text-sm text-paper focus:outline-none focus:border-brass"
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted block mb-1.5">Mood (optional)</label>
            <select
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              className="w-full bg-panel2 border border-line rounded-md px-3 py-2.5 text-sm text-paper focus:outline-none focus:border-brass"
            >
              {MOOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <button
            disabled={status === 'saving'}
            className="px-4 py-2 rounded-md bg-brass text-ink text-sm font-medium hover:brightness-110 transition disabled:opacity-50"
          >
            {status === 'saving' ? 'Logging…' : 'Log it'}
          </button>
        </form>
      )}

      {status === 'saved' && (
        <p className="text-signal text-xs mt-4">Logged. Nice pick.</p>
      )}
    </div>
  );
}
