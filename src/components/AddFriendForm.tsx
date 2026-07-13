'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AddFriendForm() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
      } else {
        setUsername('');
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="friend's username"
        className="flex-1 bg-panel2 border border-line rounded-md px-3 py-2 text-sm text-paper placeholder:text-muted focus:outline-none focus:border-brass"
      />
      <button
        disabled={loading}
        className="px-4 py-2 rounded-md bg-brass text-ink text-sm font-medium hover:brightness-110 transition disabled:opacity-50"
      >
        Follow
      </button>
      {error && <span className="text-danger text-xs self-center ml-2">{error}</span>}
    </form>
  );
}
