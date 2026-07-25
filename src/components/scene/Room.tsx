'use client';

import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { Clone, Grid, useGLTF } from '@react-three/drei';
import { useWorkspace, type RoomMode } from '@/store/useWorkspace';
import { ROOM_SIZE as SIZE, WALL_HEIGHT as WALL_H } from '@/lib/scene/room';
import { HELPER } from '@/lib/scene/glb';

/**
 * Floor plus optional corner walls. Walls are primitives today; a wall GLB can
 * replace them later without touching anything that positions furniture.
 *
 * An imported room shell replaces this entirely. It's scenery: furniture still
 * collides against the fixed room bounds, so an oversized model may overhang.
 */
export function Room({ mode }: { mode: RoomMode }) {
  const roomModel = useWorkspace((s) => s.roomModel);

  if (roomModel) {
    return (
      // A malformed GLB throws while loading; without a boundary that takes the
      // whole canvas down, so it falls back to the built-in room instead.
      <RoomBoundary key={roomModel.url} fallback={<BuiltInRoom mode={mode} />}>
        {/* Nothing is drawn while the GLB parses. Falling back to the built-in
            room here would flash the old walls back for a second, then have
            both floors z-fight at y=0 as the model takes over. */}
        <Suspense fallback={<LoadingFloor />}>
          <RoomModel url={roomModel.url} />
        </Suspense>
      </RoomBoundary>
    );
  }

  return <BuiltInRoom mode={mode} />;
}

/** Plain ground while a room loads — no walls, and below the imported floor. */
function LoadingFloor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
      <planeGeometry args={[SIZE, SIZE]} />
      <meshStandardMaterial color="#b9b3a8" roughness={0.95} />
    </mesh>
  );
}

class RoomBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    useWorkspace.getState().say("That room model couldn't be loaded");
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * An imported room GLB, centred on the origin.
 *
 * Height is deliberately left alone when the model already has geometry at
 * y=0: room exports often hang a base or terrain skirt below the floor, and
 * lifting the lowest vertex to y=0 would raise the real floor above the
 * furniture. Only a room floating entirely off the ground is dropped.
 */
function RoomModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);

  // Drop the parsed GLB from drei's cache once this room is gone; the blob URL
  // is never reused, so a retained entry is just held memory.
  useEffect(() => () => useGLTF.clear(url), [url]);

  // Measured from the source scene during render, not in an effect: an effect
  // runs after the first paint, so the room would flash at its authored
  // position for a frame before snapping into place.
  const offset = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const c = box.getCenter(new THREE.Vector3());
    // A floor authored at y=0 is already correct; only close the gap when the
    // whole model sits above the ground.
    return new THREE.Vector3(-c.x, box.min.y > 0 ? -box.min.y : 0, -c.z);
  }, [scene]);

  useEffect(() => {
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.receiveShadow = true;
    });
  }, [scene]);

  // Clone, not <primitive>: the cached scene is shared, and positioning it
  // directly would compound every time this remounts.
  return <Clone object={scene} position={offset} />;
}

function BuiltInRoom({ mode }: { mode: RoomMode }) {
  const walls = mode === 'walls';

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[SIZE, SIZE]} />
        <meshStandardMaterial color={walls ? '#c8bda9' : '#b9b3a8'} roughness={0.95} />
      </mesh>

      {!walls && (
        <Grid
          name={HELPER}
          args={[SIZE, SIZE]}
          cellSize={0.25}
          cellColor="#9a948a"
          sectionSize={1}
          sectionColor="#7d776d"
          fadeDistance={13}
          fadeStrength={1.2}
          position={[0, 0.002, 0]}
          infiniteGrid={false}
        />
      )}

      {walls && (
        <group>
          {/* back wall (far edge, negative Z) */}
          <mesh position={[0, WALL_H / 2, -SIZE / 2]} receiveShadow>
            <planeGeometry args={[SIZE, WALL_H]} />
            <meshStandardMaterial color="#e2d9c8" roughness={0.95} />
          </mesh>
          {/* left wall */}
          <mesh
            position={[-SIZE / 2, WALL_H / 2, 0]}
            rotation={[0, Math.PI / 2, 0]}
            receiveShadow
          >
            <planeGeometry args={[SIZE, WALL_H]} />
            <meshStandardMaterial color="#d9cfbd" roughness={0.95} />
          </mesh>
          {/* skirting, sells the corner */}
          <mesh position={[0, 0.05, -SIZE / 2 + 0.01]}>
            <boxGeometry args={[SIZE, 0.1, 0.02]} />
            <meshStandardMaterial color="#f2ece1" roughness={0.8} />
          </mesh>
          <mesh position={[-SIZE / 2 + 0.01, 0.05, 0]} rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[SIZE, 0.1, 0.02]} />
            <meshStandardMaterial color="#f2ece1" roughness={0.8} />
          </mesh>
        </group>
      )}
    </group>
  );
}
