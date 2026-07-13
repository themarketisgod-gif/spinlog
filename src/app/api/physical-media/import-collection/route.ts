import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchDiscogsCollection } from '@/lib/discogs';

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { username } = await req.json();
  if (!username?.trim()) return NextResponse.json({ error: 'Discogs username is required' }, { status: 400 });

  if (!process.env.DISCOGS_TOKEN) {
    return NextResponse.json({ error: "Discogs isn't configured — add DISCOGS_TOKEN to enable this." }, { status: 400 });
  }

  const collection = await fetchDiscogsCollection(username.trim(), 500);
  if (collection.length === 0) {
    return NextResponse.json(
      { error: "No releases found — check the username, or that their collection folder is public." },
      { status: 400 }
    );
  }

  const existing = await prisma.physicalMedia.findMany({
    where: { userId, discogsReleaseId: { not: null } },
    select: { discogsReleaseId: true },
  });
  const existingIds = new Set(existing.map((e: { discogsReleaseId: string | null }) => e.discogsReleaseId));

  let added = 0;
  for (const item of collection) {
    if (existingIds.has(item.releaseId)) continue;
    existingIds.add(item.releaseId);
    try {
      await prisma.physicalMedia.create({
        data: {
          userId,
          artistName: item.artistName,
          releaseTitle: item.releaseTitle,
          format: item.format,
          year: item.year,
          coverArt: item.coverArt,
          discogsReleaseId: item.releaseId,
          discogsUrl: `https://www.discogs.com/release/${item.releaseId}`,
          source: 'discogs',
        },
      });
      added += 1;
    } catch {
      // skip on individual failure
    }
  }

  return NextResponse.json({ added, checked: collection.length });
}
