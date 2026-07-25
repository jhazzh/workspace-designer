'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { byId } from '@/data/catalog';
import { useWorkspace, selectedIds } from '@/store/useWorkspace';
import { quote, money } from '@/lib/pricing';
import { SlotPicker } from './SlotPicker';
import { SummaryPanel } from './SummaryPanel';
import { SceneToolbar } from './SceneToolbar';
import { LayoutDialog } from './LayoutDialog';

// three.js touches `window` at module scope, so it must never run on the server
const WorkspaceCanvas = dynamic(() => import('@/components/scene/WorkspaceCanvas'), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-content-center text-sm text-stone-400">
      Preparing your room…
    </div>
  ),
});

export function Designer() {
  const placed = useWorkspace((s) => s.placed);
  const selected = useWorkspace((s) => s.selected);
  const toast = useWorkspace((s) => s.toast);
  const say = useWorkspace((s) => s.say);
  const months = useWorkspace((s) => s.months);

  // mobile only: one panel at a time, or the canvas is squeezed to nothing. lg ignores this.
  const [panel, setPanel] = useState<'catalog' | 'summary' | null>(null);
  const toggle = (p: 'catalog' | 'summary') => setPanel((cur) => (cur === p ? null : p));

  const monthly = quote(selectedIds(placed), months).monthly;

  useKeyboardShortcuts();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => say(null), 1600);
    return () => clearTimeout(t);
  }, [toast, say]);

  const selectedName = selected
    ? byId(placed.find((p) => p.uid === selected)?.itemId ?? '')?.name
    : null;

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-stone-100 text-stone-900 lg:flex-row">
      {/* catalog */}
      <aside
        aria-label="Catalog"
        className="order-2 flex min-h-0 shrink-0 flex-col border-t border-stone-200 bg-white lg:order-1 lg:h-full lg:w-[300px] lg:border-r lg:border-t-0 z-1"
      >
        <header className="hidden px-4 pb-2 pt-4 lg:block">
          <h1 className="text-[15px] font-semibold">Workspace Designer</h1>
          <p className="mt-0.5 text-[13px] text-stone-500">
            Build your setup, then rent it.
          </p>
        </header>

        <PanelToggle
          open={panel === 'catalog'}
          onClick={() => toggle('catalog')}
          controls="catalog-body"
          label="Catalog"
          hint={`${placed.length} placed`}
        />

        {/* Collapsed content is removed outright, not just clipped: max-h-0
            leaves it focusable and hit-testable. Desktop is never collapsed. */}
        <div
          id="catalog-body"
          className={`min-h-0 flex-1 lg:block lg:max-h-none ${
            panel === 'catalog' ? 'max-h-[45dvh]' : 'hidden'
          }`}
        >
          <SlotPicker />
        </div>
      </aside>

      {/* stage */}
      {/* min-w-0 + overflow-hidden: R3F measures this box, so it must be able to shrink */}
      <section className="relative order-1 z-1 min-h-0 min-w-0 flex-1 overflow-hidden lg:order-2">
        <WorkspaceCanvas />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex max-w-full justify-center p-3">
          <SceneToolbar />
        </div>

        {placed.length === 0 && (
          <div className="pointer-events-none absolute inset-0 grid place-content-center px-6 text-center">
            <p className="text-lg font-medium text-stone-500">Your room is empty</p>
            <p className="mt-1 text-sm text-stone-400">
              Pick a desk to get started. Drag to orbit, shift-drag to pan, scroll to zoom.
            </p>
          </div>
        )}

        {toast && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-stone-900/90 px-3.5 py-1.5 text-[13px] text-white shadow-lg">
            {toast}
          </div>
        )}

        {selectedName ? (
          <div className="pointer-events-none absolute bottom-4 left-4 hidden rounded-lg bg-white/85 px-2.5 py-1.5 text-[12px] text-stone-600 shadow backdrop-blur lg:block">
            <b className="font-medium text-stone-900">{selectedName}</b> selected · drag
            the handles · <kbd className="font-sans">Del</kbd> to remove
          </div>
        ) : (
          placed.length > 0 && (
            <div className="pointer-events-none absolute bottom-4 left-4 hidden rounded-lg bg-white/85 px-2.5 py-1.5 text-[12px] text-stone-600 shadow backdrop-blur lg:block">
              drag to orbit · <kbd className="font-sans">Shift</kbd>-drag to pan · scroll to
              zoom
            </div>
          )
        )}

        <LayoutDialog />

        {/* screen-reader narration for canvas-only changes */}
        <p aria-live="polite" className="sr-only">
          {selectedName ? `${selectedName} selected. ` : ''}
          {placed.length} item{placed.length === 1 ? '' : 's'} in your workspace.
        </p>
      </section>

      {/* summary */}
      <aside
        aria-label="Your setup"
        className="order-3 flex min-h-0 shrink-0 flex-col border-t border-stone-200 bg-white lg:h-full lg:w-[320px] lg:border-l lg:border-t-0"
      >
        <PanelToggle
          open={panel === 'summary'}
          onClick={() => toggle('summary')}
          controls="summary-body"
          label="Your setup"
          hint={placed.length ? `${money(monthly)}/mo` : 'Empty'}
        />

        <div
          id="summary-body"
          className={`min-h-0 flex-1 lg:block lg:max-h-none ${
            panel === 'summary' ? 'max-h-[45dvh]' : 'hidden'
          }`}
        >
          <SummaryPanel />
        </div>
      </aside>
    </main>
  );
}

/** Mobile-only header that expands its panel. Hidden from lg up, where both panels are always open. */
function PanelToggle({
  open,
  onClick,
  controls,
  label,
  hint,
}: {
  open: boolean;
  onClick: () => void;
  controls: string;
  label: string;
  hint: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-expanded={open}
      aria-controls={controls}
      className="flex shrink-0 items-center justify-between px-4 py-3 text-left lg:hidden"
    >
      <span className="text-[13px] font-semibold">{label}</span>
      <span className="flex items-center gap-2 text-[13px] text-stone-500">
        {hint}
        <span aria-hidden className={`transition-transform ${open ? '' : 'rotate-180'}`}>
          ⌃
        </span>
      </span>
    </button>
  );
}

/** Mirrors the shortcuts from the original composer prototype. */
function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;

      const s = useWorkspace.getState();
      const k = e.key.toLowerCase();

      if ((e.ctrlKey || e.metaKey) && k === 'z') {
        e.preventDefault();
        e.shiftKey ? s.redo() : s.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && k === 'y') {
        e.preventDefault();
        s.redo();
        return;
      }
      if (e.ctrlKey || e.metaKey) return;

      if (k === 'w') s.setMode('translate');
      else if (k === 'e') s.setMode('rotate');
      else if (k === 'x') s.setSnap(!s.snap);
      else if (k === 'c') s.setCollide(!s.collide);
      else if (k === 'a') s.requestArrange();
      else if (k === 'd' && s.selected) s.duplicate(s.selected);
      else if (k === 'escape') s.select(null);
      else if ((e.key === 'Delete' || e.key === 'Backspace') && s.selected) {
        e.preventDefault();
        s.remove(s.selected);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
