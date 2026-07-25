'use client';

import { useEffect } from 'react';
import * as THREE from 'three';
import { resolveCollisions, settleOnSurface, staticBoxes, worldBox } from '@/lib/scene/collision';
import { wallBoxes } from '@/lib/scene/room';

export type ProbeResult = { id: string; minY: number; maxY: number };
export type TransformResult = {
  id: string;
  position: [number, number, number];
  rotationY: number;
};

declare global {
  interface Window {
    __sceneProbe?: (itemId: string) => ProbeResult | null;
    __sceneProbeAll?: () => ProbeResult[];
    /** Position + Y rotation of every item, for orientation assertions. */
    __sceneTransforms?: () => TransformResult[];
    __sceneOverlaps?: () => number;
    /** Move an item to (x,y,z), settle it onto whatever's below, return its base Y. */
    __sceneSettle?: (itemId: string, x: number, y: number, z: number) => number | null;
    /** Push an item toward a wall; return whether it stayed inside the room. */
    __scenePushToWall?: (itemId: string) => boolean | null;
  }
}

/**
 * Exposes scene geometry to end-to-end tests, which otherwise can't see inside
 * a WebGL canvas. Mounted only when NEXT_PUBLIC_E2E=1, so it never ships to
 * users. Reads live objects; it never mutates them.
 */
export function SceneProbe({
  objects,
  ids,
}: {
  objects: Map<string, THREE.Object3D>;
  ids: Map<string, string>;
}) {
  useEffect(() => {
    const measure = (uid: string, object: THREE.Object3D): ProbeResult => {
      const b = worldBox(object);
      return { id: ids.get(uid) ?? uid, minY: +b.min.y.toFixed(4), maxY: +b.max.y.toFixed(4) };
    };

    window.__sceneProbeAll = () =>
      [...objects.entries()].map(([uid, o]) => measure(uid, o));

    window.__sceneProbe = (itemId) =>
      window.__sceneProbeAll!().find((r) => r.id === itemId) ?? null;

    window.__sceneTransforms = () =>
      [...objects.entries()].map(([uid, o]) => ({
        id: ids.get(uid) ?? uid,
        position: [+o.position.x.toFixed(4), +o.position.y.toFixed(4), +o.position.z.toFixed(4)] as [
          number,
          number,
          number,
        ],
        rotationY: +o.rotation.y.toFixed(4),
      }));

    // Counts pairs that genuinely intersect, ignoring flat items like rugs
    // that everything is meant to stand on.
    window.__sceneOverlaps = () => {
      const boxes = [...objects.values()]
        .map((o) => worldBox(o))
        .filter((b) => b.max.y - b.min.y > 0.06);

      let n = 0;
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          if (!boxes[i].intersectsBox(boxes[j])) continue;
          const o = boxes[i].clone().intersect(boxes[j]).getSize(new THREE.Vector3());
          // ignore hairline touches from items resting on one another
          if (Math.min(o.x, o.y, o.z) > 0.02) n++;
        }
      }
      return n;
    };

    const find = (itemId: string) => {
      for (const [uid, o] of objects) if ((ids.get(uid) ?? uid) === itemId) return o;
      return null;
    };

    // Move an item somewhere, drop it onto the surface below, report base height.
    window.__sceneSettle = (itemId, x, y, z) => {
      const o = find(itemId);
      if (!o) return null;
      o.position.set(x, y, z);
      const others = staticBoxes(
        [...objects.values()].filter((v) => v !== o),
        o,
      );
      settleOnSurface(o, others);
      resolveCollisions(o, others);
      return +worldBox(o).min.y.toFixed(4);
    };

    // Shove an item hard into the back-left corner; walls should keep it inside.
    window.__scenePushToWall = (itemId) => {
      const o = find(itemId);
      if (!o) return null;
      o.position.set(-10, o.position.y, -10); // way past the corner
      const obstacles = [
        ...staticBoxes([...objects.values()].filter((v) => v !== o), o),
        ...wallBoxes(),
      ];
      resolveCollisions(o, obstacles, 8);
      const b = worldBox(o);
      // inside the 8×8 room (half = 4), allowing a hair of tolerance
      return b.min.x >= -4.05 && b.min.z >= -4.05;
    };

    return () => {
      delete window.__sceneProbe;
      delete window.__sceneProbeAll;
      delete window.__sceneTransforms;
      delete window.__sceneOverlaps;
      delete window.__sceneSettle;
      delete window.__scenePushToWall;
    };
  }, [objects, ids]);

  return null;
}
