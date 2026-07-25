import { test, expect } from '@playwright/test';
import { addItem, ready } from './helpers';

test.describe('scene', () => {
  test('renders a live WebGL canvas', async ({ page }) => {
    await ready(page);
    const info = await page.evaluate(() => {
      const c = document.querySelector('canvas')!;
      const r = c.getBoundingClientRect();
      return { w: r.width, h: r.height, backing: c.width };
    });
    expect(info.w).toBeGreaterThan(100);
    expect(info.h).toBeGreaterThan(100);
    expect(info.backing).toBeGreaterThan(100);
  });

  test('the scene actually draws pixels', async ({ page }) => {
    await ready(page);
    await addItem(page, /Desk/, /Oak Writing Desk/);
    await page.waitForTimeout(700);
    // a blank canvas compresses to almost nothing; a rendered room does not
    const shot = await page.locator('canvas').screenshot();
    expect(shot.length).toBeGreaterThan(20_000);
  });

  test('recovers when the GPU drops the WebGL context', async ({ page }) => {
    await ready(page);
    await addItem(page, /Desk/, /Oak Writing Desk/);

    const forced = await page.evaluate(() => {
      const c = document.querySelector('canvas')!;
      const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext;
      const ext = gl.getExtension('WEBGL_lose_context');
      if (!ext) return false;
      ext.loseContext();
      setTimeout(() => ext.restoreContext(), 600);
      return true;
    });
    test.skip(!forced, 'WEBGL_lose_context unavailable');

    // the user is told what happened rather than staring at a blank box
    await expect(page.getByText('The 3D view stopped')).toBeVisible();
    // and it clears itself once the browser restores the context
    await expect(page.getByText('The 3D view stopped')).toBeHidden({ timeout: 15_000 });

    const alive = await page.evaluate(() => {
      const c = document.querySelector('canvas')!;
      const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext;
      return !gl.isContextLost();
    });
    expect(alive).toBe(true);
  });
});
