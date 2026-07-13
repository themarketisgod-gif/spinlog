'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export interface LayoutSection {
  id: string;
  label: string;
  node: React.ReactNode;
}

export default function ReorderableSections({
  tab,
  sections,
  savedOrder,
}: {
  tab: string;
  sections: LayoutSection[];
  savedOrder: string[] | null;
}) {
  const defaultOrder = sections.map((s) => s.id);
  const initialOrder =
    savedOrder && savedOrder.length > 0
      ? [...savedOrder.filter((id) => defaultOrder.includes(id)), ...defaultOrder.filter((id) => !savedOrder.includes(id))]
      : defaultOrder;

  const [order, setOrder] = useState<string[]>(initialOrder);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const dragIndex = useRef<number | null>(null);
  const router = useRouter();

  const byId = new Map(sections.map((s) => [s.id, s]));

  function move(from: number, to: number) {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setOrder(next);
  }

  async function save(newOrder: string[]) {
    setSaving(true);
    setMessage('');
    try {
      await fetch('/api/settings/layout', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab, order: newOrder }),
      });
      setMessage('Layout saved ✓');
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function resetLayout() {
    setSaving(true);
    try {
      await fetch('/api/settings/layout', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab }),
      });
      setOrder(defaultOrder);
      setMessage('Reset to default ✓');
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setEditMode(!editMode)}
          className={`text-xs px-3 py-1.5 rounded-full border transition ${
            editMode ? 'bg-brass text-ink border-brass' : 'border-line text-muted hover:text-paper'
          }`}
        >
          {editMode ? 'Done customizing' : '✎ Customize layout'}
        </button>
        {editMode && (
          <div className="flex items-center gap-3">
            {message && <span className="text-signal text-xs">{message}</span>}
            <button
              onClick={resetLayout}
              disabled={saving}
              className="text-xs text-muted hover:text-danger transition disabled:opacity-50"
            >
              Reset to default
            </button>
            <button
              onClick={() => save(order)}
              disabled={saving}
              className="text-xs px-3 py-1.5 rounded-full bg-brass text-ink font-medium disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save layout'}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {order.map((id, i) => {
          const section = byId.get(id);
          if (!section) return null;
          return (
            <div
              key={id}
              draggable={editMode}
              onDragStart={() => {
                dragIndex.current = i;
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex.current !== null && dragIndex.current !== i) {
                  move(dragIndex.current, i);
                }
                dragIndex.current = null;
              }}
              className={editMode ? 'border border-dashed border-line rounded-lg p-3' : ''}
            >
              {editMode && (
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-line">
                  <span className="text-xs text-muted flex items-center gap-2">
                    <span className="cursor-grab select-none" title="Drag to reorder">⠿</span>
                    {section.label}
                  </span>
                  <span className="flex items-center gap-1">
                    <button
                      onClick={() => move(i, i - 1)}
                      disabled={i === 0}
                      className="text-xs w-6 h-6 rounded border border-line text-muted hover:text-paper disabled:opacity-30 transition"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => move(i, i + 1)}
                      disabled={i === order.length - 1}
                      className="text-xs w-6 h-6 rounded border border-line text-muted hover:text-paper disabled:opacity-30 transition"
                    >
                      ↓
                    </button>
                  </span>
                </div>
              )}
              {section.node}
            </div>
          );
        })}
      </div>
    </div>
  );
}
