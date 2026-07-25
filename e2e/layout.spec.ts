import { test, expect } from '@playwright/test';
import { addItem, ready } from './helpers';

test.describe('layout engine', () => {
  test('items land on the desk without manual tidying', async ({ page }) => {
    await ready(page);
    await addItem(page, /Desk/, /Oak Writing Desk/);
    await addItem(page, /Monitors/, /27" 4K Monitor/);
    await page.waitForTimeout(700);

    // desk is 0.74m tall, so a monitor resting on it must sit near that height
    const baseY = await page.evaluate(() => window.__sceneProbe?.('monitor-27')?.minY ?? -1);
    expect(baseY).toBeGreaterThan(0.6);
    expect(baseY).toBeLessThan(0.95);
  });

  test('nothing floats or sinks through the floor', async ({ page }) => {
    await ready(page);
    await addItem(page, /Desk/, /Standing/);
    await addItem(page, /Chair/, /Ergonomic Mesh Chair/);
    await addItem(page, /Plants/, /Monstera/);
    await addItem(page, /Storage/, /Rolling Drawer Unit/);
    await page.waitForTimeout(800);

    const all = await page.evaluate(() => window.__sceneProbeAll?.() ?? []);
    expect(all.length).toBe(4);
    for (const o of all) expect(o.minY).toBeGreaterThan(-0.02);
  });

  test('items do not overlap each other', async ({ page }) => {
    await ready(page);
    await addItem(page, /Desk/, /Oak Writing Desk/);
    await addItem(page, /Chair/, /Ergonomic Mesh Chair/);
    await addItem(page, /Storage/, /Low Bookshelf/);
    await page.waitForTimeout(800);

    const overlaps = await page.evaluate(() => window.__sceneOverlaps?.() ?? -1);
    expect(overlaps).toBe(0);
  });
});
