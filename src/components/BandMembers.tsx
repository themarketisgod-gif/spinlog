'use client';

import { useState } from 'react';

interface Member {
  name: string;
  mbid: string;
  begin: string | null;
  end: string | null;
  current: boolean;
}

interface OtherBand {
  name: string;
  begin: string | null;
  end: string | null;
}

function yearOnly(date: string | null): string {
  if (!date) return '';
  return date.slice(0, 4);
}

function MemberRow({ member }: { member: Member }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bands, setBands] = useState<OtherBand[] | null>(null);

  async function toggle() {
    if (!expanded && !bands) {
      setLoading(true);
      try {
        const res = await fetch(`/api/member-bands?mbid=${member.mbid}`);
        const data = await res.json();
        setBands(data.bands || []);
      } finally {
        setLoading(false);
      }
    }
    setExpanded(!expanded);
  }

  const tenure = [yearOnly(member.begin), member.current ? 'present' : yearOnly(member.end)]
    .filter(Boolean)
    .join('–');

  return (
    <div className="py-2">
      <button onClick={toggle} className="flex items-center justify-between w-full text-left group">
        <span className="text-paper text-sm group-hover:text-brass transition">{member.name}</span>
        <span className="text-muted text-xs flex-shrink-0">{tenure}</span>
      </button>
      {expanded && (
        <div className="mt-1.5 pl-3 border-l border-line">
          {loading && <p className="text-muted text-xs">Looking up other bands…</p>}
          {!loading && bands && bands.length === 0 && (
            <p className="text-muted text-xs">No other bands on file with MusicBrainz.</p>
          )}
          {!loading && bands && bands.length > 0 && (
            <ul className="space-y-0.5">
              {bands.map((b, i) => (
                <li key={i} className="text-xs text-muted">
                  {b.name}
                  {(b.begin || b.end) && (
                    <span className="text-muted/70"> ({[yearOnly(b.begin), b.end ? yearOnly(b.end) : 'present'].filter(Boolean).join('–')})</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function BandMembers({ members }: { members: Member[] }) {
  if (members.length === 0) return null;

  return (
    <section>
      <h2 className="text-xs uppercase tracking-widest text-muted font-mono border-b border-line pb-2">
        Band members
      </h2>
      <p className="text-muted text-xs mt-2 mb-1">
        Click a member to see other bands they've played in, per MusicBrainz.
      </p>
      <div className="mt-2 divide-y divide-line">
        {members.map((m) => (
          <MemberRow key={m.mbid} member={m} />
        ))}
      </div>
    </section>
  );
}
