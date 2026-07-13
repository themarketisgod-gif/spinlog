'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeletePlayButton({ playId }: { playId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function confirmDelete() {
    setDeleting(true);
    try {
      await fetch(`/api/plays/${playId}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <span className="text-xs flex items-center gap-1.5">
        <button onClick={confirmDelete} disabled={deleting} className="text-danger hover:underline disabled:opacity-50">
          {deleting ? 'Deleting…' : 'Confirm'}
        </button>
        <span className="text-muted">/</span>
        <button onClick={() => setConfirming(false)} className="text-muted hover:text-paper">
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs text-muted hover:text-danger transition"
      title="Delete this play from Spinlog"
    >
      Delete
    </button>
  );
}
