import { getServerSession } from 'next-auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fameLabel } from '@/lib/musicbrainz';

export const dynamic = 'force-dynamic';

export default async function TagPage({ params }: { params: { tag: string } }) {
  const session = await getServerSession(authOptions);
  const viewerId = (session?.user as any)?.id as string | undefined;

  const tag = decodeURIComponent(params.tag);

  const artists = await prisma.artistMetadataCache.findMany({
    where: { tags: { has: tag } },
    orderBy: { wikidataSitelinks: 'desc' },
    take: 100,
  });

  if (artists.length === 0) notFound();

  let loggedArtistNames = new Set<string>();
  let viewerUsername: string | null = null;
  if (viewerId) {
    const viewer = await prisma.user.findUnique({ where: { id: viewerId }, select: { username: true } });
    viewerUsername = viewer?.username || null;
    const rows = await prisma.play.findMany({
      where: { userId: viewerId, artistName: { in: artists.map((a) => a.artistName) } },
      distinct: ['artistName'],
      select: { artistName: true },
    });
    loggedArtistNames = new Set(rows.map((r) => r.artistName));
  }

  return (
    <div>
      <h1 className="font-display italic text-2xl text-paper capitalize">{tag}</h1>
      <p className="text-muted text-sm mt-2 max-w-lg">
        Every artist cached in Spinlog with this tag — a simple
        recommendation surface built from real MusicBrainz genre data, not
        an algorithm. Artists you've logged link to your own listening
        data for them; everyone else links out to discover them.
      </p>

      <div className="mt-8 space-y-2">
        {artists.map((a) => {
          const logged = loggedArtistNames.has(a.artistName);
          return (
            <div key={a.artistName} className="ledger-row flex items-center justify-between py-2.5 gap-3">
              {logged && viewerUsername ? (
                <Link
                  href={`/u/${viewerUsername}/artist/${encodeURIComponent(a.artistName)}`}
                  className="text-paper text-sm truncate hover:text-brass transition"
                >
                  {a.artistName}
                </Link>
              ) : (
                <a
                  href={`https://open.spotify.com/search/${encodeURIComponent(a.artistName)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-paper text-sm truncate hover:text-brass transition"
                >
                  {a.artistName}
                </a>
              )}
              <span className="flex items-center gap-2 flex-shrink-0 text-xs">
                {logged && viewerUsername && (
                  <Link
                    href={`/u/${viewerUsername}/artist/${encodeURIComponent(a.artistName)}`}
                    className="text-signal text-[10px] uppercase tracking-wide bg-signal/10 border border-signal/40 rounded-full px-2 py-0.5 hover:bg-signal/20 transition"
                  >
                    You've scrobbled this →
                  </Link>
                )}
                {a.wikidataSitelinks !== null && (
                  <span className="text-brass">{fameLabel(a.wikidataSitelinks)}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
