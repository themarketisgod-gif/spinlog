import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchRecentTracks, fetchLovedTracks } from '@/lib/lastfm';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { username, mode } = await req.json();
  if (!username?.trim()) return NextResponse.json({ error: 'Last.fm username is required' }, { status: 400 });

  if (!process.env.LASTFM_API_KEY) {
    return NextResponse.json(
      { error: "Last.fm isn't configured — add LASTFM_API_KEY to enable this." },
      { status: 400 }
    );
  }

  // Normalize both shapes (scrobbles use `playedAt`, loved tracks use
  // `lovedAt`, and only scrobbles carry an album name) into one common
  // shape before importing.
  const normalized: { trackName: string; artistName: string; albumName: string | null; albumArt: string | null; playedAt: Date }[] =
    mode === 'loved'
      ? (await fetchLovedTracks(username.trim(), 1000)).map((t) => ({
          trackName: t.trackName,
          artistName: t.artistName,
          albumName: null,
          albumArt: t.albumArt,
          playedAt: t.lovedAt,
        }))
      : (await fetchRecentTracks(username.trim(), 1000)).map((t) => ({
          trackName: t.trackName,
          artistName: t.artistName,
          albumName: t.albumName,
          albumArt: t.albumArt,
          playedAt: t.playedAt,
        }));

  if (normalized.length === 0) {
    return NextResponse.json(
      { error: "No tracks found — check the username, or that user's history is public." },
      { status: 400 }
    );
  }

  // Checked against every source, not just past Last.fm imports — if
  // Last.fm was scrobbling your Spotify listening (a common setup), this
  // import would otherwise duplicate everything our own Spotify sync
  // already captured. A small time tolerance accounts for the two
  // services not always recording the exact same second for one listen.
  const DEDUPE_TOLERANCE_MS = 2 * 60 * 1000;
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

  let added = 0;
  for (const t of normalized) {
    if (isDuplicate(t.trackName, t.artistName, t.playedAt)) continue;
    remember(t.trackName, t.artistName, t.playedAt);

    try {
      await prisma.play.create({
        data: {
          userId,
          trackName: t.trackName,
          artistName: t.artistName,
          albumName: t.albumName,
          albumArt: t.albumArt,
          source: 'lastfm',
          manualSource: mode === 'loved' ? 'loved' : 'scrobble',
          playedAt: t.playedAt,
        },
      });
      added += 1;
    } catch {
      // skip on any individual insert failure rather than aborting the batch
    }
  }

  return NextResponse.json({ added, checked: normalized.length });
}

