export default function ProfileBanner({
  bannerImage,
  albumArts,
}: {
  bannerImage: string | null;
  albumArts: string[];
}) {
  if (bannerImage) {
    return (
      <div className="w-full h-40 sm:h-56 rounded-lg overflow-hidden mb-6 bg-panel2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bannerImage} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }

  if (albumArts.length === 0) return null;

  const GRID_SIZE = 8;
  const tiles = Array.from({ length: GRID_SIZE }, (_, i) => albumArts[i % albumArts.length]);

  return (
    <div className="w-full h-40 sm:h-56 rounded-lg overflow-hidden mb-6 grid grid-cols-8 gap-0.5 bg-panel2">
      {tiles.map((art, i) => (
        <div key={i} className="relative overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={art} alt="" className="w-full h-full object-cover opacity-80" />
        </div>
      ))}
    </div>
  );
}
