'use client';

import { useState } from 'react';

interface CommentItem {
  id: string;
  body: string;
  authorName: string;
}

export default function PlayActions({
  playId,
  initialReactionCount,
  initialReacted,
  initialComments,
}: {
  playId: string;
  initialReactionCount: number;
  initialReacted: boolean;
  initialComments: CommentItem[];
}) {
  const [reacted, setReacted] = useState(initialReacted);
  const [reactionCount, setReactionCount] = useState(initialReactionCount);
  const [comments, setComments] = useState(initialComments);
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  async function toggleReaction() {
    setReacted(!reacted);
    setReactionCount((c) => (reacted ? c - 1 : c + 1));
    try {
      await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playId, emoji: '🔥' }),
      });
    } catch {
      // revert on failure
      setReacted(reacted);
      setReactionCount(initialReactionCount);
    }
  }

  async function postComment() {
    if (!draft.trim()) return;
    setPosting(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playId, body: draft }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments((c) => [...c, { id: data.comment.id, body: data.comment.body, authorName: data.comment.author.name || data.comment.author.username }]);
        setDraft('');
      }
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="pl-14 pb-3 -mt-1">
      <div className="flex items-center gap-4 text-xs">
        <button
          onClick={toggleReaction}
          className={`flex items-center gap-1 transition ${reacted ? 'text-brass' : 'text-muted hover:text-paper'}`}
        >
          🔥 {reactionCount > 0 && <span className="font-mono">{reactionCount}</span>}
        </button>
        <button
          onClick={() => setShowComments(!showComments)}
          className="text-muted hover:text-paper transition"
        >
          💬 {comments.length > 0 ? `${comments.length} comment${comments.length === 1 ? '' : 's'}` : 'Comment'}
        </button>
      </div>

      {showComments && (
        <div className="mt-2 space-y-1.5">
          {comments.map((c) => (
            <div key={c.id} className="text-xs">
              <span className="text-brass">{c.authorName}</span>{' '}
              <span className="text-paper">{c.body}</span>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && postComment()}
              placeholder="Add a comment…"
              className="flex-1 bg-panel2 border border-line rounded-md px-2.5 py-1.5 text-xs text-paper placeholder:text-muted focus:outline-none focus:border-brass"
            />
            <button
              onClick={postComment}
              disabled={posting}
              className="text-xs px-3 py-1.5 rounded-md bg-brass text-ink font-medium disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
