'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PageJump({ range, totalPages }: { range: string; totalPages: number }) {
  const [value, setValue] = useState('');
  const router = useRouter();

  function jump(e: React.FormEvent) {
    e.preventDefault();
    const page = Math.min(totalPages, Math.max(1, parseInt(value, 10) || 1));
    router.push(`?range=${range}&page=${page}`);
  }

  return (
    <form onSubmit={jump} className="flex items-center gap-1.5">
      <input
        type="number"
        min={1}
        max={totalPages}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Page #"
        className="w-16 bg-panel2 border border-line rounded-md px-2 py-1 text-xs text-paper placeholder:text-muted focus:outline-none focus:border-brass"
      />
      <button type="submit" className="text-xs text-muted hover:text-brass transition">
        Go
      </button>
    </form>
  );
}
