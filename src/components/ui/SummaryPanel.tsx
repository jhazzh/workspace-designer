'use client';

import { useState } from 'react';
import { byId } from '@/data/catalog';
import { useWorkspace, selectedIds } from '@/store/useWorkspace';
import { quote, money, MIN_MONTHS, MAX_MONTHS } from '@/lib/pricing';

export function SummaryPanel() {
  const placed = useWorkspace((s) => s.placed);
  const months = useWorkspace((s) => s.months);
  const setMonths = useWorkspace((s) => s.setMonths);
  const remove = useWorkspace((s) => s.remove);
  const select = useWorkspace((s) => s.select);
  const selected = useWorkspace((s) => s.selected);
  const [busy, setBusy] = useState(false);

  const q = quote(selectedIds(placed), months);
  const empty = placed.length === 0;

  async function rent() {
    setBusy(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds(placed), months }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error(data.error ?? 'Checkout unavailable');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <h2 className="flex items-baseline justify-between text-xs font-semibold uppercase tracking-wide text-stone-500">
          Your setup
          {!empty && (
            <span className="tabular-nums font-medium normal-case tracking-normal text-stone-400">
              {placed.length} {placed.length === 1 ? 'item' : 'items'}
            </span>
          )}
        </h2>

        {empty ? (
          <p className="mt-3 rounded-lg border border-dashed border-stone-300 p-4 text-sm text-stone-500">
            Nothing yet. Start with a desk.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-stone-100">
            {placed.map((p) => {
              const item = byId(p.itemId);
              if (!item) return null;
              const active = selected === p.uid;
              return (
                <li key={p.uid} className="group flex items-center gap-2 py-2">
                  <button
                    onClick={() => select(active ? null : p.uid)}
                    className={`min-w-0 flex-1 text-left text-sm ${
                      active ? 'text-stone-900' : 'text-stone-700'
                    }`}
                  >
                    <span className={`truncate ${active ? 'font-medium' : ''}`}>
                      {item.name}
                    </span>
                  </button>
                  <span className="shrink-0 text-sm tabular-nums text-stone-500">
                    {money(item.monthly)}
                  </span>
                  <button
                    onClick={() => remove(p.uid)}
                    aria-label={`Remove ${item.name}`}
                    className="shrink-0 rounded p-1 text-stone-300 transition hover:bg-red-50 hover:text-red-500"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                      <path
                        d="M3 3l8 8M11 3l-8 8"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-stone-200 bg-stone-50 px-4 py-3">
        <div>
          <label
            htmlFor="months"
            className="flex items-baseline justify-between text-sm"
          >
            <span className="font-medium text-stone-700">Rental length</span>
            <span className="tabular-nums text-stone-600">
              {months} {months === 1 ? 'month' : 'months'}
            </span>
          </label>
          <input
            id="months"
            type="range"
            min={MIN_MONTHS}
            max={MAX_MONTHS}
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="mt-2 w-full accent-stone-900"
          />
          <div className="flex justify-between text-[11px] text-stone-400">
            <span>1 mo</span>
            <span>12 mo</span>
          </div>
          {q.discount > 0 && (
            <p className="mt-1.5 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[12px] font-medium text-emerald-700">
              {Math.round(q.discount * 100)}% long-stay discount applied
            </p>
          )}
        </div>
        <dl className="space-y-1 text-sm">
          <Row
            label="Items"
            value={`${placed.length}`}
            muted={empty}
          />
          <Row label="Monthly rate" value={money(q.monthly)} muted={empty} />
          <Row label="Refundable deposit" value={money(q.deposit)} muted={empty} />
          <div className="flex items-baseline justify-between border-t border-stone-200 pt-2 text-base font-semibold text-stone-900">
            <dt>Due today</dt>
            <dd className="tabular-nums">{money(q.dueToday)}</dd>
          </div>
        </dl>

        <button
          onClick={rent}
          disabled={empty || busy}
          className="mt-3 w-full rounded-xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          {busy ? 'Opening checkout…' : empty ? 'Add items to rent' : 'Rent this setup'}
        </button>
        <p className="mt-2 text-center text-[11px] text-stone-400">
          Deposit refunded when you return the gear. Test mode — no real charge.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-stone-600">{label}</dt>
      <dd className={`tabular-nums ${muted ? 'text-stone-300' : 'text-stone-800'}`}>
        {value}
      </dd>
    </div>
  );
}
