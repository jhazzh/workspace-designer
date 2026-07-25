'use client';

import { create } from 'zustand';
import { byId, type Slot } from '@/data/catalog';

/** One item instance in the scene. Duplicates get distinct uids. */
export type Placed = { uid: string; itemId: string };

export type TransformMode = 'translate' | 'rotate' | 'scale';
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
  toast: string | null;

  select: (uid: string | null) => void;
  setSlot: (slot: Slot, itemId: string | null) => void;
  toggle: (itemId: string) => void;
  remove: (uid: string) => void;
  duplicate: (uid: string) => void;
  clear: () => void;
  setMonths: (m: number) => void;
  setRoomMode: (r: RoomMode) => void;
  setMode: (m: TransformMode) => void;
  setSnap: (b: boolean) => void;
  setCollide: (b: boolean) => void;
  requestArrange: () => void;
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
  setMode: (mode) => set({ mode }),
  setSnap: (snap) => set({ snap }),
  setCollide: (collide) => set({ collide }),
  requestArrange: () => set((s) => ({ arrangeToken: s.arrangeToken + 1 })),
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
