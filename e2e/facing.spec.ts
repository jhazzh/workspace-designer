import { expect, test } from '@playwright/test';
import { addItem, ready } from './helpers';

/**
 * Pins down the model orientation convention the AI prompt documents:
 * rotationY=0 faces +Z for every item. The arranger seats a chair at the
 * desk's near (+Z) edge, so it must be turned to 3.142 to face the desk.
 */
test('the arranger seats a chair at +Z of the desk facing -Z', async ({ page }) => {
  await ready(page);
  await addItem(page, /Desk/, /Oak Writing Desk/);
  await addItem(page, /Chair/, /Ergonomic Mesh Chair/);
  await page.waitForTimeout(600);

  const state = await page.evaluate(() => window.__sceneTransforms?.() ?? null);
  expect(state, '__sceneTransforms probe must exist').not.toBeNull();

  const desk = state!.find((s) => s.id === 'desk-oak')!;
  const chair = state!.find((s) => s.id === 'chair-ergonomic')!;

  // chair sits on the viewer side of the desk
  expect(chair.position[2]).toBeGreaterThan(desk.position[2]);
  // and is turned around to look back at the desk
  expect(Math.abs(Math.abs(chair.rotationY) - Math.PI)).toBeLessThan(0.01);
});
