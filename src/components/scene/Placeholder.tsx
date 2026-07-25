'use client';

import type { Item } from '@/data/catalog';

/**
 * Low-poly stand-ins built from primitives, used until a GLB exists for an
 * item. Every mesh is modelled with its origin at the floor-contact point so
 * it obeys the same contract as the real models.
 */
export function Placeholder({ item }: { item: Item }) {
  const [w, h, d] = item.size;
  const c = item.color;

  switch (item.slot) {
    case 'desk': {
      const legT = 0.06;
      const topT = 0.04;
      const legH = h - topT;
      const legs: [number, number][] = [
        [w / 2 - legT, d / 2 - legT],
        [-(w / 2 - legT), d / 2 - legT],
        [w / 2 - legT, -(d / 2 - legT)],
        [-(w / 2 - legT), -(d / 2 - legT)],
      ];
      return (
        <group>
          <mesh castShadow receiveShadow position={[0, h - topT / 2, 0]}>
            <boxGeometry args={[w, topT, d]} />
            <meshStandardMaterial color={c} roughness={0.65} />
          </mesh>
          {legs.map(([x, z], i) => (
            <mesh key={i} castShadow position={[x, legH / 2, z]}>
              <boxGeometry args={[legT, legH, legT]} />
              <meshStandardMaterial color={c} roughness={0.8} metalness={0.1} />
            </mesh>
          ))}
        </group>
      );
    }

    case 'chair': {
      const seatY = h * 0.45;
      const seatT = 0.08;
      return (
        <group>
          <mesh castShadow receiveShadow position={[0, seatY, 0]}>
            <boxGeometry args={[w, seatT, d * 0.9]} />
            <meshStandardMaterial color={c} roughness={0.7} />
          </mesh>
          {/* backrest */}
          <mesh castShadow position={[0, seatY + h * 0.26, -d * 0.38]}>
            <boxGeometry args={[w * 0.9, h * 0.5, 0.07]} />
            <meshStandardMaterial color={c} roughness={0.7} />
          </mesh>
          {/* post */}
          <mesh castShadow position={[0, seatY / 2, 0]}>
            <cylinderGeometry args={[0.045, 0.045, seatY, 12]} />
            <meshStandardMaterial color="#5b6069" metalness={0.5} roughness={0.4} />
          </mesh>
          {/* base */}
          <mesh castShadow position={[0, 0.03, 0]}>
            <cylinderGeometry args={[w * 0.48, w * 0.5, 0.06, 16]} />
            <meshStandardMaterial color="#40454d" metalness={0.5} roughness={0.45} />
          </mesh>
        </group>
      );
    }

    case 'monitor': {
      const standH = h * 0.3;
      const panelH = h - standH;
      return (
        <group>
          <mesh castShadow position={[0, 0.012, 0]}>
            <boxGeometry args={[w * 0.4, 0.024, d]} />
            <meshStandardMaterial color="#2b3037" roughness={0.5} />
          </mesh>
          <mesh castShadow position={[0, standH / 2, 0]}>
            <boxGeometry args={[0.07, standH, 0.06]} />
            <meshStandardMaterial color="#2b3037" roughness={0.5} />
          </mesh>
          <mesh castShadow position={[0, standH + panelH / 2, 0]}>
            <boxGeometry args={[w, panelH, 0.035]} />
            <meshStandardMaterial color={c} roughness={0.35} />
          </mesh>
          {/* screen face, slightly emissive so it reads as "on" */}
          <mesh position={[0, standH + panelH / 2, 0.019]}>
            <planeGeometry args={[w * 0.94, panelH * 0.9]} />
            <meshStandardMaterial
              color="#6f8fb5"
              emissive="#3d5f8a"
              emissiveIntensity={0.45}
              roughness={0.2}
            />
          </mesh>
        </group>
      );
    }

    case 'lamp': {
      const isFloor = h > 1;
      const poleR = isFloor ? 0.028 : 0.02;
      return (
        <group>
          <mesh castShadow position={[0, 0.02, 0]}>
            <cylinderGeometry args={[w * 0.45, w * 0.5, 0.04, 16]} />
            <meshStandardMaterial color="#494e56" metalness={0.4} roughness={0.5} />
          </mesh>
          <mesh castShadow position={[0, h * 0.5, 0]}>
            <cylinderGeometry args={[poleR, poleR, h * 0.95, 10]} />
            <meshStandardMaterial color="#6a7079" metalness={0.4} roughness={0.5} />
          </mesh>
          <mesh castShadow position={[0, h - w * 0.35, 0]}>
            <coneGeometry args={[w * 0.55, w * 0.7, 18, 1, true]} />
            <meshStandardMaterial color={c} roughness={0.6} side={2} />
          </mesh>
          <pointLight
            position={[0, h - w * 0.5, 0]}
            intensity={isFloor ? 3 : 1.4}
            distance={isFloor ? 6 : 3}
            color="#ffdfae"
          />
        </group>
      );
    }

    case 'plant': {
      const potH = h * 0.28;
      const foliageR = w * 0.5;
      return (
        <group>
          <mesh castShadow receiveShadow position={[0, potH / 2, 0]}>
            <cylinderGeometry args={[w * 0.3, w * 0.24, potH, 16]} />
            <meshStandardMaterial color="#b0714f" roughness={0.85} />
          </mesh>
          <mesh castShadow position={[0, potH + (h - potH) * 0.45, 0]}>
            <sphereGeometry args={[foliageR, 14, 12]} />
            <meshStandardMaterial color={c} roughness={0.9} flatShading />
          </mesh>
          {h > 0.6 && (
            <mesh castShadow position={[foliageR * 0.35, potH + (h - potH) * 0.78, -0.05]}>
              <sphereGeometry args={[foliageR * 0.62, 12, 10]} />
              <meshStandardMaterial color={c} roughness={0.9} flatShading />
            </mesh>
          )}
        </group>
      );
    }

    case 'storage': {
      const drawers = Math.max(2, Math.round(h / 0.28));
      return (
        <group>
          <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial color={c} roughness={0.7} />
          </mesh>
          {Array.from({ length: drawers }, (_, i) => (
            <mesh key={i} position={[0, (h / drawers) * (i + 0.5), d / 2 + 0.006]}>
              <boxGeometry args={[w * 0.5, 0.02, 0.012]} />
              <meshStandardMaterial color="#33383f" roughness={0.5} />
            </mesh>
          ))}
        </group>
      );
    }

    case 'rug':
      return (
        <mesh receiveShadow position={[0, h / 2, 0]}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color={c} roughness={1} />
        </mesh>
      );

    default:
      return (
        <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color={c} roughness={0.7} />
        </mesh>
      );
  }
}
