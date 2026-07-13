export default function TagCloud({ tags }: { tags: { tag: string; count: number }[] }) {
  if (tags.length === 0) return null;
  const max = Math.max(...tags.map((t) => t.count));
  const min = Math.min(...tags.map((t) => t.count));

  function sizeFor(count: number) {
    if (max === min) return 14;
    const scale = (count - min) / (max - min);
    return 12 + scale * 14; // 12px to 26px
  }

  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      {tags.map((t) => (
        <span
          key={t.tag}
          style={{ fontSize: `${sizeFor(t.count)}px` }}
          className="text-paper hover:text-brass transition-colors cursor-default"
          title={`${t.count} tag${t.count === 1 ? '' : 's'}`}
        >
          {t.tag}
        </span>
      ))}
    </div>
  );
}
