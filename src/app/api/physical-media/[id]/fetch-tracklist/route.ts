import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchDiscogsRelease } from '@/lib/discogs';

// Backfills tracklist data for a shelf item that doesn't have one yet —
// mainly releases added via bulk "Import Discogs collection," which
// intentionally skips fetching each release's tracklist individually (that
// would be one extra API call per release, easily hundreds for a real
// collection). Without a tracklist, "own it" matching can only fall back
// to an exact artist-name match, which misses tracks credited differently
// (a skit credited to a character's name instead of the album artist, for
// example) — fetching the real tracklist fixes that at the source.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const item = await prisma.physicalMedia.findUnique({ where: { id: params.id } });
  if (!item || item.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!item.discogsReleaseId) {
    return NextResponse.json({ error: 'This item has no linked Discogs release to fetch a tracklist from.' }, { status: 400 });
  }

  const detail = await fetchDiscogsRelease(item.discogsReleaseId);
  if (!detail) {
    return NextResponse.json({ error: 'Could not fetch that release from Discogs.' }, { status: 400 });
  }
  if (detail.tracks.length === 0) {
    return NextResponse.json({ error: 'Discogs has no tracklist on file for this release.' }, { status: 400 });
  }

  await prisma.physicalMediaTrack.deleteMany({ where: { physicalMediaId: item.id } });
  await prisma.physicalMediaTrack.createMany({
    data: detail.tracks.map((t) => ({
      physicalMediaId: item.id,
      trackName: t.trackName,
      position: t.position,
    })),
  });

  return NextResponse.json({ added: detail.tracks.length });
}
