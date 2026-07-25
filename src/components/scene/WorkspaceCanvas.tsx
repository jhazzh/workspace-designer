'use client';

import { Suspense, useCallback, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, OrbitControls, TransformControls } from '@react-three/drei';
import type { OrbitControls as OrbitImpl } from 'three-stdlib';
import { byId } from '@/data/catalog';
import { useWorkspace } from '@/store/useWorkspace';
import { resolveCollisions, staticBoxes } from '@/lib/scene/collision';
import { autoArrange, type Placeable } from '@/lib/scene/arrange';
import { Room } from './Room';
import { ItemMesh } from './ItemMesh';
import { SceneProbe } from './SceneProbe';

const E2E = process.env.NEXT_PUBLIC_E2E === '1';

/** Offset to the right of centre so the chair never hides the desk it faces. */
const CAMERA = {
  camera: { position: [3.1, 1.75, 2.5] as [number, number, number], fov: 42, near: 0.05, far: 200 },
};

export default function WorkspaceCanvas() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      {...CAMERA}
      gl={{ antialias: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <color attach="background" args={['#eceae5']} />
      <fog attach="fog" args={['#eceae5', 14, 30]} />
      <Scene />
    </Canvas>
  );
}

function Scene() {
  const placed = useWorkspace((s) => s.placed);
  const selected = useWorkspace((s) => s.selected);
  const roomMode = useWorkspace((s) => s.roomMode);
  const mode = useWorkspace((s) => s.mode);
  const snap = useWorkspace((s) => s.snap);
  const collide = useWorkspace((s) => s.collide);
  const arrangeToken = useWorkspace((s) => s.arrangeToken);
  const select = useWorkspace((s) => s.select);
  const push = useWorkspace((s) => s.push);

  /**
   * Live three.js objects, keyed by uid. Deliberately a ref, not state:
   * collision runs every frame of a drag and must never re-render React.
   */
  const objects = useRef(new Map<string, THREE.Object3D>());
  const orbit = useRef<OrbitImpl>(null);
  const dragBefore = useRef<Snapshot | null>(null);
  const frozen = useRef<THREE.Box3[]>([]);
  /** uids the user has positioned by hand; the arranger leaves these alone. */
  const pinned = useRef(new Set<string>());

  const register = useCallback((uid: string, o: THREE.Object3D | null) => {
    if (o) objects.current.set(uid, o);
    else objects.current.delete(uid);
  }, []);

  const selectedObject = selected ? objects.current.get(selected) ?? null : null;

  /**
   * Items should land where they belong, not just somewhere free — a monitor
   * on the desk, a chair at the near edge. So adding an item re-runs the
   * arranger instead of only pushing the newcomer out of the way.
   *
   * Anything the user has dragged themselves is pinned and left alone, so
   * arranging never undoes deliberate positioning.
   */
  useEffect(() => {
    // Child effects register before this one, but a GLB behind <Suspense> can
    // mount a frame later, so re-run once on the next frame to catch it.
    const run = () => {
      const list = toPlaceables(placed, objects.current);
      if (list.length !== placed.length) return false;
      if (list.every((l) => pinned.current.has(l.uid))) return true;

      if (list.length === 1) resolveCollisions(list[0].object, [], 4);
      else autoArrange(list, pinned.current);
      return true;
    };

    if (run()) return;
    const id = requestAnimationFrame(() => run());
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed]);

  // "Tidy up" from the toolbar: a full reset, so it also unpins.
  useEffect(() => {
    if (!arrangeToken) return;
    const list = toPlaceables(placed, objects.current);
    if (list.length < 2) return;

    const before = list.map((l) => snapshot(l.object));
    pinned.current.clear();
    autoArrange(list);
    const after = list.map((l) => snapshot(l.object));
    push({
      label: 'auto-arrange',
      undo: () => list.forEach((l, i) => apply(l.object, before[i])),
      redo: () => list.forEach((l, i) => apply(l.object, after[i])),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrangeToken]);

  return (
    <>
      <hemisphereLight args={['#ffffff', '#b8ae9c', 0.55]} />
      <directionalLight
        position={[3.5, 6, 4]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-camera-top={5}
        shadow-camera-right={5}
        shadow-camera-bottom={-5}
        shadow-camera-left={-5}
      />
      <Environment preset="apartment" />

      <Room mode={roomMode} />

      <ContactShadows
        position={[0, 0.004, 0]}
        opacity={0.42}
        scale={12}
        blur={2.2}
        far={4}
        resolution={1024}
      />

      {/* click empty space to deselect */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.001, 0]}
        onClick={() => select(null)}
      >
        <planeGeometry args={[40, 40]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      <Suspense fallback={null}>
        {placed.map((p) => {
          const item = byId(p.itemId);
          if (!item) return null;
          return (
            <ItemMesh
              key={p.uid}
              uid={p.uid}
              item={item}
              selected={selected === p.uid}
              onSelect={select}
              register={register}
            />
          );
        })}
      </Suspense>

      {selectedObject && (
        <TransformControls
          object={selectedObject}
          mode={mode}
          translationSnap={snap ? 0.1 : null}
          rotationSnap={snap ? Math.PI / 12 : null}
          scaleSnap={snap ? 0.1 : null}
          size={0.8}
          showY={mode !== 'translate'}
          onMouseDown={() => {
            dragBefore.current = snapshot(selectedObject);
            frozen.current = staticBoxes([...objects.current.values()], selectedObject);
          }}
          onObjectChange={() => {
            if (collide) resolveCollisions(selectedObject, frozen.current);
          }}
          onMouseUp={() => {
            const before = dragBefore.current;
            dragBefore.current = null;
            if (!before) return;
            const after = snapshot(selectedObject);
            if (same(before, after)) return;
            // hand-placed from now on: adding more items won't move this
            if (selected) pinned.current.add(selected);
            push({
              label: mode === 'translate' ? 'move' : mode,
              undo: () => apply(selectedObject, before),
              redo: () => apply(selectedObject, after),
            });
          }}
        />
      )}

      {E2E && (
        <SceneProbe
          objects={objects.current}
          ids={new Map(placed.map((p) => [p.uid, p.itemId]))}
        />
      )}

      <OrbitControls
        ref={orbit}
        makeDefault
        enableDamping
        target={[0, 0.55, 0]}
        minDistance={1.4}
        maxDistance={11}
        maxPolarAngle={Math.PI / 2.05}
      />
    </>
  );
}

/** Pair each placed uid with its live three.js object, skipping any not yet mounted. */
function toPlaceables(
  placed: { uid: string; itemId: string }[],
  objects: Map<string, THREE.Object3D>,
): Placeable[] {
  return placed
    .map((p) => {
      const item = byId(p.itemId);
      const object = objects.get(p.uid);
      return item && object ? { uid: p.uid, item, object } : null;
    })
    .filter((x): x is Placeable => Boolean(x));
}

type Snapshot = { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 };

const snapshot = (o: THREE.Object3D): Snapshot => ({
  p: o.position.clone(),
  q: o.quaternion.clone(),
  s: o.scale.clone(),
});

const apply = (o: THREE.Object3D, s: Snapshot) => {
  o.position.copy(s.p);
  o.quaternion.copy(s.q);
  o.scale.copy(s.s);
};

const same = (a: Snapshot, b: Snapshot) =>
  a.p.equals(b.p) && a.q.equals(b.q) && a.s.equals(b.s);
