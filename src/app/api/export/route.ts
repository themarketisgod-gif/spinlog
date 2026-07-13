import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function csvEscape(value: string) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const plays = await prisma.play.findMany({
    where: { userId },
    orderBy: { playedAt: 'desc' },
  });

  const header = ['played_at', 'track', 'artist', 'album', 'duration_ms', 'source'];
  const rows = plays.map((p) =>
    [
      p.playedAt.toISOString(),
      p.trackName,
      p.artistName,
      p.albumName || '',
      p.durationMs?.toString() || '',
      p.source,
    ]
      .map(csvEscape)
      .join(',')
  );

  const csv = [header.join(','), ...rows].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="spinlog-export.csv"',
    },
  });
}
