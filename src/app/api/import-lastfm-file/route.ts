import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseLastfmExport } from '@/lib/lastfm-parser';

// Large exports can mean thousands of rows — give this route more time
// than the default before Vercel considers it timed out.
export const maxDuration = 60;

const MAX_ROWS = 20000;
// Last.fm's scrobble timestamp and Spotify's own playedAt for the same
// real listen aren't always identical to the second, so cross-source
// duplicate detection allows a small window rather than requiring an
// exact match.
const DEDUPE_TOLERANCE_MS = 2 * 60 * 1000;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode');
  const content = await req.text();

  if (!content?.trim()) return NextResponse.json({ error: 'No file content received' }, { status: 400 });

  const rows = parseLastfmExport(content).slice(0, MAX_ROWS);
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Couldn't find any usable rows — check this is the CSV or JSON export from mainstream.ghan.nl/export.html." },
      { status: 400 }
    );
  }

  // Checked against every source, not just past Last.fm imports — if
  // Last.fm was scrobbling your Spotify listening (a common setup), this
  // import would otherwise duplicate everything our own Spotify sync
  // already captured.
  const existing = await prisma.play.findMany({
    where: { userId },
    select: { trackName: true, artistName: true, playedAt: true },
  });
  const existingByKey = new Map<string, number[]>();
  for (const p of existing as { trackName: string; artistName: string; playedAt: Date }[]) {
    const key = `${p.trackName.toLowerCase()}::${p.artistName.toLowerCase()}`;
    const list = existingByKey.get(key);
    if (list) list.push(p.playedAt.getTime());
    else existingByKey.set(key, [p.playedAt.getTime()]);
  }

  function isDuplicate(trackName: string, artistName: string, playedAt: Date): boolean {
    const key = `${trackName.toLowerCase()}::${artistName.toLowerCase()}`;
    const times = existingByKey.get(key);
    if (!times) return false;
    const t = playedAt.getTime();
    return times.some((existingTime) => Math.abs(existingTime - t) <= DEDUPE_TOLERANCE_MS);
  }

  function remember(trackName: string, artistName: string, playedAt: Date) {
    const key = `${trackName.toLowerCase()}::${artistName.toLowerCase()}`;
    const list = existingByKey.get(key);
    if (list) list.push(playedAt.getTime());
    else existingByKey.set(key, [playedAt.getTime()]);
  }

  const toInsert = [];
  let skippedAsDuplicate = 0;
  for (const r of rows) {
    if (isDuplicate(r.trackName, r.artistName, r.playedAt)) {
      skippedAsDuplicate += 1;
      continue;
    }
    remember(r.trackName, r.artistName, r.playedAt);
    toInsert.push({
      userId,
      trackName: r.trackName,
      artistName: r.artistName,
      albumName: r.albumName,
      source: 'lastfm',
      manualSource: mode === 'loved' ? 'loved' : 'scrobble',
      playedAt: r.playedAt,
    });
  }

  if (toInsert.length > 0) {
    await prisma.play.createMany({ data: toInsert });
  }

  return NextResponse.json({ added: toInsert.length, checked: rows.length, skippedAsDuplicate });
}
