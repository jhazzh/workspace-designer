'use client';

import { useEffect } from 'react';
import * as THREE from 'three';
import { worldBox } from '@/lib/scene/collision';

export type ProbeResult = { id: string; minY: number; maxY: number };

declare global {
  interface Window {
    __sceneProbe?: (itemId: string) => ProbeResult | null;
    __sceneProbeAll?: () => ProbeResult[];
    __sceneOverlaps?: () => number;
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

    return () => {
      delete window.__sceneProbe;
      delete window.__sceneProbeAll;
      delete window.__sceneOverlaps;
    };
  }, [objects, ids]);

  return null;
}
