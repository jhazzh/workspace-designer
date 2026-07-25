import * as THREE from 'three';

const EPS = 0.0015;

export const worldBox = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o);

/** How much of a desk is really solid, measured down from its top. */
const TOP_SLAB = 0.12;

/**
 * A desk's bounding box is a sealed block from the floor to its top, so the
 * legroom under it reads as solid and a drawer can never tuck beneath. Treating
 * a support item as just its top slab restores that space, which is the whole
 * point of an under-desk unit.
 */
export function collisionBox(o: THREE.Object3D, isSupport: boolean) {
  const box = worldBox(o);
  if (isSupport) box.min.y = Math.max(box.min.y, box.max.y - TOP_SLAB);
  return box;
}

/**
 * Boxes of everything except the object being dragged, cached once at drag
 * start so we aren't rebuilding them 60 times a second.
 *
 * `supports` marks the objects to hollow out (desks); without it every box is
 * solid, which is the right default for walls and ordinary furniture.
 */
export function staticBoxes(
  all: THREE.Object3D[],
  exclude?: THREE.Object3D | null,
  supports?: Set<THREE.Object3D>,
) {
  return all.filter((o) => o !== exclude).map((o) => collisionBox(o, supports?.has(o) ?? false));
}

/**
 * Nudge `target` out of anything it overlaps, along whichever axis needs the
 * least movement. Smallest-overlap resolution means dragging sideways into a
 * desk slides you off it, while dragging down onto one sets you on top.
 *
 * Mutates position directly — never routed through React state, which would
 * re-render on every frame of a drag.
 */
export function resolveCollisions(
  target: THREE.Object3D,
  others: THREE.Box3[],
  passes = 4,
): boolean {
  let nudged = false;

  for (let pass = 0; pass < passes; pass++) {
    const box = worldBox(target);

    // never let anything sink below the floor
    if (box.min.y < 0) {
      target.position.y += -box.min.y;
      box.translate(new THREE.Vector3(0, -box.min.y, 0));
      nudged = true;
    }

    let worst: { ox: number; oy: number; oz: number; depth: number; other: THREE.Box3 } | null =
      null;

    for (const other of others) {
      if (!box.intersectsBox(other)) continue;
      const ox = Math.min(box.max.x, other.max.x) - Math.max(box.min.x, other.min.x);
      const oy = Math.min(box.max.y, other.max.y) - Math.max(box.min.y, other.min.y);
      const oz = Math.min(box.max.z, other.max.z) - Math.max(box.min.z, other.min.z);
      const depth = Math.min(ox, oy, oz);
      // Resting contact, not penetration: a monitor sitting exactly on a desk
      // shares a face, which Box3 counts as intersecting. Nudging it would walk
      // a correctly-placed item off its surface.
      if (depth <= EPS) continue;
      if (!worst || depth > worst.depth) worst = { ox, oy, oz, depth, other };
    }
    if (!worst) break;

    const { ox, oy, oz, other } = worst;
    const c = box.getCenter(new THREE.Vector3());
    const oc = other.getCenter(new THREE.Vector3());

    if (oy <= ox && oy <= oz) {
      target.position.y += (c.y >= oc.y ? 1 : -1) * (oy + EPS);
    } else if (ox <= oz) {
      target.position.x += (c.x >= oc.x ? 1 : -1) * (ox + EPS);
    } else {
      target.position.z += (c.z >= oc.z ? 1 : -1) * (oz + EPS);
    }
    nudged = true;
  }
  return nudged;
}

/** Drop an object onto the floor, preserving x/z. */
export function seatOnFloor(o: THREE.Object3D) {
  const box = worldBox(o);
  o.position.y -= box.min.y;
}

/**
 * Spiral outward from the origin until the object isn't overlapping anything.
 * Used when an item is first added to the scene.
 */
export function findFreeSpot(target: THREE.Object3D, others: THREE.Box3[]) {
  const size = worldBox(target).getSize(new THREE.Vector3());
  const step = Math.max(size.x, size.z, 0.35) * 1.15;

  for (let ring = 0; ring < 10; ring++) {
    const b = worldBox(target);
    if (!others.some((o) => b.intersectsBox(o))) return;
    const a = ring * 1.9;
    target.position.x = Math.cos(a) * step * (1 + ring * 0.35);
    target.position.z = Math.sin(a) * step * (1 + ring * 0.35);
  }
}

/**
 * Drop `target` straight down onto whatever is directly beneath it — the top of
 * an overlapping surface, else the floor. Called when the user releases an
 * object over a table so it rests on the surface instead of hovering.
 *
 * Only considers surfaces whose footprint overlaps the target in x/z, so an
 * item held off to the side still lands on the floor.
 */
export function settleOnSurface(target: THREE.Object3D, others: THREE.Box3[]) {
  const box = worldBox(target);
  const overlapsXZ = (o: THREE.Box3) =>
    box.min.x < o.max.x && box.max.x > o.min.x && box.min.z < o.max.z && box.max.z > o.min.z;

  // highest surface top that sits below the object's current top
  let restY = 0; // floor
  for (const o of others) {
    if (!overlapsXZ(o)) continue;
    if (o.max.y <= box.max.y + 0.001 && o.max.y > restY) restY = o.max.y;
  }

  target.position.y += restY - box.min.y;
}
