'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function FollowButton({
  username,
  initiallyFollowing,
}: {
  username: string;
  initiallyFollowing: boolean;
}) {
  const [following, setFollowing] = useState(initiallyFollowing);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch('/api/friends', {
        method: following ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      if (res.ok) {
        setFollowing(!following);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`text-xs px-4 py-1.5 rounded-full font-medium transition disabled:opacity-50 ${
        following
          ? 'border border-line text-muted hover:border-danger hover:text-danger'
          : 'bg-brass text-ink hover:brightness-110'
      }`}
    >
      {following ? 'Following' : 'Follow'}
    </button>
  );
}
