'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';

const OPTIONS: { value: string; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
];

export default function RangeSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get('range') || 'all';

  function setRange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('range', value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setRange(opt.value)}
          className={`text-xs px-3 py-1 rounded-full border transition ${
            current === opt.value
              ? 'bg-brass text-ink border-brass'
              : 'border-line text-muted hover:text-paper'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
