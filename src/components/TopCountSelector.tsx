'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export default function TopCountSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get('topCount') || '5';

  function setCount(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('topCount', value);
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted">Show:</span>
      {['5', '10', '25', '50'].map((n) => (
        <button
          key={n}
          onClick={() => setCount(n)}
          className={`text-xs px-2.5 py-1 rounded-full border transition ${
            current === n ? 'bg-brass text-ink border-brass' : 'border-line text-muted hover:text-paper'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
