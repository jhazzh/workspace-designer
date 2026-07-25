'use client';

import { useState } from 'react';
import { SLOTS, bySlot, byId, type Slot } from '@/data/catalog';
import { useWorkspace } from '@/store/useWorkspace';
import { money } from '@/lib/pricing';

export function SlotPicker() {
  const [tab, setTab] = useState<Slot>('desk');
  const placed = useWorkspace((s) => s.placed);
  const setSlot = useWorkspace((s) => s.setSlot);
  const toggle = useWorkspace((s) => s.toggle);

  const meta = SLOTS.find((s) => s.slot === tab)!;
  const items = bySlot(tab);
  const chosen = new Set(placed.map((p) => p.itemId));
  const countIn = (slot: Slot) =>
    placed.filter((p) => byId(p.itemId)?.slot === slot).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        role="tablist"
        aria-label="Item categories"
        className="flex gap-1 overflow-x-auto border-b border-stone-200 px-3 pb-2"
      >
        {SLOTS.map((s) => {
          const n = countIn(s.slot);
          const active = tab === s.slot;
          return (
            <button
              key={s.slot}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(s.slot)}
              className={`relative shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              {s.label}
              {n > 0 && (
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${
                    active ? 'bg-white/20' : 'bg-stone-200 text-stone-700'
                  }`}
                >
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <ul className="grid gap-2">
          {items.map((item) => {
            const on = chosen.has(item.id);
            return (
              <li key={item.id}>
                <button
                  onClick={() =>
                    meta.multi
                      ? toggle(item.id)
                      : setSlot(tab, on ? null : item.id)
                  }
                  aria-pressed={on}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    on
                      ? 'border-stone-900 bg-stone-900/[0.04] ring-1 ring-stone-900'
                      : 'border-stone-200 hover:border-stone-400 hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="mt-0.5 h-9 w-9 shrink-0 rounded-lg border border-black/10"
                      style={{ background: item.color }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-medium text-stone-900">
                          {item.name}
                        </span>
                        <span className="shrink-0 text-sm tabular-nums text-stone-600">
                          {money(item.monthly)}
                          <span className="text-stone-400">/mo</span>
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-stone-500">
                        {item.blurb}
                      </span>
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-3 px-1 text-[12px] leading-relaxed text-stone-400">
          {meta.multi
            ? 'Add as many as you like. Click again to remove.'
            : 'Pick one. Choosing another swaps it out.'}
        </p>
      </div>
    </div>
  );
}
