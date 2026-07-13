'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BannerUpload({ hasCustomBanner }: { hasCustomBanner: boolean }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const router = useRouter();

  async function handleFile(file: File) {
    if (file.size > 2_500_000) {
      setMessage('That file is too large — try something under ~2MB.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setMessage('');
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/settings/banner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Could not upload.');
        setStatus('error');
        return;
      }
      setStatus('idle');
      router.refresh();
    } catch {
      setMessage('Could not read that file.');
      setStatus('error');
    }
  }

  async function remove() {
    await fetch('/api/settings/banner', { method: 'DELETE' });
    router.refresh();
  }

  return (
    <div>
      <p className="text-muted text-xs mb-2 max-w-md">
        Without a custom banner, your profile shows an auto-generated
        collage of your top albums' covers instead.
      </p>
      <div className="flex items-center gap-3">
        <label className="text-xs px-4 py-2 rounded-full bg-brass text-ink font-medium cursor-pointer">
          {status === 'loading' ? 'Uploading…' : hasCustomBanner ? 'Replace banner' : 'Upload banner'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={status === 'loading'}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />
        </label>
        {hasCustomBanner && (
          <button onClick={remove} className="text-xs text-muted hover:text-danger transition">
            Remove
          </button>
        )}
      </div>
      {message && <p className="text-danger text-xs mt-2">{message}</p>}
    </div>
  );
}
