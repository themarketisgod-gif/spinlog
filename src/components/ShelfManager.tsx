'use client';

import { useEffect, useState } from 'react';

interface Track {
  id: string;
  trackName: string;
  position: number;
}

interface MediaItem {
  id: string;
  artistName: string;
  releaseTitle: string;
  format: string;
  year: number | null;
  coverArt: string | null;
  discogsUrl: string | null;
  discogsReleaseId: string | null;
  tracks: Track[];
}

interface SearchResult {
  releaseId: string;
  title: string;
  year: string | null;
  thumb: string | null;
  format: string | null;
}

const FORMAT_ICON: Record<string, string> = {
  Vinyl: '💿',
  CD: '💿',
  Cassette: '📼',
  Other: '📀',
};

export default function ShelfManager() {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [mode, setMode] = useState<'search' | 'collection' | 'manual'>('search');
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [adding, setAdding] = useState<string | null>(null);

  const [discogsUsername, setDiscogsUsername] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');

  const [manualArtist, setManualArtist] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualFormat, setManualFormat] = useState('Vinyl');
  const [manualYear, setManualYear] = useState('');
  const [manualTracks, setManualTracks] = useState('');
  const [savingManual, setSavingManual] = useState(false);
  const [fetchingTracklist, setFetchingTracklist] = useState<string | null>(null);
  const [tracklistMsg, setTracklistMsg] = useState<{ id: string; text: string } | null>(null);

  function load() {
    fetch('/api/physical-media')
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items || []);
        const hash = window.location.hash;
        if (hash.startsWith('#item-')) {
          const id = hash.replace('#item-', '');
          setTimeout(() => {
            document.getElementById(`item-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlighted(id);
            setTimeout(() => setHighlighted(null), 3000);
          }, 100);
        }
      })
      .catch(() => setItems([]));
  }

  useEffect(load, []);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearchError('');
    setResults(null);
    try {
      const res = await fetch(`/api/physical-media/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (data.error) setSearchError(data.error);
      setResults(data.results || []);
    } finally {
      setSearching(false);
    }
  }

  async function addRelease(releaseId: string) {
    setAdding(releaseId);
    try {
      await fetch('/api/physical-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discogsReleaseId: releaseId }),
      });
      setResults(null);
      setQuery('');
      load();
    } finally {
      setAdding(null);
    }
  }

  async function importCollection() {
    if (!discogsUsername.trim()) return;
    setImporting(true);
    setImportMsg('');
    try {
      const res = await fetch('/api/physical-media/import-collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: discogsUsername.trim() }),
      });
      const data = await res.json();
      setImportMsg(res.ok ? `Added ${data.added} of ${data.checked} releases found.` : data.error || 'Something went wrong');
      if (res.ok) load();
    } finally {
      setImporting(false);
    }
  }

  async function saveManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualArtist.trim() || !manualTitle.trim()) return;
    setSavingManual(true);
    try {
      await fetch('/api/physical-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistName: manualArtist,
          releaseTitle: manualTitle,
          format: manualFormat,
          year: manualYear,
          tracks: manualTracks.split('\n').filter((t) => t.trim()),
        }),
      });
      setManualArtist('');
      setManualTitle('');
      setManualYear('');
      setManualTracks('');
      load();
    } finally {
      setSavingManual(false);
    }
  }

  async function remove(id: string) {
    setItems((c) => c?.filter((x) => x.id !== id) ?? null);
    await fetch('/api/physical-media', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  }

  async function fetchTracklist(id: string) {
    setFetchingTracklist(id);
    setTracklistMsg(null);
    try {
      const res = await fetch(`/api/physical-media/${id}/fetch-tracklist`, { method: 'POST' });
      const data = await res.json();
      setTracklistMsg({ id, text: res.ok ? `Added ${data.added} tracks.` : data.error || 'Could not fetch tracklist.' });
      if (res.ok) load();
    } finally {
      setFetchingTracklist(null);
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode('search')}
          className={`text-xs px-3 py-1.5 rounded-full border transition ${mode === 'search' ? 'bg-brass text-ink border-brass' : 'border-line text-muted'}`}
        >
          Search Discogs
        </button>
        <button
          onClick={() => setMode('collection')}
          className={`text-xs px-3 py-1.5 rounded-full border transition ${mode === 'collection' ? 'bg-brass text-ink border-brass' : 'border-line text-muted'}`}
        >
          Import Discogs collection
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`text-xs px-3 py-1.5 rounded-full border transition ${mode === 'manual' ? 'bg-brass text-ink border-brass' : 'border-line text-muted'}`}
        >
          Enter manually
        </button>
      </div>

      {mode === 'search' && (
        <div>
          <form onSubmit={search} className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Artist or release title…"
              className="flex-1 bg-panel2 border border-line rounded-md px-3 py-2 text-sm text-paper placeholder:text-muted focus:outline-none focus:border-brass"
            />
            <button disabled={searching} className="px-4 py-2 rounded-md bg-brass text-ink text-sm font-medium disabled:opacity-50">
              {searching ? 'Searching…' : 'Search'}
            </button>
          </form>
          {searchError && <p className="text-danger text-xs mt-3">{searchError}</p>}
          {results && results.length === 0 && !searchError && (
            <p className="text-muted text-sm mt-4">No releases found — try a broader search.</p>
          )}
          {results && results.length > 0 && (
            <div className="mt-4 space-y-2">
              {results.map((r) => (
                <div key={r.releaseId} className="ledger-row flex items-center justify-between py-2.5 gap-2">
                  <div className="min-w-0">
                    <div className="text-paper text-sm truncate">{r.title}</div>
                    <div className="text-muted text-xs truncate">
                      {r.format} {r.year && `· ${r.year}`}
                    </div>
                  </div>
                  <button
                    onClick={() => addRelease(r.releaseId)}
                    disabled={adding === r.releaseId}
                    className="text-xs px-3 py-1.5 rounded-full bg-brass text-ink font-medium flex-shrink-0 disabled:opacity-50"
                  >
                    {adding === r.releaseId ? 'Adding…' : 'Add'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === 'collection' && (
        <div>
          <p className="text-muted text-xs mb-3 max-w-md">
            Pulls your default Discogs folder (500 releases max). Only
            works if your collection is public — Discogs' default setting.
            Tracklists aren't fetched individually for a bulk import, so
            matching falls back to "owns this artist" for these.
          </p>
          <div className="flex gap-2">
            <input
              value={discogsUsername}
              onChange={(e) => setDiscogsUsername(e.target.value)}
              placeholder="Your Discogs username"
              className="flex-1 max-w-xs bg-panel2 border border-line rounded-md px-3 py-2 text-sm text-paper placeholder:text-muted focus:outline-none focus:border-brass"
            />
            <button
              onClick={importCollection}
              disabled={importing}
              className="px-4 py-2 rounded-md bg-brass text-ink text-sm font-medium disabled:opacity-50"
            >
              {importing ? 'Importing…' : 'Import'}
            </button>
          </div>
          {importMsg && <p className="text-signal text-xs mt-2">{importMsg}</p>}
        </div>
      )}

      {mode === 'manual' && (
        <form onSubmit={saveManual} className="space-y-3 max-w-md">
          <input
            value={manualArtist}
            onChange={(e) => setManualArtist(e.target.value)}
            placeholder="Artist"
            className="w-full bg-panel2 border border-line rounded-md px-3 py-2.5 text-sm text-paper placeholder:text-muted focus:outline-none focus:border-brass"
          />
          <input
            value={manualTitle}
            onChange={(e) => setManualTitle(e.target.value)}
            placeholder="Release title"
            className="w-full bg-panel2 border border-line rounded-md px-3 py-2.5 text-sm text-paper placeholder:text-muted focus:outline-none focus:border-brass"
          />
          <div className="flex gap-2">
            <select
              value={manualFormat}
              onChange={(e) => setManualFormat(e.target.value)}
              className="flex-1 bg-panel2 border border-line rounded-md px-3 py-2.5 text-sm text-paper focus:outline-none focus:border-brass"
            >
              <option value="Vinyl">Vinyl</option>
              <option value="CD">CD</option>
              <option value="Cassette">Cassette</option>
              <option value="Other">Other</option>
            </select>
            <input
              value={manualYear}
              onChange={(e) => setManualYear(e.target.value)}
              placeholder="Year"
              className="w-28 bg-panel2 border border-line rounded-md px-3 py-2.5 text-sm text-paper placeholder:text-muted focus:outline-none focus:border-brass"
            />
          </div>
          <textarea
            value={manualTracks}
            onChange={(e) => setManualTracks(e.target.value)}
            placeholder="Tracklist, one song per line (optional)"
            rows={6}
            className="w-full bg-panel2 border border-line rounded-md px-3 py-2.5 text-sm text-paper placeholder:text-muted focus:outline-none focus:border-brass resize-none"
          />
          <button disabled={savingManual} className="px-4 py-2 rounded-md bg-brass text-ink text-sm font-medium disabled:opacity-50">
            {savingManual ? 'Saving…' : 'Add to shelf'}
          </button>
        </form>
      )}

      <div className="mt-10">
        <h2 className="text-xs uppercase tracking-widest text-muted font-mono border-b border-line pb-2">
          Your shelf
        </h2>
        <div className="mt-4 grid sm:grid-cols-2 gap-4">
          {items && items.length === 0 && <p className="text-muted text-sm">Nothing on the shelf yet.</p>}
          {items?.map((item) => (
            <div
              key={item.id}
              id={`item-${item.id}`}
              className={`bg-panel border rounded-lg p-4 transition-colors ${highlighted === item.id ? 'border-signal' : 'border-line'}`}
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded bg-panel2 flex-shrink-0 overflow-hidden flex items-center justify-center text-xl">
                  {item.coverArt ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.coverArt} alt="" className="w-full h-full object-cover" />
                  ) : (
                    FORMAT_ICON[item.format] || '📀'
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-paper text-sm font-medium truncate">{item.releaseTitle}</div>
                  <div className="text-muted text-xs truncate">
                    {item.artistName} · {item.format} {item.year && `· ${item.year}`}
                  </div>
                  {item.discogsUrl && (
                    <a href={item.discogsUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted hover:text-brass transition">
                      View on Discogs →
                    </a>
                  )}
                </div>
                <button onClick={() => remove(item.id)} className="text-xs text-muted hover:text-danger transition flex-shrink-0">
                  Remove
                </button>
              </div>
              {item.tracks.length > 0 ? (
                <ol className="mt-3 text-xs text-muted space-y-0.5 pl-1">
                  {item.tracks.map((t) => (
                    <li key={t.id}>{t.position}. {t.trackName}</li>
                  ))}
                </ol>
              ) : item.discogsReleaseId ? (
                <div className="mt-3">
                  <p className="text-muted text-xs mb-1.5">
                    No tracklist — "own it" only matches this exact artist name.
                  </p>
                  <button
                    onClick={() => fetchTracklist(item.id)}
                    disabled={fetchingTracklist === item.id}
                    className="text-xs px-3 py-1.5 rounded-full border border-line text-muted hover:text-brass hover:border-brass transition disabled:opacity-50"
                  >
                    {fetchingTracklist === item.id ? 'Fetching…' : 'Fetch tracklist from Discogs'}
                  </button>
                  {tracklistMsg?.id === item.id && (
                    <p className="text-xs mt-1.5 text-signal">{tracklistMsg.text}</p>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
