import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { addItem, ready } from './helpers';

const GLB_MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

/**
 * Read the glTF JSON back out of a .glb. Hand-rolled rather than pulled from a
 * library: the point is to prove the bytes are a well-formed GLB, which a
 * forgiving parser would paper over.
 */
function parseGlb(buf: Buffer) {
  expect(buf.byteLength).toBeGreaterThan(20);
  expect(buf.readUInt32LE(0)).toBe(GLB_MAGIC);
  expect(buf.readUInt32LE(4)).toBe(2); // glTF 2.0
  expect(buf.readUInt32LE(8)).toBe(buf.byteLength); // declared length matches

  const chunks = new Map<number, Buffer>();
  let at = 12;
  while (at < buf.byteLength) {
    const len = buf.readUInt32LE(at);
    const type = buf.readUInt32LE(at + 4);
    chunks.set(type, buf.subarray(at + 8, at + 8 + len));
    at += 8 + len + ((4 - ((at + 8 + len) % 4)) % 4);
  }

  const json = chunks.get(CHUNK_JSON);
  expect(json, 'GLB has a JSON chunk').toBeTruthy();
  expect(chunks.get(CHUNK_BIN), 'GLB has a binary chunk').toBeTruthy();
  return JSON.parse(json!.toString('utf8'));
}

type Node = { name?: string; translation?: number[]; matrix?: number[] };

/**
 * A node's translation. glTF allows either TRS or a 4x4 matrix, and reading
 * only one of them silently yields the origin for every node written the other
 * way — which reads as "the exporter lost the position" rather than a bad test.
 */
function translationOf(node: Node): [number, number, number] {
  if (node.translation) {
    const [x, y, z] = node.translation;
    return [x, y, z];
  }
  // glTF matrices are column-major, so translation sits at elements 12-14.
  if (node.matrix) return [node.matrix[12], node.matrix[13], node.matrix[14]];
  return [0, 0, 0]; // glTF default: identity
}

async function exportGlb(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /Export, Import, or Edit with AI/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const wait = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download .glb' }).click();
  const download = await wait;

  expect(download.suggestedFilename()).toBe('workspace-room.glb');
  const path = await download.path();
  return parseGlb(await readFile(path));
}

test.describe('GLB export', () => {
  test('writes a valid GLB holding the room and every placed item', async ({ page }) => {
    await ready(page);
    await addItem(page, /Desk/, /Oak Writing Desk/);
    await addItem(page, /Chair/, /Ergonomic Mesh Chair/);
    await addItem(page, /Monitors/, /27" 4K Monitor/);
    await page.waitForTimeout(800);

    const gltf = await exportGlb(page);
    const names = (gltf.nodes ?? []).map((n: { name?: string }) => n.name ?? '');

    // Catalog names, not uids — this file gets opened by a person in Blender.
    expect(names).toContain('Room');
    expect(names).toContain('Oak Writing Desk');
    expect(names).toContain('Ergonomic Mesh Chair');
    expect(names).toContain('27" 4K Monitor');

    // Real geometry, not an empty node tree.
    expect(gltf.meshes?.length ?? 0).toBeGreaterThan(0);
    expect(gltf.accessors?.length ?? 0).toBeGreaterThan(0);
  });

  test('leaves viewer-only objects out of the file', async ({ page }) => {
    await ready(page);
    // Open mode draws the floor grid; selecting the desk draws its ring. Both
    // are on screen at export time and neither belongs in a customer's file.
    await page.getByRole('button', { name: /^Walls$/ }).click();
    await addItem(page, /Desk/, /Oak Writing Desk/);
    await page.waitForTimeout(800);

    const gltf = await exportGlb(page);
    const names = (gltf.nodes ?? []).map((n: { name?: string }) => n.name ?? '');
    expect(names).not.toContain('__helper');
  });

  test('places exported items where they sit in the scene', async ({ page }) => {
    await ready(page);
    await addItem(page, /Desk/, /Oak Writing Desk/);
    await addItem(page, /Monitors/, /27" 4K Monitor/);
    await page.waitForTimeout(800);

    const live = await page.evaluate(() => window.__sceneTransforms?.() ?? []);
    const monitor = live.find((t) => t.id === 'monitor-27');
    expect(monitor, 'monitor is in the scene').toBeTruthy();

    const gltf = await exportGlb(page);
    const node: Node | undefined = (gltf.nodes ?? []).find(
      (n: Node) => n.name === '27" 4K Monitor',
    );
    expect(node, 'monitor is in the GLB').toBeTruthy();
    expect(node!.translation ?? node!.matrix, 'monitor node carries a transform').toBeTruthy();

    // The monitor rests on the desk, so its exported translation must carry the
    // world position it was given in the scene — not the origin it was born at.
    const [x, y, z] = translationOf(node!);
    expect(y).toBeGreaterThan(0.6);
    expect(x).toBeCloseTo(monitor!.position[0], 2);
    expect(z).toBeCloseTo(monitor!.position[2], 2);
  });
});
