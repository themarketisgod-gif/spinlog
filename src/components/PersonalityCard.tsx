import type { PersonalityType } from '@/lib/stats';

export default function PersonalityCard({ type }: { type: PersonalityType }) {
  return (
    <div className="bg-panel border border-line rounded-lg p-5">
      <div className="font-display italic text-4xl text-brass mb-4">{type.code}</div>
      <div className="space-y-3">
        {type.axes.map((axis) => (
          <div key={axis.code}>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-panel2 flex items-center justify-center text-xs font-mono text-brass flex-shrink-0">
                {axis.code}
              </span>
              <span className="text-paper text-sm font-medium">{axis.label}</span>
            </div>
            <p className="text-muted text-xs mt-1 pl-8">{axis.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
