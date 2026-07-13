import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { computeTopArtists, computeTopTracks, computeTopAlbums, type StatPlay } from '@/lib/stats';
import SettingsForm from '@/components/SettingsForm';
import LastfmImportForm from '@/components/LastfmImportForm';
import LastfmFileImport from '@/components/LastfmFileImport';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) redirect('/');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) redirect('/');

  const plays = await prisma.play.findMany({
    where: { userId },
    orderBy: { playedAt: 'desc' },
    take: 8000, // only used for top-5 pin candidates — full history isn't needed here
    select: { artistName: true, trackName: true, albumName: true, albumArt: true, playedAt: true, durationMs: true, source: true },
  });
  const statPlays = plays as StatPlay[];

  const candidates = {
    artist: computeTopArtists(statPlays, 5),
    track: computeTopTracks(statPlays, 5),
    album: computeTopAlbums(statPlays, 5),
  };

  return (
    <div>
      <h1 className="font-display italic text-2xl text-paper">Settings</h1>
      <p className="text-muted text-sm mt-2">Customize your profile.</p>

      <SettingsForm
        initialBio={user.bio || ''}
        initialTheme={user.themeColor}
        initialTimezone={user.timezone}
        initialLocationName={user.locationName}
        initialTempUnit={user.tempUnit}
        initialLastfmUsername={user.lastfmUsername}
        initialFactsArtistName={user.factsArtistName}
        hasCustomBanner={!!user.bannerImage}
        initialPin={
          user.pinnedLabel
            ? {
                type: user.pinnedType || 'artist',
                label: user.pinnedLabel,
                sublabel: user.pinnedSublabel,
                art: user.pinnedArt,
              }
            : null
        }
        candidates={candidates}
      />

      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-widest text-muted font-mono border-b border-line pb-2">
          Import from Last.fm
        </h2>
        <p className="text-muted text-xs mt-3 mb-3 max-w-md">
          Bring in your Last.fm scrobble history or loved tracks alongside
          your Spotify data — logged with a distinct "Last.fm" badge so you
          can tell them apart from Spotify plays and Spotify's own liked
          songs.
        </p>

        <LastfmFileImport />

        <details className="mt-4">
          <summary className="text-xs text-muted cursor-pointer hover:text-paper transition">
            Prefer a live import instead? (requires your own free Last.fm API key)
          </summary>
          <div className="mt-3">
            <LastfmImportForm />
          </div>
        </details>
      </section>

      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-widest text-muted font-mono border-b border-line pb-2">
          Your data
        </h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href="/api/export"
            download
            className="text-xs px-4 py-2 rounded-full border border-line text-muted hover:text-paper hover:border-brass transition"
          >
            Export as CSV
          </a>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-widest text-muted font-mono border-b border-line pb-2">
          Shareable recap
        </h2>
        <p className="text-muted text-xs mt-3 max-w-md">
          This image updates automatically with your current stats — share the
          link or save the image.
        </p>
        <div className="mt-3 border border-line rounded-lg overflow-hidden max-w-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/recap/${user.username}`} alt="Your recap card" className="w-full h-auto" />
        </div>
      </section>
    </div>
  );
}
