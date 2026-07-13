import { ImageResponse } from 'next/og';
import { prisma } from '@/lib/prisma';
import { computeTopArtists, type StatPlay } from '@/lib/stats';

// Runs in the default Node.js runtime (not edge) so Prisma's regular
// Postgres connection works as-is.
export async function GET(
  req: Request,
  { params }: { params: { username: string } }
) {
  const user = await prisma.user.findUnique({ where: { username: params.username } });
  if (!user) return new Response('Not found', { status: 404 });

  const plays = await prisma.play.findMany({
    where: { userId: user.id },
    select: { artistName: true, trackName: true, albumName: true, albumArt: true, playedAt: true, durationMs: true, source: true },
  });

  const topArtists = computeTopArtists(plays as StatPlay[], 5);
  const totalPlays = plays.length;
  const displayName = user.name || user.username;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#12161D',
          color: '#E7E3D6',
          padding: '60px 70px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 30, color: '#C9974B', fontStyle: 'italic' }}>
          spinlog
        </div>

        <div style={{ display: 'flex', fontSize: 46, marginTop: 28, fontWeight: 600 }}>
          {displayName}&apos;s recap
        </div>
        <div style={{ display: 'flex', fontSize: 22, color: '#8B93A1', marginTop: 10 }}>
          {totalPlays} plays logged
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 44, gap: 18 }}>
          {topArtists.map((a, i) => (
            <div key={a.key} style={{ display: 'flex', fontSize: 30, alignItems: 'center' }}>
              <div style={{ display: 'flex', color: '#C9974B', width: 56 }}>{i + 1}</div>
              <div style={{ display: 'flex', flex: 1 }}>{a.label}</div>
              <div style={{ display: 'flex', color: '#8B93A1', fontSize: 22 }}>{a.count}×</div>
            </div>
          ))}
          {topArtists.length === 0 && (
            <div style={{ display: 'flex', color: '#8B93A1', fontSize: 24 }}>No scrobbles yet</div>
          )}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
