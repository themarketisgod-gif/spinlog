'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const CSV_CHUNK_SIZE = 3000;
const JSON_CHUNK_SIZE = 500;

export default function LastfmFileImport() {
  const [mode, setMode] = useState<'scrobbles' | 'loved'>('scrobbles');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [fileName, setFileName] = useState('');
  const [dedupeStatus, setDedupeStatus] = useState<'idle' | 'loading'>('idle');
  const [dedupeMsg, setDedupeMsg] = useState('');
  const router = useRouter();

  async function runDedupe() {
    setDedupeStatus('loading');
    setDedupeMsg('');
    try {
      const res = await fetch('/api/dedupe-lastfm', { method: 'POST' });
      const data = await res.json();
      setDedupeMsg(
        res.ok
          ? `Removed ${data.removed} duplicate Last.fm plays (checked ${data.checked}).`
          : data.error || 'Something went wrong.'
      );
      if (res.ok) router.refresh();
    } catch {
      setDedupeMsg('Something went wrong.');
    } finally {
      setDedupeStatus('idle');
    }
  }

  async function sendChunk(content: string): Promise<{ added: number; checked: number; skippedAsDuplicate: number }> {
    // Sent as a raw text body rather than wrapped in a JSON envelope —
    // wrapping would mean escaping every quote in the CSV/JSON content,
    // which roughly doubles the effective payload size for no benefit.
    const res = await fetch(`/api/import-lastfm-file?mode=${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: content,
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      // Response wasn't JSON at all — usually means the platform itself
      // rejected the request (e.g. "Request Entity Too Large") before our
      // code ever ran, rather than an error our API route produced.
    }

    if (!res.ok) {
      throw new Error(
        data?.error ||
          (res.status === 413
            ? 'A batch was still too large for the server to accept — try a smaller export, or use the live API-key import below instead.'
            : `Server error (status ${res.status}) on one of the batches.`)
      );
    }
    return { added: data?.added ?? 0, checked: data?.checked ?? 0, skippedAsDuplicate: data?.skippedAsDuplicate ?? 0 };
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    setStatus('loading');
    setMessage('');

    try {
      const text = await file.text();
      const trimmed = text.trim();
      const isJson = trimmed.startsWith('[') || trimmed.startsWith('{');

      let chunks: string[] = [];

      if (isJson) {
        let parsed: any;
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          setMessage('That file doesn\'t look like valid JSON.');
          setStatus('error');
          return;
        }
        const items: any[] = Array.isArray(parsed) ? parsed : parsed?.track || parsed?.tracks || [];
        if (!Array.isArray(items) || items.length === 0) {
          setMessage("Couldn't find any tracks in that JSON file.");
          setStatus('error');
          return;
        }
        for (let i = 0; i < items.length; i += JSON_CHUNK_SIZE) {
          chunks.push(JSON.stringify(items.slice(i, i + JSON_CHUNK_SIZE)));
        }
      } else {
        const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          setMessage('That CSV file has no data rows.');
          setStatus('error');
          return;
        }
        const header = lines[0];
        const dataLines = lines.slice(1);
        for (let i = 0; i < dataLines.length; i += CSV_CHUNK_SIZE) {
          chunks.push([header, ...dataLines.slice(i, i + CSV_CHUNK_SIZE)].join('\n'));
        }
      }

      let totalAdded = 0;
      let totalChecked = 0;
      let totalSkipped = 0;

      for (let i = 0; i < chunks.length; i++) {
        setMessage(
          chunks.length > 1
            ? `Importing batch ${i + 1} of ${chunks.length}… (${totalAdded} added so far)`
            : 'Importing…'
        );
        const result = await sendChunk(chunks[i]);
        totalAdded += result.added;
        totalChecked += result.checked;
        totalSkipped += result.skippedAsDuplicate;
      }

      setMessage(
        `Imported ${totalAdded} of ${totalChecked} rows found in the file` +
          (totalSkipped > 0 ? ` (${totalSkipped} skipped as duplicates of scrobbles already logged, e.g. from Spotify sync).` : '.')
      );
      setStatus('idle');
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not read that file.');
      setStatus('error');
    }
  }

  return (
    <div className="bg-panel border border-line rounded-lg p-4">
      <p className="text-paper text-sm font-medium">No API key needed</p>
      <p className="text-muted text-xs mt-1 mb-3 max-w-md">
        Export your data at{' '}
        <a
          href="https://mainstream.ghan.nl/export.html"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brass hover:underline"
        >
          mainstream.ghan.nl/export.html
        </a>{' '}
        — enter your Last.fm username, pick "Scrobbles" or "Loved tracks,"
        choose CSV or JSON format, and click Go. Then upload the downloaded
        file here. CSV is recommended over JSON for large histories — it's
        far more compact per track, so it splits into fewer, safer batches.
      </p>

      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setMode('scrobbles')}
          className={`text-xs px-3 py-1.5 rounded-full border transition ${
            mode === 'scrobbles' ? 'bg-brass text-ink border-brass' : 'border-line text-muted'
          }`}
        >
          This is a scrobbles file
        </button>
        <button
          onClick={() => setMode('loved')}
          className={`text-xs px-3 py-1.5 rounded-full border transition ${
            mode === 'loved' ? 'bg-brass text-ink border-brass' : 'border-line text-muted'
          }`}
        >
          This is a loved tracks file
        </button>
      </div>

      <label className="inline-block text-xs px-4 py-2 rounded-full bg-brass text-ink font-medium cursor-pointer">
        {status === 'loading' ? 'Importing…' : 'Choose file (.csv or .json)'}
        <input
          type="file"
          accept=".csv,.json,text/csv,application/json"
          className="hidden"
          disabled={status === 'loading'}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
      </label>

      {fileName && <span className="text-muted text-xs ml-3">{fileName}</span>}

      {message && (
        <p className={`text-xs mt-3 ${status === 'error' ? 'text-danger' : 'text-signal'}`}>{message}</p>
      )}

      <div className="mt-4 pt-4 border-t border-line">
        <p className="text-muted text-xs mb-2 max-w-md">
          Already imported before this was fixed, and worried about
          duplicates from Last.fm scrobbling your Spotify listening? Clean
          up anything that duplicates a play already logged from another
          source.
        </p>
        <button
          onClick={runDedupe}
          disabled={dedupeStatus === 'loading'}
          className="text-xs px-4 py-2 rounded-full border border-line text-muted hover:text-paper hover:border-brass transition disabled:opacity-50"
        >
          {dedupeStatus === 'loading' ? 'Checking…' : 'Remove duplicate Last.fm plays'}
        </button>
        {dedupeMsg && <p className="text-signal text-xs mt-2">{dedupeMsg}</p>}
      </div>
    </div>
  );
}
