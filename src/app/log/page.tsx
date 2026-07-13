import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import LogForm from '@/components/LogForm';
import RecommendationsInbox from '@/components/RecommendationsInbox';

export default async function LogPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/');

  return (
    <div>
      <h1 className="font-display italic text-2xl text-paper">Log a scrobble</h1>
      <p className="text-muted text-sm mt-2 max-w-md">
        Search Spotify's catalog, or type it in by hand — for the record you played on
        vinyl, the show you saw live, or anything Spotify doesn't know about.
      </p>
      <div className="mt-8">
        <RecommendationsInbox />
        <LogForm />
      </div>
    </div>
  );
}
