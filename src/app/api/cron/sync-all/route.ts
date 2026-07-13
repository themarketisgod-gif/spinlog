import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getValidAccessToken, fetchRecentlyPlayed, fetchSavedTracks } from '@/lib/spotify';
import { fetchLovedTracks } from '@/lib/lastfm';

export const maxDuration = 60;

const DEDUPE_TOLERANCE_MS = 2 * 60 * 1000;

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: { OR: [{ refreshToken: { not: null } }, { lastfmUsername: { not: null } }] },
    select: { id: true, username: true, lastfmUsername: true },
  });

  const results: { username: string; playsAdded: number; likesAdded: number; lastfmLovedAdded: number; error?: string }[] = [];

  for (const user of users) {
    let playsAdded = 0;
    let likesAdded = 0;
    let lastfmLovedAdded = 0;
    let error: string | undefined;

    try {
      const accessToken = await getValidAccessToken(user.id);
      if (accessToken) {
        const recentTracks = await fetchRecentlyPlayed(accessToken);
        for (const t of recentTracks) {
          try {
            await prisma.play.create({
              data: {
                userId: user.id,
                trackName: t.trackName,
                artistName: t.artistName,
                albumName: t.albumName,
                albumArt: t.albumArt,
                durationMs: t.durationMs,
                spotifyUri: t.spotifyUri,
                primaryArtistId: t.primaryArtistId,
                releaseYear: t.releaseYear,
                artistNames: t.artistNames,
                source: 'spotify',
                playedAt: new Date(t.playedAt),
              },
            });
            playsAdded += 1;
          } catch {
            // duplicate, ignore
          }
        }

        const savedTracks = await fetchSavedTracks(accessToken, 500);
        for (const t of savedTracks) {
          try {
            await prisma.play.create({
              data: {
                userId: user.id,
                trackName: t.trackName,
                artistName: t.artistName,
                albumName: t.albumName,
                albumArt: t.albumArt,
                durationMs: t.durationMs,
                spotifyUri: t.spotifyUri,
                primaryArtistId: t.primaryArtistId,
                releaseYear: t.releaseYear,
                artistNames: t.artistNames,
                source: 'library',
                playedAt: new Date(t.addedAt),
              },
            });
            likesAdded += 1;
          } catch {
            // duplicate, ignore
          }
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Spotify sync failed';
    }

    // Last.fm loved tracks — independent of whether Spotify sync above
    // succeeded, since these are two separate connections.
    if (user.lastfmUsername && process.env.LASTFM_API_KEY) {
      try {
        const loved = await fetchLovedTracks(user.lastfmUsername, 1000);
        if (loved.length > 0) {
          const existing = await prisma.play.findMany({
            where: { userId: user.id },
            select: { trackName: true, artistName: true, playedAt: true },
          });
          const existingByKey = new Map<string, number[]>();
          for (const p of existing) {
            const key = `${p.trackName.toLowerCase()}::${p.artistName.toLowerCase()}`;
            const list = existingByKey.get(key);
            if (list) list.push(p.playedAt.getTime());
            else existingByKey.set(key, [p.playedAt.getTime()]);
          }

          for (const t of loved) {
            const key = `${t.trackName.toLowerCase()}::${t.artistName.toLowerCase()}`;
            const times = existingByKey.get(key) || [];
            const isDuplicate = times.some((existingTime) => Math.abs(existingTime - t.lovedAt.getTime()) <= DEDUPE_TOLERANCE_MS);
            if (isDuplicate) continue;

            try {
              await prisma.play.create({
                data: {
                  userId: user.id,
                  trackName: t.trackName,
                  artistName: t.artistName,
                  albumArt: t.albumArt,
                  source: 'lastfm',
                  manualSource: 'loved',
                  playedAt: t.lovedAt,
                },
              });
              lastfmLovedAdded += 1;
              const list = existingByKey.get(key);
              if (list) list.push(t.lovedAt.getTime());
              else existingByKey.set(key, [t.lovedAt.getTime()]);
            } catch {
              // duplicate, ignore
            }
          }
        }
      } catch (err) {
        error = (error ? `${error}; ` : '') + (err instanceof Error ? err.message : 'Last.fm sync failed');
      }
    }

    results.push({ username: user.username, playsAdded, likesAdded, lastfmLovedAdded, error });
  }

  return NextResponse.json({ usersProcessed: users.length, results });
}
