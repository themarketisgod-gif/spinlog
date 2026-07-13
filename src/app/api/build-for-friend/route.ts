import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getValidAccessToken, createPlaylistFromTracks } from '@/lib/spotify';

// Builds a real Spotify playlist inside the FRIEND's own account (using
// their stored token, not the viewer's), seeded from every track the
// viewer has ever recommended them. This only works because we already
// have each user's own access/refresh token from when they signed in —
// we can never act on an account we don't have a token for.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const viewerId = (session?.user as any)?.id;
  if (!viewerId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { username } = await req.json();
  const friend = await prisma.user.findUnique({ where: { username } });
  if (!friend) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (friend.id === viewerId) {
    return NextResponse.json({ error: "That's your own profile — use the regular export button." }, { status: 400 });
  }

  const recs = await prisma.recommendation.findMany({
    where: { fromUserId: viewerId, toUserId: friend.id, spotifyUri: { not: null } },
  });
  const uris: string[] = [
    ...new Set(recs.map((r: { spotifyUri: string | null }) => r.spotifyUri).filter((u: string | null): u is string => !!u)),
  ] as string[];
  if (uris.length === 0) {
    return NextResponse.json(
      { error: "You haven't recommended them any trackable songs yet." },
      { status: 400 }
    );
  }

  const friendAccessToken = await getValidAccessToken(friend.id);
  if (!friendAccessToken) {
    return NextResponse.json(
      { error: `${friend.name || friend.username} needs to sign in again before this will work.` },
      { status: 400 }
    );
  }

  const viewer = await prisma.user.findUnique({ where: { id: viewerId } });
  const result = await createPlaylistFromTracks(
    friendAccessToken,
    `From ${viewer?.name || viewer?.username}`,
    `Songs recommended to you by ${viewer?.name || viewer?.username} on Spinlog.`,
    uris
  );

  if (!result) {
    return NextResponse.json({ error: 'Spotify rejected the playlist creation.' }, { status: 500 });
  }

  return NextResponse.json({ playlistUrl: result.playlistUrl });
}
