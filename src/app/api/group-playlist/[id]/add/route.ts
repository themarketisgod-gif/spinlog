import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getValidAccessToken, addTracksToPlaylist } from '@/lib/spotify';

// Any signed-in user can add to a group playlist using their OWN Spotify
// token — this is what makes it genuinely multi-user, since the track gets
// added by the account that clicked, not by whoever created the playlist.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { spotifyUri } = await req.json();
  if (!spotifyUri) return NextResponse.json({ error: 'spotifyUri is required' }, { status: 400 });

  const playlist = await prisma.groupPlaylist.findUnique({ where: { id: params.id } });
  if (!playlist) return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    return NextResponse.json({ error: 'No Spotify token — try signing out and back in.' }, { status: 400 });
  }

  const result = await addTracksToPlaylist(accessToken, playlist.spotifyPlaylistId, [spotifyUri]);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Spotify rejected the add — you may need to be added as a collaborator first." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
