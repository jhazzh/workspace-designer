'use client';

import { useRef } from 'react';
import { useWorkspace, type TransformMode } from '@/store/useWorkspace';

/** Big enough for a detailed room, small enough not to wedge the tab. */
const MAX_ROOM_MB = 60;

const MODES: { mode: TransformMode; label: string; key: string }[] = [
  { mode: 'translate', label: 'Move', key: 'W' },
  { mode: 'rotate', label: 'Rotate', key: 'E' },
];

export function SceneToolbar() {
  // Subscribe per field rather than to the whole store: a blanket
  // useWorkspace() re-renders the toolbar on every unrelated change.
  const mode = useWorkspace((s) => s.mode);
  const roomMode = useWorkspace((s) => s.roomMode);
  const snap = useWorkspace((s) => s.snap);
  const collide = useWorkspace((s) => s.collide);
  const itemCount = useWorkspace((s) => s.placed.length);
  const canUndo = useWorkspace((s) => s.undoStack.length > 0);
  const canRedo = useWorkspace((s) => s.redoStack.length > 0);

  const roomModel = useWorkspace((s) => s.roomModel);

  const setMode = useWorkspace((s) => s.setMode);
  const setRoomMode = useWorkspace((s) => s.setRoomMode);
  const setRoomModel = useWorkspace((s) => s.setRoomModel);
  const say = useWorkspace((s) => s.say);
  const roomInput = useRef<HTMLInputElement>(null);

  const onRoomFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    // reset first so picking the same file twice still fires a change event
    e.target.value = '';
    if (!f) return;
    if (!/\.(glb|gltf)$/i.test(f.name)) {
      say('Room must be a .glb or .gltf file');
      return;
    }
    if (f.size > MAX_ROOM_MB * 1024 * 1024) {
      say(`Room is too large (max ${MAX_ROOM_MB}MB)`);
      return;
    }
    setRoomModel({ url: URL.createObjectURL(f), name: f.name });
    say(`Room loaded: ${f.name}`);
  };
  const setSnap = useWorkspace((s) => s.setSnap);
  const setCollide = useWorkspace((s) => s.setCollide);
  const requestArrange = useWorkspace((s) => s.requestArrange);
  const requestExport = useWorkspace((s) => s.requestExport);
  const undo = useWorkspace((s) => s.undo);
  const redo = useWorkspace((s) => s.redo);
  const clear = useWorkspace((s) => s.clear);

  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-2xl border border-black/5 bg-white/85 p-1.5 shadow-lg backdrop-blur">
      <div className="flex rounded-xl bg-stone-100 p-0.5">
        {MODES.map((m) => (
          <button
            key={m.mode}
            onClick={() => setMode(m.mode)}
            title={`${m.label} (${m.key})`}
            aria-pressed={mode === m.mode}
            className={`rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition ${
              mode === m.mode
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <Divider />

      {/* The built-in walls aren't rendered while an imported room is showing. */}
      <Toggle
        on={roomMode === 'walls'}
        onClick={() => setRoomMode(roomMode === 'walls' ? 'open' : 'walls')}
        disabled={Boolean(roomModel)}
        title={roomModel ? 'Imported room is showing' : 'Toggle walls'}
      >
        {roomMode === 'walls' ? 'Walls' : 'Open'}
      </Toggle>

      {roomModel ? (
        <Plain
          onClick={() => {
            setRoomModel(null);
            say('Room removed');
          }}
          title={roomModel.name}
        >
          Remove room
        </Plain>
      ) : (
        <Plain onClick={() => roomInput.current?.click()} title="Import a room model (.glb)">
          Import room
        </Plain>
      )}
      <input
        ref={roomInput}
        type="file"
        accept=".glb,.gltf,model/gltf-binary"
        onChange={onRoomFile}
        className="hidden"
      />

      <Toggle on={snap} onClick={() => setSnap(!snap)} title="Snap to grid (X)">
        Snap
      </Toggle>

      <Toggle on={collide} onClick={() => setCollide(!collide)} title="Collision (C)">
        Collide
      </Toggle>

      <Divider />

      <Plain onClick={requestArrange} disabled={itemCount < 2} title="Auto-arrange (A)">
        Tidy up
      </Plain>

      <Plain onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
        ↺
      </Plain>
      <Plain onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" aria-label="Redo">
        ↻
      </Plain>

      <Plain onClick={clear} disabled={itemCount === 0} title="Remove everything">
        Clear
      </Plain>

      <Divider />

      <Plain onClick={requestExport} title="Export or import a layout as JSON">
        Export, Import, or Edit with AI
      </Plain>
    </div>
  );
}

const Divider = () => <span className="mx-0.5 h-5 w-px bg-stone-200" aria-hidden />;

function Toggle({
  on,
  children,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { on: boolean }) {
  return (
    <button
      {...rest}
      disabled={Boolean(disabled)}
      aria-pressed={on}
      className={`rounded-xl px-2.5 py-1.5 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:bg-transparent disabled:text-stone-300 ${
        on
          ? 'bg-stone-900 text-white'
          : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
      }`}
    >
      {children}
    </button>
  );
}

function Plain({ disabled, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      // always a real boolean: an undefined `disabled` serialises differently
      // on server and client, which trips React's hydration check
      disabled={Boolean(disabled)}
      className="rounded-xl px-2.5 py-1.5 text-[13px] font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent"
    />
  );
}
