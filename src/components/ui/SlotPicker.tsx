'use client';

import { useState } from 'react';
import { SLOTS, bySlot, byId, type Slot } from '@/data/catalog';
import { useWorkspace } from '@/store/useWorkspace';
import { money } from '@/lib/pricing';

export function SlotPicker() {
  const [tab, setTab] = useState<Slot>('desk');
  const placed = useWorkspace((s) => s.placed);
  const setSlot = useWorkspace((s) => s.setSlot);
  const addOne = useWorkspace((s) => s.addOne);
  const removeOne = useWorkspace((s) => s.removeOne);

  const meta = SLOTS.find((s) => s.slot === tab)!;
  const items = bySlot(tab);
  const qtyOf = (itemId: string) => placed.filter((p) => p.itemId === itemId).length;
  const countIn = (slot: Slot) =>
    placed.filter((p) => byId(p.itemId)?.slot === slot).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        role="tablist"
        aria-label="Item categories"
        className="flex min-w-0 gap-1 overflow-x-auto border-b border-stone-200 px-3 pb-2"
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
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
          {items.map((item) => {
            const qty = qtyOf(item.id);
            const on = qty > 0;
            return (
              <li
                key={item.id}
                className={`rounded-xl border transition ${
                  on
                    ? 'border-stone-900 bg-stone-900/[0.04] ring-1 ring-inset ring-stone-900'
                    : 'border-stone-200 hover:border-stone-400 hover:bg-stone-50'
                }`}
              >
                <button
                  onClick={() =>
                    meta.multi ? addOne(item.id) : setSlot(tab, on ? null : item.id)
                  }
                  aria-label={meta.multi ? `Add ${item.name}` : item.name}
                  aria-pressed={meta.multi ? undefined : on}
                  className="w-full rounded-xl p-3 text-left"
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

                {meta.multi && on && (
                  <div className="flex items-center justify-end gap-1 border-t border-stone-900/10 px-3 py-1.5">
                    <Step
                      label={`Remove one ${item.name}`}
                      onClick={() => removeOne(item.id)}
                    >
                      −
                    </Step>
                    <span
                      aria-live="polite"
                      className="min-w-8 text-center text-sm font-medium tabular-nums text-stone-900"
                    >
                      {qty}
                    </span>
                    <Step label={`Add one ${item.name}`} onClick={() => addOne(item.id)}>
                      +
                    </Step>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <p className="mt-3 px-1 text-[12px] leading-relaxed text-stone-400">
          {meta.multi
            ? 'Click to add. Use − and + to change how many.'
            : 'Pick one. Choosing another swaps it out.'}
        </p>
      </div>
    </div>
  );
}

/** Square −/+ control in an item's quantity stepper. */
function Step({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="grid h-7 w-7 place-content-center rounded-md border border-stone-300 bg-white text-base leading-none text-stone-700 transition hover:border-stone-500 hover:text-stone-900"
    >
      {children}
    </button>
  );
}
