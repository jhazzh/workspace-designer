import { expect, type Page } from '@playwright/test';

export const catalog = (page: Page) => page.getByRole('complementary', { name: 'Catalog' });
export const summary = (page: Page) => page.getByRole('complementary', { name: 'Your setup' });

/** Add an item by opening its tab and clicking the catalog card (not a summary row). */
export const addItem = async (page: Page, tab: RegExp, name: RegExp) => {
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
  await expect(page.getByRole('button', { name: /Oak Writing Desk/ })).toBeVisible();
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
