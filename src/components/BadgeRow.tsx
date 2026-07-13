import Link from 'next/link';
import type { Badge } from '@/lib/stats';

// Maps each badge to where its underlying stat actually lives, so
// clicking one takes you to the number it's measuring instead of just
// sitting there as a static label.
const BADGE_LINKS: Record<string, string> = {
  'Century Club': '?tab=overview#stats',
  'The Archive': '?tab=overview#stats',
  'On a Roll': '?tab=overview#stats',
  'Creature of Habit': '?tab=overview#stats',
  Explorer: '?tab=overview#stats',
  'Eclectic Ear': '?tab=overview#stats',
  'The Loyalist': '?tab=overview#stats',
  'Night Owl': '?tab=nerd#listening-clock',
  'Early Bird': '?tab=nerd#listening-clock',
};

export default function BadgeRow({ badges }: { badges: Badge[] }) {
  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((b) => (
        <Link
          key={b.label}
          href={BADGE_LINKS[b.label] || '?tab=overview#stats'}
          title={b.description}
          className="flex items-center gap-1.5 bg-panel border border-line rounded-full px-3 py-1.5 hover:border-brass transition"
        >
          <span>{b.emoji}</span>
          <span className="text-xs text-paper">{b.label}</span>
        </Link>
      ))}
    </div>
  );
}
