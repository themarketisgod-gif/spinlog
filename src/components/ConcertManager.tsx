'use client';

import { useEffect, useState } from 'react';

interface ConcertSong {
  id: string;
  trackName: string;
  position: number;
  isEncore: boolean;
}

interface Concert {
  id: string;
  artistName: string;
  venueName: string | null;
  city: string | null;
  eventDate: string;
  setlistFmUrl: string | null;
  source: string;
  songs: ConcertSong[];
}

interface SearchResult {
  id: string;
  artistName: string;
  venueName: string;
  city: string;
  country: string;
  eventDate: string;
  tour: string | null;
  url: string;
  songCount: number;
}

export default function ConcertManager() {
  const [concerts, setConcerts] = useState<Concert[] | null>(null);
  const [mode, setMode] = useState<'search' | 'manual'>('search');
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [year, setYear] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [importing, setImporting] = useState<string | null>(null);

  const [manualArtist, setManualArtist] = useState('');
  const [manualVenue, setManualVenue] = useState('');
  const [manualCity, setManualCity] = useState('');
  const [manualDate, setManualDate] = useState('');
  const [manualSongs, setManualSongs] = useState('');
  const [savingManual, setSavingManual] = useState(false);

  function load() {
    fetch('/api/concerts')
      .then((r) => r.json())
      .then((data) => {
        setConcerts(data.concerts || []);
        // If we arrived via a "seen live" link (e.g. /concerts#concert-xyz),
        // scroll to that specific concert and briefly highlight it — the
        // element doesn't exist until this fetch resolves, so the browser's
        // own hash-scroll on page load can't reach it on its own.
        const hash = window.location.hash;
        if (hash.startsWith('#concert-')) {
          const id = hash.replace('#concert-', '');
          setTimeout(() => {
            const el = document.getElementById(`concert-${id}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlighted(id);
            setTimeout(() => setHighlighted(null), 3000);
          }, 100);
        }
      })
      .catch(() => setConcerts([]));
  }

  useEffect(load, []);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearchError('');
    setResults(null);
    try {
      const params = new URLSearchParams({ artistName: query.trim() });
      if (year.trim()) params.set('year', year.trim());
      const res = await fetch(`/api/concerts/search?${params}`);
      const data = await res.json();
      if (data.error) setSearchError(data.error);
      setResults(data.results || []);
    } finally {
      setSearching(false);
    }
  }

  async function importSetlist(id: string) {
    setImporting(id);
    try {
      await fetch('/api/concerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setlistFmId: id }),
      });
      setResults(null);
      setQuery('');
      load();
    } finally {
      setImporting(null);
    }
  }

  async function saveManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualArtist.trim() || !manualDate) return;
    setSavingManual(true);
    try {
      await fetch('/api/concerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistName: manualArtist,
          venueName: manualVenue,
          city: manualCity,
          eventDate: manualDate,
          songs: manualSongs.split('\n').filter((s) => s.trim()),
        }),
      });
      setManualArtist('');
      setManualVenue('');
      setManualCity('');
      setManualDate('');
      setManualSongs('');
      load();
    } finally {
      setSavingManual(false);
    }
  }

  async function remove(id: string) {
    setConcerts((c) => c?.filter((x) => x.id !== id) ?? null);
    await fetch('/api/concerts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode('search')}
          className={`text-xs px-3 py-1.5 rounded-full border transition ${
            mode === 'search' ? 'bg-brass text-ink border-brass' : 'border-line text-muted'
          }`}
        >
          Search setlist.fm
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`text-xs px-3 py-1.5 rounded-full border transition ${
            mode === 'manual' ? 'bg-brass text-ink border-brass' : 'border-line text-muted'
          }`}
        >
          Enter manually
        </button>
      </div>

      {mode === 'search' ? (
        <div>
          <form onSubmit={search} className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Artist name…"
              className="flex-1 bg-panel2 border border-line rounded-md px-3 py-2 text-sm text-paper placeholder:text-muted focus:outline-none focus:border-brass"
            />
            <input
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="Year (optional)"
              className="w-32 bg-panel2 border border-line rounded-md px-3 py-2 text-sm text-paper placeholder:text-muted focus:outline-none focus:border-brass"
            />
            <button
              disabled={searching}
              className="px-4 py-2 rounded-md bg-brass text-ink text-sm font-medium disabled:opacity-50"
            >
              {searching ? 'Searching…' : 'Search'}
            </button>
          </form>

          {searchError && <p className="text-danger text-xs mt-3">{searchError}</p>}

          {results && results.length === 0 && !searchError && (
            <p className="text-muted text-sm mt-4">No shows found — try a broader search or enter it manually.</p>
          )}

          {results && results.length > 0 && (
            <div className="mt-4 space-y-2">
              {results.map((r) => (
                <div key={r.id} className="ledger-row flex items-center justify-between py-2.5 gap-2">
                  <div className="min-w-0">
                    <div className="text-paper text-sm truncate">
                      {r.artistName} {r.tour && <span className="text-muted">· {r.tour}</span>}
                    </div>
                    <div className="text-muted text-xs truncate">
                      {r.venueName}, {r.city} — {r.eventDate} · {r.songCount} songs
                    </div>
                  </div>
                  <button
                    onClick={() => importSetlist(r.id)}
                    disabled={importing === r.id}
                    className="text-xs px-3 py-1.5 rounded-full bg-brass text-ink font-medium flex-shrink-0 disabled:opacity-50"
                  >
                    {importing === r.id ? 'Adding…' : 'Add'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={saveManual} className="space-y-3 max-w-md">
          <input
            value={manualArtist}
            onChange={(e) => setManualArtist(e.target.value)}
            placeholder="Artist"
            className="w-full bg-panel2 border border-line rounded-md px-3 py-2.5 text-sm text-paper placeholder:text-muted focus:outline-none focus:border-brass"
          />
          <div className="flex gap-2">
            <input
              value={manualVenue}
              onChange={(e) => setManualVenue(e.target.value)}
              placeholder="Venue"
              className="flex-1 bg-panel2 border border-line rounded-md px-3 py-2.5 text-sm text-paper placeholder:text-muted focus:outline-none focus:border-brass"
            />
            <input
              value={manualCity}
              onChange={(e) => setManualCity(e.target.value)}
              placeholder="City"
              className="flex-1 bg-panel2 border border-line rounded-md px-3 py-2.5 text-sm text-paper placeholder:text-muted focus:outline-none focus:border-brass"
            />
          </div>
          <input
            type="date"
            value={manualDate}
            onChange={(e) => setManualDate(e.target.value)}
            className="w-full bg-panel2 border border-line rounded-md px-3 py-2.5 text-sm text-paper focus:outline-none focus:border-brass"
          />
          <textarea
            value={manualSongs}
            onChange={(e) => setManualSongs(e.target.value)}
            placeholder="Setlist, one song per line (optional)"
            rows={6}
            className="w-full bg-panel2 border border-line rounded-md px-3 py-2.5 text-sm text-paper placeholder:text-muted focus:outline-none focus:border-brass resize-none"
          />
          <button
            disabled={savingManual}
            className="px-4 py-2 rounded-md bg-brass text-ink text-sm font-medium disabled:opacity-50"
          >
            {savingManual ? 'Saving…' : 'Add concert'}
          </button>
        </form>
      )}

      <div className="mt-10">
        <h2 className="text-xs uppercase tracking-widest text-muted font-mono border-b border-line pb-2">
          Your concerts
        </h2>
        <div className="mt-4 space-y-4">
          {concerts && concerts.length === 0 && (
            <p className="text-muted text-sm">No concerts logged yet.</p>
          )}
          {concerts?.map((c) => (
            <div
              key={c.id}
              id={`concert-${c.id}`}
              className={`bg-panel border rounded-lg p-4 transition-colors ${
                highlighted === c.id ? 'border-signal' : 'border-line'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-paper font-medium">{c.artistName}</div>
                  <div className="text-muted text-xs">
                    {[c.venueName, c.city].filter(Boolean).join(', ')} —{' '}
                    {new Date(c.eventDate).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                  {c.setlistFmUrl && (
                    <a
                      href={c.setlistFmUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-muted hover:text-brass transition"
                    >
                      View on setlist.fm →
                    </a>
                  )}
                </div>
                <button
                  onClick={() => remove(c.id)}
                  className="text-xs text-muted hover:text-danger transition flex-shrink-0"
                >
                  Remove
                </button>
              </div>
              {c.songs.length > 0 && (
                <ol className="mt-3 text-xs text-muted space-y-0.5">
                  {c.songs.map((s) => (
                    <li key={s.id}>
                      {s.position}. {s.trackName} {s.isEncore && <span className="text-brass">(encore)</span>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
