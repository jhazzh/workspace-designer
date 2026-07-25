import * as THREE from 'three';

const EPS = 0.0015;

export const worldBox = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o);

/**
 * Boxes of everything except the object being dragged, cached once at drag
 * start so we aren't rebuilding them 60 times a second.
 */
export function staticBoxes(all: THREE.Object3D[], exclude?: THREE.Object3D | null) {
  return all.filter((o) => o !== exclude).map(worldBox);
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
