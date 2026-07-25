'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, OrbitControls, TransformControls } from '@react-three/drei';
import type { OrbitControls as OrbitImpl } from 'three-stdlib';
import { byId } from '@/data/catalog';
import { useWorkspace } from '@/store/useWorkspace';
import { resolveCollisions, settleOnSurface, staticBoxes, worldBox } from '@/lib/scene/collision';
import { clampToRoom, wallBoxes } from '@/lib/scene/room';
import { autoArrange, type Placeable } from '@/lib/scene/arrange';
import { toLayout } from '@/lib/scene/layout';
import { Room } from './Room';
import { ItemMesh } from './ItemMesh';
import { SceneProbe } from './SceneProbe';

const E2E = process.env.NEXT_PUBLIC_E2E === '1';

/** Offset to the right of centre so the chair never hides the desk it faces. */
const CAMERA = {
  camera: { position: [3.1, 1.75, 2.5] as [number, number, number], fov: 42, near: 0.05, far: 200 },
};

export default function WorkspaceCanvas() {
  const [lost, setLost] = useState(false);

  return (
    <>
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        dpr={[1, 1.75]}
        {...CAMERA}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;

          const canvas = gl.domElement;
          // A lost context leaves a permanently blank canvas unless the default
          // is prevented, which is what lets the browser hand one back.
          const onLost = (e: Event) => {
            e.preventDefault();
            setLost(true);
          };
          const onRestored = () => setLost(false);

          canvas.addEventListener('webglcontextlost', onLost);
          canvas.addEventListener('webglcontextrestored', onRestored);
        }}
      >
        <color attach="background" args={['#eceae5']} />
        <fog attach="fog" args={['#eceae5', 14, 30]} />
        <Scene />
      </Canvas>

      {lost && <ContextLostNotice />}
    </>
  );
}

/** Shown if the GPU drops the context and the browser doesn't restore it. */
function ContextLostNotice() {
  return (
    <div className="absolute inset-0 grid place-content-center bg-stone-100/95 px-6 text-center">
      <p className="text-base font-medium text-stone-700">The 3D view stopped</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-stone-500">
        Your browser ran out of graphics memory. Your setup is safe — reload to bring the
        room back.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mx-auto mt-4 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800"
      >
        Reload
      </button>
    </div>
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
  const exportToken = useWorkspace((s) => s.exportToken);
  const pendingLayout = useWorkspace((s) => s.pendingLayout);
  const consumeLayout = useWorkspace((s) => s.consumeLayout);
  const setExported = useWorkspace((s) => s.setExported);
  const select = useWorkspace((s) => s.select);
  const push = useWorkspace((s) => s.push);

  /**
   * Live three.js objects, keyed by uid. Deliberately a ref, not state:
   * collision runs every frame of a drag and must never re-render React.
   */
  const objects = useRef(new Map<string, THREE.Object3D>());
  const orbit = useRef<OrbitImpl>(null);
  const dragBefore = useRef<Snapshot | null>(null);
  /** walls block movement during the drag; items are only settled onto at release. */
  const wallsFrozen = useRef<THREE.Box3[]>([]);
  const itemsFrozen = useRef<THREE.Box3[]>([]);
  /** uids the user has positioned by hand; the arranger leaves these alone. */
  const pinned = useRef(new Set<string>());
  /** objects resting on the one being dragged, carried along with it. */
  const riders = useRef<{ object: THREE.Object3D; start: THREE.Vector3 }[]>([]);

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
    // Imported items own their coordinates. Pin them before the arranger reads
    // `pinned` below, or it reflows the layout the file just restored.
    if (pendingLayout) for (const uid of pendingLayout.keys()) pinned.current.add(uid);

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

  /**
   * Apply an imported layout. Meshes mount a frame or more after the store
   * updates (GLBs suspend), so retry until every uid has an object.
   */
  useEffect(() => {
    if (!pendingLayout?.size) return;
    let raf = 0;
    const apply = () => {
      let missing = false;
      for (const [uid, t] of pendingLayout) {
        const o = objects.current.get(uid);
        if (!o) {
          missing = true;
          continue;
        }
        o.position.set(t.position[0], t.position[1], t.position[2]);
        o.rotation.y = t.rotationY;
        // imported coordinates are deliberate: keep the arranger off them
        pinned.current.add(uid);
      }
      if (missing) {
        raf = requestAnimationFrame(apply);
        return;
      }
      consumeLayout();
    };
    apply();
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingLayout]);

  // Export: serialise the live scene for the export dialog to present.
  useEffect(() => {
    if (!exportToken) return;
    const { placed, roomMode, months } = useWorkspace.getState();
    setExported(toLayout(placed, objects.current, roomMode, months));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportToken]);

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
      {/* Fill lights instead of an HDR environment map: the preset downloads a
          texture and processes it on the GPU, which is a common cause of
          context loss on lower-memory devices. */}
      <directionalLight position={[-4, 3, -2]} intensity={0.45} color="#dce6ff" />
      <directionalLight position={[0, 2, 5]} intensity={0.35} color="#fff3e0" />

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
              placed={pendingLayout?.has(p.uid) ?? false}
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
          size={0.8}
          // Gizmo drags must not also orbit the camera.
          onMouseDown={() => {
            if (orbit.current) orbit.current.enabled = false;
            dragBefore.current = snapshot(selectedObject);
            // walls block sideways movement so furniture can't leave the room
            wallsFrozen.current = roomMode === 'walls' ? wallBoxes() : [];
            // other items are what an object can rest on / fall onto
            itemsFrozen.current = staticBoxes(
              [...objects.current.values()],
              selectedObject,
              supportObjects(placed, objects.current),
            );
            // remember what's resting on this object, to carry it along
            riders.current = ridersOf(selectedObject, objects.current);
          }}
          onObjectChange={() => {
            // Free movement in every axis while dragging — no collision fights
            // the cursor. The room is the one hard limit: clamping the
            // footprint holds on all four sides, including the two without a
            // visible wall, and can't squeeze an object out sideways the way
            // resolving against the wall slabs could.
            clampToRoom(selectedObject);

            // Carry whatever is resting on this object along the floor plane.
            if (riders.current.length && dragBefore.current) {
              const dx = selectedObject.position.x - dragBefore.current.p.x;
              const dz = selectedObject.position.z - dragBefore.current.p.z;
              for (const r of riders.current) {
                r.object.position.x = r.start.x + dx;
                r.object.position.z = r.start.z + dz;
                clampToRoom(r.object);
              }
            }
          }}
          onMouseUp={() => {
            if (orbit.current) orbit.current.enabled = true;
            const before = dragBefore.current;
            dragBefore.current = null;
            if (!before) return;

            // Gravity: whatever you were holding rests on the surface directly
            // below it, or falls to the floor if there's nothing under it. One
            // rule covers dropping onto a desk and dropping into open space.
            if (collide) {
              settleOnSurface(selectedObject, itemsFrozen.current);
              resolveCollisions(selectedObject, [...itemsFrozen.current, ...wallsFrozen.current]);
            }

            // Riders followed along; capture their before/after so undo moves
            // the whole group back together. Snapshot the carried items now.
            const carried = riders.current.map((r) => ({
              object: r.object,
              from: r.start.clone(),
              to: r.object.position.clone(),
            }));
            riders.current = [];

            const after = snapshot(selectedObject);
            const moved = !same(before, after) || carried.some((c) => !c.from.equals(c.to));
            if (!moved) return;
            // hand-placed from now on: adding more items won't move this
            if (selected) pinned.current.add(selected);
            push({
              label: mode === 'translate' ? 'move' : mode,
              undo: () => {
                apply(selectedObject, before);
                carried.forEach((c) => c.object.position.copy(c.from));
              },
              redo: () => {
                apply(selectedObject, after);
                carried.forEach((c) => c.object.position.copy(c.to));
              },
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

/** The mounted objects that are desks, whose legroom shouldn't block anything. */
function supportObjects(
  placed: { uid: string; itemId: string }[],
  objects: Map<string, THREE.Object3D>,
) {
  const set = new Set<THREE.Object3D>();
  for (const p of placed) {
    if (byId(p.itemId)?.placement !== 'support') continue;
    const o = objects.get(p.uid);
    if (o) set.add(o);
  }
  return set;
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

/**
 * Objects resting on top of `base`: their footprint overlaps it in x/z and
 * their underside sits at (roughly) the base's top. These get carried when the
 * base is dragged, so items on a desk travel with it.
 */
function ridersOf(base: THREE.Object3D, all: Map<string, THREE.Object3D>) {
  const b = worldBox(base);
  const out: { object: THREE.Object3D; start: THREE.Vector3 }[] = [];

  for (const o of all.values()) {
    if (o === base) continue;
    const ob = worldBox(o);
    const overlapsXZ =
      b.min.x < ob.max.x && b.max.x > ob.min.x && b.min.z < ob.max.z && b.max.z > ob.min.z;
    const restsOnTop = Math.abs(ob.min.y - b.max.y) < 0.04;
    if (overlapsXZ && restsOnTop) out.push({ object: o, start: o.position.clone() });
  }
  return out;
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
