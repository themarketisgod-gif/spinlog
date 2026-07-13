import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { computeTopArtists, computeTopTracks, type StatPlay } from '@/lib/stats';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Without a cap, aggregating every group member's entire play history
// (which can be tens of thousands of rows each after a large Last.fm
// import) risks exceeding Vercel's memory limit and crashing the page.
const MAX_PLAYS_PER_PERSON = 5000;

export default async function LeaderboardPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect('/');

  const following = await prisma.friendship.findMany({
    where: { followerId: userId },
    select: { followedId: true },
  });
  const groupIds = [userId, ...following.map((f) => f.followedId)];

  const playsPerPerson = await Promise.all(
    groupIds.map((id) =>
      prisma.play.findMany({
        where: { userId: id },
        orderBy: { playedAt: 'desc' },
        take: MAX_PLAYS_PER_PERSON,
        select: {
          artistName: true,
          trackName: true,
          albumName: true,
          albumArt: true,
          playedAt: true,
          durationMs: true,
          source: true,
          userId: true,
          user: { select: { name: true, username: true } },
        },
      })
    )
  );
  const plays = playsPerPerson.flat();

  const statPlays = plays as unknown as StatPlay[];
  const topArtists = computeTopArtists(statPlays, 10);
  const topTracks = computeTopTracks(statPlays, 10);

  // Who's logged the most, across the group
  const playCountByUser = new Map<string, { name: string; count: number }>();
  for (const p of plays) {
    const existing = playCountByUser.get(p.userId);
    const label = p.user.name || p.user.username;
    if (existing) existing.count += 1;
    else playCountByUser.set(p.userId, { name: label, count: 1 });
  }
  const leaderboard = [...playCountByUser.values()].sort((a, b) => b.count - a.count);

  return (
    <div>
      <h1 className="font-display italic text-2xl text-paper">Group leaderboard</h1>
      <p className="text-muted text-sm mt-2">
        Combined across you and everyone you follow — {groupIds.length}{' '}
        {groupIds.length === 1 ? 'listener' : 'listeners'}.
      </p>

      {plays.length === 0 ? (
        <p className="text-muted text-sm py-8">
          Follow some friends to see a combined leaderboard.
        </p>
      ) : (
        <>
          <section className="mt-8">
            <SectionLabel>Most active</SectionLabel>
            <ol className="mt-3">
              {leaderboard.map((u, i) => (
                <li key={u.name} className="ledger-row flex items-center justify-between py-2.5">
                  <span className="flex items-center gap-3">
                    <span className="font-mono text-xs text-brass w-4">{i + 1}</span>
                    <span className="text-paper">{u.name}</span>
                  </span>
                  <span className="font-mono text-xs text-muted">{u.count} scrobbles</span>
                </li>
              ))}
            </ol>
          </section>

          <div className="grid md:grid-cols-2 gap-8 mt-10">
            <section>
              <SectionLabel>Group's top artists</SectionLabel>
              <ol className="mt-3">
                {topArtists.map((item, i) => (
                  <li key={item.key} className="ledger-row flex items-center justify-between py-2.5">
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs text-brass w-4">{i + 1}</span>
                      <span className="truncate text-paper">{item.label}</span>
                    </span>
                    <span className="font-mono text-xs text-muted flex-shrink-0">{item.count}×</span>
                  </li>
                ))}
              </ol>
            </section>

            <section>
              <SectionLabel>Group's top tracks</SectionLabel>
              <ol className="mt-3">
                {topTracks.map((item, i) => (
                  <li key={item.key} className="ledger-row flex items-center justify-between py-2.5 gap-2">
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs text-brass w-4">{i + 1}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-paper">{item.label}</span>
                        <span className="block truncate text-muted text-xs">{item.sublabel}</span>
                      </span>
                    </span>
                    <span className="font-mono text-xs text-muted flex-shrink-0">{item.count}×</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs uppercase tracking-widest text-muted font-mono border-b border-line pb-2">
      {children}
    </h2>
  );
}
