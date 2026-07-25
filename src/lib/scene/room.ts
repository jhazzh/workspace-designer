import * as THREE from 'three';

/** Shared room dimensions so Room.tsx and collision agree on where walls are. */
export const ROOM_SIZE = 8;
export const WALL_HEIGHT = 2.7;
export const WALL_THICKNESS = 0.2;

const HALF = ROOM_SIZE / 2;

/**
 * Collision boxes for the two corner walls (back at -Z, left at -X), matching
 * what Room.tsx renders in 'walls' mode. Each is a thin slab just outside the
 * room so furniture stops at the visible surface instead of clipping through.
 */
export function wallBoxes(): THREE.Box3[] {
  const back = new THREE.Box3(
    new THREE.Vector3(-HALF, 0, -HALF - WALL_THICKNESS),
    new THREE.Vector3(HALF, WALL_HEIGHT, -HALF),
  );
  const left = new THREE.Box3(
    new THREE.Vector3(-HALF - WALL_THICKNESS, 0, -HALF),
    new THREE.Vector3(-HALF, WALL_HEIGHT, HALF),
  );
  return [back, left];
}

/**
 * Slide an object back inside the room by its own footprint.
 *
 * Wall slabs alone aren't enough: they sit outside the room, so an object only
 * touches one after it has already crossed the surface, and resolveCollisions
 * then pushes it along whichever axis is cheapest — often sideways, straight
 * through. Clamping the footprint is unconditional and covers all four sides,
 * including the two the visible walls don't cover.
 */
export function clampToRoom(o: THREE.Object3D) {
  const b = new THREE.Box3().setFromObject(o);

  const overMinX = -HALF - b.min.x;
  if (overMinX > 0) o.position.x += overMinX;
  const overMaxX = b.max.x - HALF;
  if (overMaxX > 0) o.position.x -= overMaxX;

  const overMinZ = -HALF - b.min.z;
  if (overMinZ > 0) o.position.z += overMinZ;
  const overMaxZ = b.max.z - HALF;
  if (overMaxZ > 0) o.position.z -= overMaxZ;
}
