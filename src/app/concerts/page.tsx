import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import ConcertManager from '@/components/ConcertManager';

export default async function ConcertsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/');

  return (
    <div>
      <h1 className="font-display italic text-2xl text-paper">Concerts</h1>
      <p className="text-muted text-sm mt-2 max-w-lg">
        Log shows you've attended, with the real setlist pulled from
        setlist.fm where available. If a concert has a setlist attached,
        only those specific songs get tagged "seen live" wherever they
        appear in your plays. If you skip the setlist (fully optional),
        every song by that artist gets tagged instead, since there's no
        song-level data to be more precise about.
      </p>
      <div className="mt-8">
        <ConcertManager />
      </div>
    </div>
  );
}
