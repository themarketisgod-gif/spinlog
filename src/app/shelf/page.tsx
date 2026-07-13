import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import ShelfManager from '@/components/ShelfManager';

export default async function ShelfPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/');

  return (
    <div>
      <h1 className="font-display italic text-2xl text-paper">Shelf</h1>
      <p className="text-muted text-sm mt-2 max-w-lg">
        Catalog the vinyl, CDs, and cassettes you actually own, via Discogs
        or by hand. If a release has its full tracklist attached, matching
        songs get tagged wherever they show up in your plays — otherwise
        the whole release counts, same idea as a concert logged without a
        setlist.
      </p>
      <div className="mt-8">
        <ShelfManager />
      </div>
    </div>
  );
}
