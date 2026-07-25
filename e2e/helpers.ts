import { expect, type Page } from '@playwright/test';

export const catalog = (page: Page) => page.getByRole('complementary', { name: 'Catalog' });
export const summary = (page: Page) => page.getByRole('complementary', { name: 'Your setup' });

/**
 * Wait until R3F stops resizing the canvas. Opening a panel reflows the stage,
 * and a click issued mid-reflow lands on a moving target.
 */
const settled = async (page: Page) => {
  const size = () =>
    page.evaluate(() => {
      const c = document.querySelector('canvas');
      const r = c?.getBoundingClientRect();
      return r ? `${Math.round(r.width)}x${Math.round(r.height)}` : '';
    });
  let prev = await size();
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(100);
    const next = await size();
    if (next === prev) return;
    prev = next;
  }
};

/**
 * On mobile the panels are an accordion, so the catalog has to be expanded
 * before anything inside it can be clicked. No-op on desktop, where the
 * toggle button is hidden.
 */
export const openCatalog = async (page: Page) => {
  const toggle = catalog(page).getByRole('button', { name: /Catalog/ });
  if (!(await toggle.isVisible())) return;
  if ((await toggle.getAttribute('aria-expanded')) !== 'false') return;
  await toggle.click();
  // R3F resizes the canvas as the panel expands; wait for that to settle
  // rather than sleeping, or clicks land while the row is still moving.
  await expect(page.locator('#catalog-body')).toBeVisible();
  await settled(page);
};

/** Same, for the summary panel. Opening it collapses the catalog on mobile. */
export const openSummary = async (page: Page) => {
  const toggle = summary(page).getByRole('button', { name: /Your setup/ });
  if (!(await toggle.isVisible())) return;
  if ((await toggle.getAttribute('aria-expanded')) !== 'false') return;
  await toggle.click();
  await expect(page.locator('#summary-body')).toBeVisible();
  await settled(page);
};

/** Add an item by opening its tab and clicking the catalog card (not a summary row). */
export const addItem = async (page: Page, tab: RegExp, name: RegExp) => {
  await openCatalog(page);
  await page.getByRole('tab', { name: tab }).click();
  await catalog(page).getByRole('button', { name }).click();
  await page.waitForTimeout(250);
};

/**
 * The canvas element exists before R3F sizes it, so visibility alone is racy.
 * Wait until it has real layout and a real drawing buffer.
 */
export const ready = async (page: Page) => {
  await page.goto('/');
  // The catalog is display:none while collapsed on mobile, so don't gate on
  // its contents — hydration is covered by the toolbar, which is always shown.
  await expect(page.getByRole('button', { name: 'Clear' })).toBeAttached();
  await page.waitForFunction(() => {
    const c = document.querySelector('canvas');
    return !!c && c.getBoundingClientRect().width > 100 && c.width > 100;
  });
};

/** Bounding boxes of every placed item, read from inside the WebGL scene. */
export type ProbeResult = { id: string; minY: number; maxY: number };
export type TransformResult = {
  id: string;
  position: [number, number, number];
  rotationY: number;
};

declare global {
  interface Window {
    __sceneProbe?: (itemId: string) => ProbeResult | null;
    __sceneProbeAll?: () => ProbeResult[];
    __sceneTransforms?: () => TransformResult[];
    __sceneOverlaps?: () => number;
  }
}
