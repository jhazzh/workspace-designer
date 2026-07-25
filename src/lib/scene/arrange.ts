import * as THREE from 'three';
import type { Item, Placement } from '@/data/catalog';
import { resolveCollisions, staticBoxes, worldBox } from './collision';
import { clampToRoom } from './room';

export type Placeable = { uid: string; item: Item; object: THREE.Object3D };

type Measured = Placeable & {
  box: THREE.Box3;
  size: THREE.Vector3;
  volume: number;
  kind: Placement;
};

const MARGIN = 0.025;
const GAP = 0.06;

/**
 * Live boxes are unreliable while an item is still springing in: the box reads
 * ~18% small, and every height derived from it — a desk's surface most of all —
 * comes out too low, which is what dropped monitors below the desktop. Snapping
 * to full size first costs one frame of animation and makes layout exact.
 */
function measure(p: Placeable): Measured {
  const s = p.object.scale;
  if (s.x !== 1 || s.y !== 1 || s.z !== 1) {
    s.setScalar(1);
    p.object.updateMatrixWorld(true);
  }
  const box = worldBox(p.object);
  const size = box.getSize(new THREE.Vector3());
  return {
    ...p,
    box,
    size,
    volume: size.x * size.y * size.z,
    // catalog declares intent; no filename guessing needed
    kind: p.item.placement,
  };
}

/** Move an object so its footprint centre lands on (x, z) and its base on y. */
function place(m: Measured, x: number, z: number, y: number) {
  const c = m.box.getCenter(new THREE.Vector3());
  m.object.position.x += x - c.x;
  m.object.position.z += z - c.z;
  m.object.position.y += y - m.box.min.y;
}

/**
 * Deterministic layout pass. Anchors on the largest support (the desk), puts
 * tall items along its far edge and short ones in front, then rings the
 * remaining floor items around it.
 *
 * The viewer looks from +Z, so the far edge is negative Z.
 */
export function autoArrange(items: Placeable[], pinned?: ReadonlySet<string>) {
  if (items.length < 2) return;

  const movable = pinned ? items.filter((i) => !pinned.has(i.uid)) : items;
  if (!movable.length) return;

  const info = movable.map(measure);
  // pinned items still block space, they just don't get repositioned
  const fixedBoxes = pinned
    ? items.filter((i) => pinned.has(i.uid)).map((i) => worldBox(i.object))
    : [];

  // A desk the user has already placed by hand still anchors the layout.
  const pinnedAnchor = pinned
    ? items
        .filter((i) => pinned.has(i.uid) && i.item.placement === 'support')
        .map(measure)
        .sort((a, b) => b.volume - a.volume)[0] ?? null
    : null;

  const supports = info.filter((i) => i.kind === 'support').sort((a, b) => b.volume - a.volume);
  const anchor = pinnedAnchor ?? supports.shift() ?? null;
  // extra desks are treated as floor furniture
  const extras = new Set(pinnedAnchor ? supports : supports);

  const tabletop = info.filter((i) => i.kind === 'tabletop');
  const floorItems = info.filter((i) => i.kind === 'floor' || extras.has(i));

  let surfaceY = 0;
  let deskWidth = 1.4;
  let deskDepth = 0.7;
  let originX = 0;
  let originZ = 0;

  if (anchor) {
    // only reposition the anchor if it isn't pinned
    if (!pinnedAnchor) place(anchor, 0, 0, 0);
    // Re-read after the move: the box captured in measure() is now stale, and
    // tabletop items are stacked on the desk's real top, not its height — a
    // pinned desk is never re-seated to y=0, so the two aren't the same.
    const box = worldBox(anchor.object);
    const c = box.getCenter(new THREE.Vector3());
    originX = c.x;
    originZ = c.z;
    surfaceY = box.max.y;
    deskWidth = anchor.size.x;
    deskDepth = anchor.size.z;
  }

  // every coordinate below is relative to the desk, then offset to where it sits
  const at = (m: Measured, x: number, z: number, y: number) =>
    place(m, originX + x, originZ + z, y);

  // rugs lie flat and everything else sits on them, so centre and skip
  const rugs = floorItems.filter((i) => i.size.y < 0.06);
  const standing = floorItems.filter((i) => i.size.y >= 0.06);
  rugs.forEach((r) => at(r, 0, deskDepth * 0.35, 0));

  const back = tabletop.filter((i) => i.item.back || i.size.y > 0.3);
  const front = tabletop.filter((i) => !back.includes(i));

  const layRow = (row: Measured[], z: number) => {
    if (!row.length) return;
    const total = row.reduce((s, i) => s + i.size.x, 0) + GAP * (row.length - 1);
    let x = -total / 2;
    for (const i of row) {
      at(i, x + i.size.x / 2, z, surfaceY);
      x += i.size.x + GAP;
    }
  };

  // Rows hug their own edge using real depths, so a deep monitor and a small
  // plant can share a shallow desk without clashing.
  const backD = back.length ? Math.max(...back.map((i) => i.size.z)) : 0;
  const frontD = front.length ? Math.max(...front.map((i) => i.size.z)) : 0;

  let backZ = -(deskDepth / 2 - backD / 2 - MARGIN);
  let frontZ = deskDepth / 2 - frontD / 2 - MARGIN;

  const needed = backD / 2 + frontD / 2 + 0.02;
  if (back.length && front.length && frontZ - backZ < needed) {
    const mid = (backZ + frontZ) / 2;
    backZ = mid - needed / 2;
    frontZ = mid + needed / 2;
  }

  layRow(back, backZ);
  layRow(front, frontZ);

  // The chair belongs at the near edge facing the desk, not off to one side.
  const chair = standing.find((i) => i.item.slot === 'chair');
  const rest = standing.filter((i) => i !== chair);
  if (chair) {
    // Reset rotation first: it swaps the footprint, so the box and size must
    // both be re-read afterwards or the chair is placed from stale numbers
    // and sinks through the floor.
    // Sits at +Z of the desk, so it must look back toward -Z.
    chair.object.rotation.y = Math.PI;
    chair.object.updateMatrixWorld(true);
    const box = worldBox(chair.object);
    chair.box = box;
    chair.size = box.getSize(new THREE.Vector3());
    at(chair, 0, deskDepth / 2 + chair.size.z / 2 + 0.12, 0);
  }

  rest.forEach((i, n) => {
    const side = n % 2 ? 1 : -1;
    const ring = Math.floor(n / 2);
    const x = side * (deskWidth / 2 + i.size.x / 2 + 0.22 + ring * 0.55);
    const z = -deskDepth * 0.18 + ring * 0.42;
    at(i, x, z, 0);
  });

  // Last pass: shove apart anything the rules still left overlapping.
  // Rugs are excluded as both mover and obstacle — things are meant to sit on
  // them, and the desk itself is skipped so accessories keep their spots on it.
  const solid = items
    .filter((i) => !rugs.some((r) => r.object === i.object))
    .map((i) => i.object);

  // Desks count as their top slab only, so storage can sit in the legroom.
  const deskObjects = new Set(info.filter((i) => i.kind === 'support').map((i) => i.object));

  for (const i of info) {
    if (rugs.includes(i) || i === anchor) continue;
    resolveCollisions(i.object, [...staticBoxes(solid, i.object, deskObjects), ...fixedBoxes], 6);
  }

  // Nothing may end up under the floor, whatever the rules above worked out.
  for (const i of info) {
    const min = worldBox(i.object).min.y;
    if (min < 0) i.object.position.y -= min;
  }

  // Keep the finished layout inside the room.
  for (const i of info) clampToRoom(i.object);
}
