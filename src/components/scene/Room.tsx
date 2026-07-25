'use client';

import { Grid } from '@react-three/drei';
import type { RoomMode } from '@/store/useWorkspace';

const SIZE = 8;
const WALL_H = 2.7;

/**
 * Floor plus optional corner walls. Walls are primitives today; a wall GLB can
 * replace them later without touching anything that positions furniture.
 */
export function Room({ mode }: { mode: RoomMode }) {
  const walls = mode === 'walls';

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[SIZE, SIZE]} />
        <meshStandardMaterial color={walls ? '#c8bda9' : '#b9b3a8'} roughness={0.95} />
      </mesh>

      {!walls && (
        <Grid
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
