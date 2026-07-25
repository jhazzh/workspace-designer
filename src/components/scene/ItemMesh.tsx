'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Clone, useGLTF } from '@react-three/drei';
import type { Item } from '@/data/catalog';
import { Placeholder } from './Placeholder';
import { seatOnFloor } from '@/lib/scene/collision';
import { HELPER } from '@/lib/scene/glb';

/**
 * Real model when one exists. Suspends while loading, so callers wrap this in
 * <Suspense>. Recentres to the floor because generated GLBs often arrive with
 * the origin at the mesh centre.
 */
function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const ref = useRef<THREE.Group>(null);

  // Layout effect: recentre before the parent's arrange effect reads the box,
  // so a fresh GLB is measured at its true footprint, not the origin-centred mesh.
  useLayoutEffect(() => {
    const g = ref.current;
    if (!g) return;
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    const box = new THREE.Box3().setFromObject(g);
    const c = box.getCenter(new THREE.Vector3());
    g.position.x -= c.x;
    g.position.z -= c.z;
    g.position.y -= box.min.y;
  }, [scene]);

  return <Clone ref={ref} object={scene} />;
}

type Props = {
  item: Item;
  uid: string;
  selected: boolean;
  onSelect: (uid: string) => void;
  register: (uid: string, object: THREE.Object3D | null) => void;
  /** Imported items carry their own y (e.g. on a desk); don't drop them. */
  placed?: boolean;
};

export function ItemMesh({ item, uid, selected, onSelect, register, placed }: Props) {
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const grown = useRef(0);

  useEffect(() => {
    register(uid, group.current);
    return () => register(uid, null);
  }, [uid, register]);

  // Spring-in on add; runs outside React state so it costs no re-renders.
  // The arranger snaps an item to scale 1 when it needs an exact box, so treat
  // that as the animation being over rather than shrinking it again.
  useFrame((_, dt) => {
    const g = group.current;
    if (!g || grown.current >= 1) return;
    if (g.scale.x === 1) {
      grown.current = 1;
      return;
    }
    grown.current = Math.min(1, grown.current + dt * 3.2);
    const t = 1 - Math.pow(1 - grown.current, 3);
    const s = 0.82 + 0.18 * t;
    g.scale.setScalar(s);
    if (grown.current >= 1) g.scale.setScalar(1);
  });

  useLayoutEffect(() => {
    // Tabletop items are seated by the arranger onto a real surface; dropping
    // them to y=0 first makes a monitor flash on the floor before it jumps up.
    if (group.current && !placed && item.placement !== 'tabletop') {
      seatOnFloor(group.current);
    }
    // Read once on mount by design: seating is a first-frame decision, and
    // re-running it later would yank a dragged item down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <group
      ref={group}
      name={uid}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(uid);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {item.model ? (
        // Inner group absorbs the GLB's authored facing, so the outer group's
        // rotation.y is always "0 = faces +Z". Placeholders are already built
        // that way, so they don't get the offset.
        <group rotation={[0, item.modelYaw ?? 0, 0]}>
          <Model url={item.model} />
        </group>
      ) : (
        <Placeholder item={item} />
      )}

      {(selected || hovered) && <SelectionRing item={item} strong={selected} />}
    </group>
  );
}

/** Flat ring on the floor under the item — readable from any camera angle. */
function SelectionRing({ item, strong }: { item: Item; strong: boolean }) {
  const r = Math.max(item.size[0], item.size[2]) * 0.62;
  return (
    <mesh name={HELPER} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
      <ringGeometry args={[r, r + 0.045, 48]} />
      <meshBasicMaterial
        color={strong ? '#2f6df6' : '#8aa6e8'}
        transparent
        opacity={strong ? 0.95 : 0.5}
        depthWrite={false}
      />
    </mesh>
  );
}
