'use client';

import { useEffect, useState } from 'react';

interface GroupPlaylist {
  id: string;
  name: string;
  spotifyUrl: string;
  creator: { name: string | null; username: string };
}

interface SearchResult {
  trackName: string;
  artistName: string;
  spotifyUri: string;
}

export default function GroupPlaylistSection() {
  const [playlists, setPlaylists] = useState<GroupPlaylist[] | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [addedMsg, setAddedMsg] = useState('');

  function load() {
    fetch('/api/group-playlist')
      .then((r) => r.json())
      .then((data) => setPlaylists(data.playlists || []))
      .catch(() => setPlaylists([]));
  }

  useEffect(load, []);

  async function create() {
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch('/api/group-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || 'Could not create playlist');
        return;
      }
      setNewName('');
      load();
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [query]);

  async function addTrack(playlistId: string, track: SearchResult) {
    const res = await fetch(`/api/group-playlist/${playlistId}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spotifyUri: track.spotifyUri }),
    });
    const data = await res.json();
    if (res.ok) {
      setAddedMsg(`Added "${track.trackName}"`);
    } else {
      setAddedMsg(data.error || 'Could not add — you may need to open the playlist in Spotify first.');
    }
    setQuery('');
    setResults([]);
    setAddingTo(null);
    setTimeout(() => setAddedMsg(''), 4000);
  }

  if (!playlists) return null;

  return (
    <div className="bg-panel border border-line rounded-lg p-4 mt-4">
      <p className="text-xs uppercase tracking-widest text-muted font-mono mb-3">
        Group playlists
      </p>
      <p className="text-muted text-xs mb-3">
        Anyone in the group can add tracks — each add uses that person's own
        Spotify account, not the creator's.
      </p>

      {playlists.length > 0 && (
        <div className="space-y-3 mb-4">
          {playlists.map((p) => (
            <div key={p.id} className="border-t border-line pt-3">
              <div className="flex items-center justify-between">
                <a
                  href={p.spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-paper text-sm hover:text-brass transition"
                >
                  {p.name}
                </a>
                <span className="text-muted text-xs">by {p.creator.name || p.creator.username}</span>
              </div>

              {addingTo === p.id ? (
                <div className="mt-2">
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onBlur={() => setTimeout(() => setAddingTo(null), 200)}
                    placeholder="Search a track to add…"
                    className="w-full bg-panel2 border border-line rounded-md px-3 py-1.5 text-xs text-paper placeholder:text-muted focus:outline-none focus:border-brass"
                  />
                  {results.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      {results.map((r) => (
                        <button
                          key={r.spotifyUri}
                          onMouseDown={() => addTrack(p.id, r)}
                          className="block w-full text-left text-xs px-2 py-1 rounded hover:bg-panel2 transition"
                        >
                          <span className="text-paper">{r.trackName}</span>{' '}
                          <span className="text-muted">— {r.artistName}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setAddingTo(p.id)}
                  className="text-xs text-brass hover:underline mt-1.5"
                >
                  + Add a track
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {addedMsg && <p className="text-signal text-xs mb-3">{addedMsg}</p>}

      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New playlist name…"
          className="flex-1 bg-panel2 border border-line rounded-md px-3 py-2 text-sm text-paper placeholder:text-muted focus:outline-none focus:border-brass"
        />
        <button
          onClick={create}
          disabled={creating}
          className="px-4 py-2 rounded-md bg-brass text-ink text-sm font-medium disabled:opacity-50"
        >
          Start
        </button>
      </div>
      {createError && <p className="text-danger text-xs mt-1.5">{createError}</p>}
    </div>
  );
}
