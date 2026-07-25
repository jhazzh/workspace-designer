import * as THREE from 'three';
import { byId, CATALOG } from '@/data/catalog';
import { ROOM_SIZE } from './room';
// type-only: keeps the store <-> layout import cycle erased at compile time
import type { Placed, RoomMode } from '@/store/useWorkspace';

/**
 * Serialised layout. Deliberately plain and flat: this file is meant to be
 * read and rewritten by a person or an LLM, so it uses item ids and metres
 * rather than uids and matrices.
 */
export type LayoutFile = {
  version: 1;
  room: RoomMode;
  months: number;
  items: LayoutItem[];
};

export type LayoutItem = {
  itemId: string;
  /** [x, y, z] in metres. y is height above the floor. */
  position: [number, number, number];
  /** Y-axis rotation in radians. Other axes aren't user-editable. */
  rotationY: number;
};

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function toLayout(
  placed: Placed[],
  objects: Map<string, THREE.Object3D>,
  room: RoomMode,
  months: number,
): LayoutFile {
  const items: LayoutItem[] = [];
  for (const p of placed) {
    const o = objects.get(p.uid);
    if (!o) continue; // not mounted yet (GLB still loading)
    items.push({
      itemId: p.itemId,
      position: [r3(o.position.x), r3(o.position.y), r3(o.position.z)],
      rotationY: r3(o.rotation.y),
    });
  }
  return { version: 1, room, months, items };
}

export type ParsedLayout = { file: LayoutFile; skipped: string[] };

/**
 * Parse untrusted JSON into a layout. Hand-edited and AI-generated files are
 * the expected input, so every field is checked and unknown items are reported
 * rather than silently dropped.
 */
export function parseLayout(text: string): ParsedLayout {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (!raw || typeof raw !== 'object') throw new Error('Expected a JSON object.');

  const o = raw as Record<string, unknown>;
  if (o.version !== 1) throw new Error(`Unsupported version: ${String(o.version)}. Expected 1.`);
  if (!Array.isArray(o.items)) throw new Error('Missing an "items" array.');

  const skipped: string[] = [];
  const items: LayoutItem[] = [];

  for (const entry of o.items) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const itemId = typeof e.itemId === 'string' ? e.itemId : null;
    if (!itemId) continue;
    // An AI can invent plausible-sounding ids; only real catalog items load.
    if (!byId(itemId)) {
      skipped.push(itemId);
      continue;
    }
    items.push({
      itemId,
      position: vec3(e.position),
      rotationY: num(e.rotationY),
    });
  }

  if (!items.length && !skipped.length) throw new Error('No items found in that file.');

  return {
    file: {
      version: 1,
      room: o.room === 'open' ? 'open' : 'walls',
      months: typeof o.months === 'number' && o.months > 0 ? Math.round(o.months) : 3,
      items: sanitise(items),
    },
    skipped,
  };
}

/**
 * Pull impossible placements back to something physical. An LLM reliably gets
 * heights and edges slightly wrong — a floor item given a desk's y hovers in
 * mid-air, and a tabletop item a few centimetres past the desk edge floats off
 * it — so the numbers are corrected here rather than trusted.
 *
 * Deliberately conservative: it only moves what is provably wrong, and never
 * reflows a layout the user meant.
 */
function sanitise(items: LayoutItem[]): LayoutItem[] {
  const half = ROOM_SIZE / 2;
  const desks = items
    .map((it) => ({ it, item: byId(it.itemId)! }))
    .filter((d) => d.item.placement === 'support');

  return items.map((it) => {
    const item = byId(it.itemId)!;
    let [x, y, z] = it.position;
    const [w, , d] = item.size;

    if (item.placement === 'tabletop') {
      // Snap onto whichever desk it overlaps most; if it's over none, it has
      // nothing to stand on, so drop it to the floor rather than let it fly.
      const host = bestHost(x, z, w, d, desks);
      if (host) {
        const [hw, hh, hd] = host.item.size;
        const [hx, , hz] = host.it.position;
        y = hh;
        x = clamp(x, hx - hw / 2 + w / 2, hx + hw / 2 - w / 2);
        z = clamp(z, hz - hd / 2 + d / 2, hz + hd / 2 - d / 2);
      } else {
        y = 0;
      }
    } else {
      // Floor and desk items stand on the floor, whatever y the file claims.
      y = 0;
    }

    // Nothing may poke through a wall.
    x = clamp(x, -half + w / 2, half - w / 2);
    z = clamp(z, -half + d / 2, half - d / 2);

    return { itemId: it.itemId, position: [r3(x), r3(y), r3(z)], rotationY: it.rotationY };
  });
}

const clamp = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));

/** The desk whose footprint overlaps this item's the most, if any. */
function bestHost(
  x: number,
  z: number,
  w: number,
  d: number,
  desks: { it: LayoutItem; item: { size: [number, number, number] } }[],
) {
  let best: (typeof desks)[number] | null = null;
  let bestArea = 0;
  for (const desk of desks) {
    const [dw, , dd] = desk.item.size;
    const [dx, , dz] = desk.it.position;
    const ox = overlap(x - w / 2, x + w / 2, dx - dw / 2, dx + dw / 2);
    const oz = overlap(z - d / 2, z + d / 2, dz - dd / 2, dz + dd / 2);
    const area = ox * oz;
    if (area > bestArea) {
      bestArea = area;
      best = desk;
    }
  }
  return best;
}

const overlap = (a0: number, a1: number, b0: number, b1: number) =>
  Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function vec3(v: unknown): [number, number, number] {
  if (!Array.isArray(v)) return [0, 0, 0];
  return [num(v[0]), num(v[1]), num(v[2])];
}

/**
 * The instruction block that goes to an LLM alongside the layout. Generated
 * from CATALOG and ROOM_SIZE rather than hard-coded, so it can't drift from
 * the real data — a stale id list is the main cause of unusable AI output.
 */
export function buildPrompt(data: LayoutFile, request: string) {
  const half = ROOM_SIZE / 2;
  // Footprints, not just names: without widths the model can't check the
  // "don't overlap" rule it's given, and it reliably stacks a lamp into a
  // monitor. wxd for everything; desks also need their top height.
  const list = (p: string) =>
    CATALOG.filter((i) => i.placement === p)
      .map((i) =>
        p === 'support'
          ? `${i.id}(w${i.size[0]} d${i.size[2]} top${i.size[1]})`
          : `${i.id}(w${i.size[0]} d${i.size[2]})`,
      )
      .join(' ');

  // Worked example, derived from the catalog so the numbers stay true: the
  // widest tabletop item next to the narrowest is the case the model gets wrong.
  const tops = CATALOG.filter((i) => i.placement === 'tabletop');
  const wide = tops.reduce((a, b) => (b.size[0] > a.size[0] ? b : a), tops[0]);
  const thin = tops.reduce((a, b) => (b.size[0] < a.size[0] ? b : a), tops[0]);
  const example =
    wide && thin && wide !== thin
      ? `A ${wide.id} ${wide.size[0]} wide centred at x=0 already fills ${r3(-wide.size[0] / 2)}..${r3(wide.size[0] / 2)}, so a ${thin.id} beside it must be centred past ${r3(wide.size[0] / 2 + 0.05 + thin.size[0] / 2)}.`
      : '';

  // A bare "don't swap items" gets ignored, and a total count doesn't catch a
  // swap (15 in, 15 out, different mix). An explicit per-id tally gives the
  // model something concrete to check its own output against.
  const tally = new Map<string, number>();
  for (const it of data.items) tally.set(it.itemId, (tally.get(it.itemId) ?? 0) + 1);
  const manifest = [...tally].map(([id, n]) => `${id} x${n}`).join(', ');

  // The request leads: it's the first thing a person pasting this checks, and
  // the rules below only make sense once you know what's being asked for.
  return `CHANGE: ${request.trim() || '<describe your change here>'}

Edit the 3D room layout JSON at the end of this message to make that change.

Move and rotate only. Change ONLY "position" and "rotationY" on the items that
are already there. Do not add, delete, or substitute an item — swapping one id
for another is the most common way this goes wrong, and it silently changes the
customer's bill. If the change seems to need an item that isn't in the file,
do not invent one: get as close as you can by rearranging what's there, and
say so in one line AFTER the JSON.

Your output must contain exactly these items, in these quantities:
  ${manifest}

Before you answer, tally the itemIds in your JSON and confirm they match that
list id for id and count for count. If any line differs, fix it and re-check.

Units: metres. position=[x,y,z] at footprint centre; y is the item's BASE.
Floor y=0. Room ${ROOM_SIZE}x${ROOM_SIZE} (x,z from -${half} to ${half}). -Z is far, +Z is near (viewer side).

rotationY (radians) turns an item anticlockwise seen from above.
EVERY item at rotationY=0 faces +Z. To face something, point at it:
face +Z=0, -Z=3.142, +X=1.571, -X=4.712.
So a chair at +Z of a desk faces -Z -> 3.142; a chair at -X of a desk faces
+X -> 1.571. A monitor faces the chair, i.e. the opposite way from the chair.

Use only the ids below. Sizes are in metres: w=width along x, d=depth along z.

DESKS (stand on the floor, y=0): ${list('support')}
  "top" is the y a tabletop item must use.
FLOOR items, always y=0 even next to a desk: ${list('floor')}
TABLETOP items, y = the top of the desk they sit on: ${list('tabletop')}

Overlap is the most common mistake. Two items at the same height clash when
their x ranges AND their z ranges both overlap. An item at x spans
x-w/2 .. x+w/2, and at z spans z-d/2 .. z+d/2. Check every pair, and leave
>=0.05 between them. ${example}
Every tabletop item must also sit fully within its desk's footprint.
Give desks >=0.1 clearance from each other and keep everything inside the room.
Seat every chair at a desk edge, facing the desk, unless told otherwise.

Return the full JSON first, with no code fences and nothing before it. Keep
"version": 1. Any note about what you couldn't do goes after the JSON, not
before it.

${JSON.stringify(data)}`;
}

/** Trigger a browser download of `data` as a .json file. */
export function downloadLayout(data: LayoutFile, filename = 'workspace-layout.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
