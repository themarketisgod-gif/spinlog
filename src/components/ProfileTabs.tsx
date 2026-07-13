'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type TabKey = 'overview' | 'nerd' | 'history' | 'personality';

export default function ProfileTabs({
  overview,
  nerdData,
  history,
  personality,
}: {
  overview: React.ReactNode;
  nerdData: React.ReactNode;
  history: React.ReactNode;
  personality: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const urlTab = searchParams.get('tab');
  const initial: TabKey =
    urlTab === 'nerd' || urlTab === 'history' || urlTab === 'personality' ? urlTab : 'overview';
  const [tab, setTab] = useState<TabKey>(initial);

  // If the page loads (or re-loads) with a ?tab= param — e.g. from a
  // Dashboard or badge link — switch to that tab and then let the browser
  // scroll to any #anchor, since the target only becomes visible once its
  // tab is selected (the other tabs stay in the DOM but display:none).
  useEffect(() => {
    if (urlTab === 'nerd' || urlTab === 'history' || urlTab === 'personality') {
      setTab(urlTab);
      requestAnimationFrame(() => {
        if (window.location.hash) {
          document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTab]);

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'nerd', label: '🤓 Nerd Data' },
    { key: 'history', label: '📜 History' },
    { key: 'personality', label: '🎭 Personality' },
  ];

  return (
    <div>
      <div className="flex gap-1 border-b border-line mb-8 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-sm px-4 py-2.5 -mb-px border-b-2 transition ${
              tab === t.key
                ? 'border-brass text-paper'
                : 'border-transparent text-muted hover:text-paper'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* display:none rather than unmounting keeps client-side state (like
          expanded "Find similar" panels) intact when switching tabs */}
      <div style={{ display: tab === 'overview' ? 'block' : 'none' }}>{overview}</div>
      <div style={{ display: tab === 'nerd' ? 'block' : 'none' }}>{nerdData}</div>
      <div style={{ display: tab === 'history' ? 'block' : 'none' }}>{history}</div>
      <div style={{ display: tab === 'personality' ? 'block' : 'none' }}>{personality}</div>
    </div>
  );
}

