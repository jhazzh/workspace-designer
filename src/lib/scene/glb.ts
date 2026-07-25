import * as THREE from 'three';

/**
 * Marks an object as viewer scaffolding rather than part of the room —
 * selection rings, the floor grid — so the GLB export can drop it. Named rather
 * than inferred from type, since a grid and a rug are both just meshes.
 */
export const HELPER = '__helper';

/**
 * Serialise the room and its contents to a binary glTF, ready for Blender.
 *
 * Only the room shell and the placed items go in. Everything else in the canvas
 * is viewer scaffolding — the transform gizmo, contact shadows, the invisible
 * plane that catches deselect clicks — and exporting it would hand the customer
 * a file full of objects they never placed.
 */
export async function sceneToGlb(
  room: THREE.Object3D | null,
  objects: Map<string, THREE.Object3D>,
  /** uid -> catalog name, so Blender's outliner reads "Oak Writing Desk". */
  names: Map<string, string>,
): Promise<Blob> {
  const root = new THREE.Group();
  root.name = 'Workspace';

  if (room) root.add(bake(room));
  for (const [uid, o] of objects) {
    const copy = bake(o);
    copy.name = names.get(uid) ?? uid;
    root.add(copy);
  }

  // Loaded on demand: the exporter is a few tens of KB that only matters the
  // moment someone actually exports.
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  // trs: nodes carry translation/rotation/scale rather than a 4x4 matrix, so
  // the file stays legible to anyone who opens it, and identity components are
  // dropped instead of written out as sixteen floats.
  const out = await new GLTFExporter().parseAsync(root, { binary: true, trs: true });

  if (!(out instanceof ArrayBuffer)) throw new Error('Exporter did not return binary glTF.');
  return new Blob([out], { type: 'model/gltf-binary' });
}

/**
 * A detached copy of `o` standing where `o` stands.
 *
 * The live object can't just be reparented into the export group — that would
 * pull it out of the scene mid-frame — so it's cloned, and its world transform
 * is baked onto the copy since the copy has no parent to inherit one from.
 */
function bake(o: THREE.Object3D): THREE.Object3D {
  o.updateWorldMatrix(true, false);
  const copy = o.clone(true);
  o.matrixWorld.decompose(copy.position, copy.quaternion, copy.scale);
  strip(copy);
  return copy;
}

/** Drop viewer-only children, at any depth. */
function strip(o: THREE.Object3D) {
  for (const child of [...o.children]) {
    if (child.name === HELPER) o.remove(child);
    else strip(child);
  }
}
