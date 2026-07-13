'use client';

import { useState } from 'react';

export default function RatingStars({
  trackName,
  artistName,
  albumArt,
  initialRating = 0,
  initialDisliked = false,
  showTitle = false,
}: {
  trackName: string;
  artistName: string;
  albumArt?: string | null;
  initialRating?: number;
  initialDisliked?: boolean;
  showTitle?: boolean;
}) {
  const [rating, setRating] = useState(initialRating);
  const [disliked, setDisliked] = useState(initialDisliked);
  const [hover, setHover] = useState(0);

  async function rate(value: number) {
    const next = value === rating ? 0 : value; // clicking the same star clears it
    setRating(next);
    setDisliked(false);
    if (next === 0) {
      await fetch('/api/ratings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackName, artistName }),
      });
    } else {
      await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackName, artistName, albumArt, rating: next }),
      });
    }
  }

  async function toggleDislike() {
    const next = !disliked;
    setDisliked(next);
    setRating(0);
    if (next) {
      await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackName, artistName, albumArt, disliked: true }),
      });
    } else {
      await fetch('/api/ratings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackName, artistName }),
      });
    }
  }

  return (
    <div>
      {showTitle && (
        <p className="text-xs uppercase tracking-widest text-muted font-mono mb-2">Your rating</p>
      )}
      <div className="flex items-center gap-3">
        <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((star) => (
            <button
              key={star}
              onClick={() => rate(star)}
              onMouseEnter={() => setHover(star)}
              className="text-2xl leading-none transition hover:scale-110"
              style={{ color: (hover || rating) >= star ? 'var(--accent, #C9974B)' : '#2E3644' }}
              aria-label={`Rate ${star} out of 10`}
            >
              ★
            </button>
          ))}
          {rating > 0 && <span className="text-sm text-muted font-mono ml-2">{rating}/10</span>}
        </div>
        <button
          onClick={toggleDislike}
          className="text-2xl leading-none transition hover:scale-110"
          style={{ filter: disliked ? 'none' : 'grayscale(1)', opacity: disliked ? 1 : 0.4 }}
          aria-label="Dislike this track"
          title="Dislike"
        >
          👎
        </button>
      </div>
    </div>
  );
}
