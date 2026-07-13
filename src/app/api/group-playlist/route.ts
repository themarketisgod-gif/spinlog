import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getValidAccessToken, createCollaborativePlaylist } from '@/lib/spotify';

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  // Show group playlists created by you or anyone you follow — a simple
  // stand-in for "your friend group's shared playlists" without a formal
  // membership model.
  const following = await prisma.friendship.findMany({
    where: { followerId: userId },
    select: { followedId: true },
  });
  const creatorIds = [userId, ...following.map((f: { followedId: string }) => f.followedId)];

  const playlists = await prisma.groupPlaylist.findMany({
    where: { creatorId: { in: creatorIds } },
    orderBy: { createdAt: 'desc' },
    include: { creator: { select: { name: true, username: true } } },
  });

  return NextResponse.json({ playlists });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    return NextResponse.json({ error: 'No Spotify token — try signing out and back in.' }, { status: 400 });
  }

  const created = await createCollaborativePlaylist(
    accessToken,
    name.trim(),
    'A shared playlist for the group, built with Spinlog.'
  );
  if (!created) {
    return NextResponse.json({ error: 'Spotify rejected the playlist creation.' }, { status: 500 });
  }

  const saved = await prisma.groupPlaylist.create({
    data: {
      creatorId: userId,
      name: name.trim(),
      spotifyPlaylistId: created.playlistId,
      spotifyUrl: created.playlistUrl,
    },
  });

  return NextResponse.json({ playlist: saved });
}
