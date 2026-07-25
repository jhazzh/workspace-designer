'use client';

import { create } from 'zustand';
import { byId, type Slot } from '@/data/catalog';
import type { LayoutFile } from '@/lib/scene/layout';

/** One item instance in the scene. Duplicates get distinct uids. */
export type Placed = { uid: string; itemId: string };

export type TransformMode = 'translate' | 'rotate';
export type RoomMode = 'open' | 'walls';

/** A reversible action. Ported from the prototype's command stack. */
export type Command = { label: string; undo: () => void; redo: () => void };

const HISTORY_LIMIT = 120;
let seq = 0;
const uid = () => `p${++seq}`;

type State = {
  placed: Placed[];
  selected: string | null;
  months: number;
  roomMode: RoomMode;
  mode: TransformMode;
  snap: boolean;
  collide: boolean;
  undoStack: Command[];
  redoStack: Command[];
  /** Bumped to ask the scene to re-run auto-arrange. */
  arrangeToken: number;
  /** Bumped to ask the scene to serialise itself into `exported`. */
  exportToken: number;
  /** Result of the last export, shown in the export dialog. Null = closed. */
  exported: LayoutFile | null;
  /**
   * Placements waiting to be applied to the scene, keyed by uid. Set by an
   * import; the scene consumes it once the meshes for those uids exist.
   */
  pendingLayout: Map<string, { position: [number, number, number]; rotationY: number }> | null;
  /**
   * An imported room shell (GLB), or null for the built-in room. Scenery only:
   * it replaces the floor and walls visually, while furniture keeps colliding
   * against the fixed room bounds. Held as a blob URL for the session, so it
   * doesn't survive a reload.
   */
  roomModel: { url: string; name: string } | null;
  toast: string | null;

  select: (uid: string | null) => void;
  setSlot: (slot: Slot, itemId: string | null) => void;
  toggle: (itemId: string) => void;
  addOne: (itemId: string) => void;
  removeOne: (itemId: string) => void;
  remove: (uid: string) => void;
  duplicate: (uid: string) => void;
  clear: () => void;
  setMonths: (m: number) => void;
  setRoomMode: (r: RoomMode) => void;
  /** Swap in an imported room shell, or pass null to restore the built-in one. */
  setRoomModel: (m: { url: string; name: string } | null) => void;
  setMode: (m: TransformMode) => void;
  setSnap: (b: boolean) => void;
  setCollide: (b: boolean) => void;
  requestArrange: () => void;
  requestExport: () => void;
  setExported: (f: LayoutFile | null) => void;
  /** Load an already-parsed layout and report what was skipped. */
  applyImport: (file: LayoutFile, skipped: string[]) => void;
  loadLayout: (file: LayoutFile) => void;
  consumeLayout: () => void;
  say: (msg: string | null) => void;
  push: (c: Command) => void;
  undo: () => void;
  redo: () => void;
};

export const useWorkspace = create<State>((set, get) => ({
  placed: [],
  selected: null,
  months: 3,
  roomMode: 'walls',
  mode: 'translate',
  snap: false,
  collide: true,
  undoStack: [],
  redoStack: [],
  arrangeToken: 0,
  exportToken: 0,
  exported: null,
  pendingLayout: null,
  roomModel: null,
  toast: null,

  select: (uid) => set({ selected: uid }),

  /** Single-choice slots (desk, chair): replace whatever is there. */
  setSlot: (slot, itemId) => {
    const before = get().placed;
    const kept = before.filter((p) => byId(p.itemId)?.slot !== slot);
    const after = itemId ? [...kept, { uid: uid(), itemId }] : kept;
    const label = itemId ? `add ${byId(itemId)?.name ?? itemId}` : `remove ${slot}`;
    set({ placed: after, selected: after.at(-1)?.uid ?? null });
    get().push({
      label,
      undo: () => set({ placed: before, selected: null }),
      redo: () => set({ placed: after, selected: null }),
    });
  },

  /** Multi-choice slots: add one, or remove all of that item. */
  toggle: (itemId) => {
    const before = get().placed;
    const has = before.some((p) => p.itemId === itemId);
    const after = has
      ? before.filter((p) => p.itemId !== itemId)
      : [...before, { uid: uid(), itemId }];
    const name = byId(itemId)?.name ?? itemId;
    set({ placed: after, selected: has ? null : after.at(-1)!.uid });
    get().push({
      label: `${has ? 'remove' : 'add'} ${name}`,
      undo: () => set({ placed: before, selected: null }),
      redo: () => set({ placed: after, selected: null }),
    });
  },

  /** Quantity stepper: one more of this item, leaving existing ones alone. */
  addOne: (itemId) => {
    const before = get().placed;
    const after = [...before, { uid: uid(), itemId }];
    set({ placed: after, selected: after.at(-1)!.uid });
    get().push({
      label: `add ${byId(itemId)?.name ?? itemId}`,
      undo: () => set({ placed: before, selected: null }),
      redo: () => set({ placed: after, selected: null }),
    });
  },

  /** Drop the most recently added of this item, keeping the rest. */
  removeOne: (itemId) => {
    const before = get().placed;
    const last = before.map((p) => p.itemId).lastIndexOf(itemId);
    if (last === -1) return;
    const after = before.filter((_, i) => i !== last);
    set({ placed: after, selected: null });
    get().push({
      label: `remove ${byId(itemId)?.name ?? itemId}`,
      undo: () => set({ placed: before, selected: null }),
      redo: () => set({ placed: after, selected: null }),
    });
  },

  remove: (target) => {
    const before = get().placed;
    const gone = before.find((p) => p.uid === target);
    if (!gone) return;
    const after = before.filter((p) => p.uid !== target);
    set({ placed: after, selected: null });
    get().push({
      label: `delete ${byId(gone.itemId)?.name ?? gone.itemId}`,
      undo: () => set({ placed: before }),
      redo: () => set({ placed: after, selected: null }),
    });
  },

  duplicate: (target) => {
    const before = get().placed;
    const src = before.find((p) => p.uid === target);
    if (!src) return;
    const after = [...before, { uid: uid(), itemId: src.itemId }];
    set({ placed: after, selected: after.at(-1)!.uid });
    get().push({
      label: `duplicate ${byId(src.itemId)?.name ?? src.itemId}`,
      undo: () => set({ placed: before, selected: null }),
      redo: () => set({ placed: after, selected: null }),
    });
  },

  clear: () => {
    const before = get().placed;
    if (!before.length) return;
    set({ placed: [], selected: null });
    get().push({
      label: 'clear workspace',
      undo: () => set({ placed: before }),
      redo: () => set({ placed: [], selected: null }),
    });
  },

  setMonths: (m) => set({ months: m }),
  setRoomMode: (roomMode) => set({ roomMode }),

  setRoomModel: (roomModel) => {
    // The outgoing blob URL pins its file in memory until it's released.
    const old = get().roomModel;
    if (old && old.url !== roomModel?.url) URL.revokeObjectURL(old.url);
    set({ roomModel });
  },
  setMode: (mode) => set({ mode }),
  setSnap: (snap) => set({ snap }),
  setCollide: (collide) => set({ collide }),
  requestArrange: () => set((s) => ({ arrangeToken: s.arrangeToken + 1 })),
  requestExport: () => set((s) => ({ exportToken: s.exportToken + 1 })),
  setExported: (exported) => set({ exported }),

  /**
   * Shared by both import routes (file picker and paste box) so a pasted
   * layout and an uploaded one report success identically. Parsing stays in
   * the caller: importing parseLayout here would make the store <-> layout
   * type cycle a runtime one.
   */
  applyImport: (file, skipped) => {
    get().loadLayout(file);
    const n = file.items.length;
    get().say(
      skipped.length
        ? `Loaded ${n} item${n === 1 ? '' : 's'} — skipped unknown: ${skipped.join(', ')}`
        : `Loaded ${n} item${n === 1 ? '' : 's'}`,
    );
  },

  /**
   * Replace the scene with an imported layout. Items are created here; their
   * positions ride along in pendingLayout for the scene to apply on mount,
   * since transforms live on the three.js objects rather than in the store.
   */
  loadLayout: (file) => {
    const before = get().placed;
    const beforeRoom = get().roomMode;
    const beforeMonths = get().months;

    const after: Placed[] = [];
    const pending = new Map<string, { position: [number, number, number]; rotationY: number }>();
    for (const it of file.items) {
      const id = uid();
      after.push({ uid: id, itemId: it.itemId });
      pending.set(id, { position: it.position, rotationY: it.rotationY });
    }

    set({
      placed: after,
      selected: null,
      roomMode: file.room,
      months: file.months,
      pendingLayout: pending,
    });
    get().push({
      label: 'import layout',
      undo: () =>
        set({
          placed: before,
          selected: null,
          roomMode: beforeRoom,
          months: beforeMonths,
          pendingLayout: null,
        }),
      redo: () =>
        set({
          placed: after,
          selected: null,
          roomMode: file.room,
          months: file.months,
          pendingLayout: new Map(pending),
        }),
    });
  },

  consumeLayout: () => set({ pendingLayout: null }),
  say: (toast) => set({ toast }),

  push: (c) =>
    set((s) => ({
      // a new action invalidates the redo branch
      undoStack: [...s.undoStack, c].slice(-HISTORY_LIMIT),
      redoStack: [],
    })),

  undo: () => {
    const { undoStack, redoStack } = get();
    const cmd = undoStack.at(-1);
    if (!cmd) return;
    cmd.undo();
    set({ undoStack: undoStack.slice(0, -1), redoStack: [...redoStack, cmd] });
    get().say(`Undo: ${cmd.label}`);
  },

  redo: () => {
    const { undoStack, redoStack } = get();
    const cmd = redoStack.at(-1);
    if (!cmd) return;
    cmd.redo();
    set({ redoStack: redoStack.slice(0, -1), undoStack: [...undoStack, cmd] });
    get().say(`Redo: ${cmd.label}`);
  },
}));

export const selectedIds = (placed: Placed[]) => placed.map((p) => p.itemId);
