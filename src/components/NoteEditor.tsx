'use client';

import { useState } from 'react';

export default function NoteEditor({
  trackName,
  artistName,
  albumArt,
  initialNote,
}: {
  trackName: string;
  artistName: string;
  albumArt?: string | null;
  initialNote: string | null;
}) {
  const [note, setNote] = useState(initialNote || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(!initialNote);

  async function save() {
    setSaving(true);
    try {
      await fetch('/api/ratings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackName, artistName, albumArt, note }),
      });
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-muted font-mono">Notes</p>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-muted hover:text-brass transition">
            {note ? 'Edit' : '+ Add a note'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What's this song about to you? Lyrics that hit, a memory, why you rated it this way…"
            rows={4}
            maxLength={2000}
            className="w-full bg-panel2 border border-line rounded-md px-3 py-2.5 text-sm text-paper placeholder:text-muted focus:outline-none focus:border-brass resize-none"
          />
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={save}
              disabled={saving}
              className="text-xs px-4 py-1.5 rounded-full bg-brass text-ink font-medium disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save note'}
            </button>
            {initialNote && (
              <button
                onClick={() => {
                  setNote(initialNote || '');
                  setEditing(false);
                }}
                className="text-xs text-muted hover:text-paper transition"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      ) : (
        note && <p className="text-paper text-sm mt-2 whitespace-pre-wrap">{note}</p>
      )}
      {saved && <p className="text-signal text-xs mt-1.5">Saved ✓</p>}
    </div>
  );
}
