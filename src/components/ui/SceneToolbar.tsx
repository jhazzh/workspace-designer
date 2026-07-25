'use client';

import { useWorkspace, type TransformMode } from '@/store/useWorkspace';

const MODES: { mode: TransformMode; label: string; key: string }[] = [
  { mode: 'translate', label: 'Move', key: 'W' },
  { mode: 'rotate', label: 'Rotate', key: 'E' },
  { mode: 'scale', label: 'Scale', key: 'R' },
];

export function SceneToolbar() {
  const s = useWorkspace();
  const canUndo = s.undoStack.length > 0;
  const canRedo = s.redoStack.length > 0;

  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-2xl border border-black/5 bg-white/85 p-1.5 shadow-lg backdrop-blur">
      <div className="flex rounded-xl bg-stone-100 p-0.5">
        {MODES.map((m) => (
          <button
            key={m.mode}
            onClick={() => s.setMode(m.mode)}
            title={`${m.label} (${m.key})`}
            aria-pressed={s.mode === m.mode}
            className={`rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition ${
              s.mode === m.mode
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <Divider />

      <Toggle on={s.roomMode === 'walls'} onClick={() => s.setRoomMode(s.roomMode === 'walls' ? 'open' : 'walls')} title="Toggle walls">
        {s.roomMode === 'walls' ? 'Walls' : 'Open'}
      </Toggle>

      <Toggle on={s.snap} onClick={() => s.setSnap(!s.snap)} title="Snap to grid (X)">
        Snap
      </Toggle>

      <Toggle on={s.collide} onClick={() => s.setCollide(!s.collide)} title="Collision (C)">
        Collide
      </Toggle>

      <Divider />

      <Plain onClick={s.requestArrange} disabled={s.placed.length < 2} title="Auto-arrange (A)">
        Tidy up
      </Plain>

      <Plain onClick={s.undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
        ↺
      </Plain>
      <Plain onClick={s.redo} disabled={!canRedo} title="Redo (Ctrl+Y)" aria-label="Redo">
        ↻
      </Plain>

      <Plain onClick={s.clear} disabled={!s.placed.length} title="Remove everything">
        Clear
      </Plain>
    </div>
  );
}

const Divider = () => <span className="mx-0.5 h-5 w-px bg-stone-200" aria-hidden />;

function Toggle({
  on,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { on: boolean }) {
  return (
    <button
      {...rest}
      aria-pressed={on}
      className={`rounded-xl px-2.5 py-1.5 text-[13px] font-medium transition ${
        on
          ? 'bg-stone-900 text-white'
          : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
      }`}
    >
      {children}
    </button>
  );
}

function Plain(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="rounded-xl px-2.5 py-1.5 text-[13px] font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
    />
  );
}
