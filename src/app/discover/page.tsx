import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { getValidAccessToken, fetchUserPlaylists } from '@/lib/spotify';
import DiscoverForm from '@/components/DiscoverForm';

export default async function DiscoverPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect('/');

  let playlists: Awaited<ReturnType<typeof fetchUserPlaylists>> = [];
  let playlistIds: { id: string; name: string }[] = [];
  try {
    const accessToken = await getValidAccessToken(userId);
    if (accessToken) {
      // fetchUserPlaylists doesn't return raw Spotify IDs (only display
      // data), so we re-fetch with IDs here directly.
      const res = await fetch('https://api.spotify.com/v1/me/playlists?limit=20', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        playlistIds = (data.items || []).map((p: any) => ({ id: p.id, name: p.name }));
      }
    }
  } catch {
    // stays empty, form just won't have options
  }

  return (
    <div>
      <h1 className="font-display italic text-2xl text-paper">Discover</h1>
      <p className="text-muted text-sm mt-2 max-w-lg">
        Genre-tag matching against tracks already logged somewhere in
        Spinlog — yours or a friend&apos;s. This can only surface things
        someone in the group has actually played; it doesn&apos;t reach into
        Spotify&apos;s full catalog, since the API endpoints that would allow
        that were deprecated by Spotify in 2024.
      </p>

      <div className="mt-8">
        <DiscoverForm playlists={playlistIds} />
      </div>
    </div>
  );
}
