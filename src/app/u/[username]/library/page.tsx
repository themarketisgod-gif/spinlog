import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import LibraryBrowser from '@/components/LibraryBrowser';

export const dynamic = 'force-dynamic';

export default async function LibraryPage({ params }: { params: { username: string } }) {
  const user = await prisma.user.findUnique({ where: { username: params.username } });
  if (!user) notFound();

  const plays = await prisma.play.findMany({
    where: { userId: user.id },
    select: { artistName: true, playedAt: true },
  });

  const map = new Map<string, { count: number; firstPlayed: Date; lastPlayed: Date }>();
  for (const p of plays) {
    const existing = map.get(p.artistName);
    if (existing) {
      existing.count += 1;
      if (p.playedAt < existing.firstPlayed) existing.firstPlayed = p.playedAt;
      if (p.playedAt > existing.lastPlayed) existing.lastPlayed = p.playedAt;
    } else {
      map.set(p.artistName, { count: 1, firstPlayed: p.playedAt, lastPlayed: p.playedAt });
    }
  }

  const artists = [...map.entries()]
    .map(([name, data]) => ({
      name,
      count: data.count,
      firstPlayed: data.firstPlayed.toISOString(),
      lastPlayed: data.lastPlayed.toISOString(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <Link href={`/u/${user.username}`} className="text-xs text-muted hover:text-brass transition">
        ← Back to profile
      </Link>
      <h1 className="font-display italic text-2xl text-paper mt-3">
        {user.name || user.username}&apos;s library
      </h1>
      <p className="text-muted text-sm mt-1">{artists.length} artists, alphabetically.</p>

      <div className="mt-6">
        <LibraryBrowser artists={artists} />
      </div>
    </div>
  );
}
