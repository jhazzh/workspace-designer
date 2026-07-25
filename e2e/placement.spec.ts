import { test, expect } from '@playwright/test';
import { addItem, ready } from './helpers';

test.describe('manual placement', () => {
  test('an item dropped over the desk rests on the desktop', async ({ page }) => {
    await ready(page);
    await addItem(page, /Desk/, /Oak Writing Desk/); // 0.74m tall, at origin
    await addItem(page, /Storage/, /Rolling Drawer Unit/);
    await page.waitForTimeout(600);

    // drop the drawer unit right above the desk centre
    const baseY = await page.evaluate(
      () => window.__sceneSettle?.('storage-drawer', 0, 1.5, 0) ?? -1,
    );
    // it should land on the desktop (~0.74), not back on the floor
    expect(baseY).toBeGreaterThan(0.6);
  });

  test('an item dropped away from the desk lands on the floor', async ({ page }) => {
    await ready(page);
    await addItem(page, /Desk/, /Oak Writing Desk/);
    await addItem(page, /Plants/, /Monstera/);
    await page.waitForTimeout(600);

    const baseY = await page.evaluate(
      () => window.__sceneSettle?.('plant-monstera', 2.5, 1.5, 2.5) ?? -1,
    );
    expect(baseY).toBeGreaterThanOrEqual(-0.02);
    expect(baseY).toBeLessThan(0.05);
  });

  test('furniture cannot be pushed through the walls', async ({ page }) => {
    await ready(page);
    // ensure walls mode (default), add a desk
    await addItem(page, /Desk/, /Oak Writing Desk/);
    await page.waitForTimeout(500);

    const insideRoom = await page.evaluate(() => window.__scenePushToWall?.('desk-oak') ?? null);
    expect(insideRoom).toBe(true);
  });
});
