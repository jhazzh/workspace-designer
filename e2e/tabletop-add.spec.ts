import { expect, test } from '@playwright/test';
import { addItem, ready } from './helpers';

const LAYOUT = JSON.stringify({
  version: 1,
  room: 'walls',
  months: 3,
  items: [
    { itemId: 'desk-oak', position: [0, 0, 0], rotationY: 0 },
    { itemId: 'chair-ergonomic', position: [0, 0, 1.108], rotationY: 3.142 },
    { itemId: 'monitor-ultrawide', position: [-0.184, 0.741, -0.033], rotationY: 0 },
  ],
});

const openDialog = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Export, Import, or Edit with AI' }).click();

test('a monitor added after a desk rests on the desktop', async ({ page }) => {
  await ready(page);
  await addItem(page, /Desk/, /Oak Writing Desk/);
  await addItem(page, /Monitor/, /Ultrawide/);
  await page.waitForTimeout(400);

  const mon = await page.evaluate(() => window.__sceneProbe?.('monitor-ultrawide') ?? null);
  expect(mon!.minY).toBeGreaterThan(0.6);
});

test('the dialog opens on an empty room', async ({ page }) => {
  await ready(page);
  await openDialog(page);
  const dialog = page.getByRole('dialog', { name: 'Export, Import, or Edit with AI' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('empty room')).toBeVisible();
});

test('pasting a layout applies it', async ({ page }) => {
  await ready(page);
  await openDialog(page);

  const dialog = page.getByRole('dialog', { name: 'Export, Import, or Edit with AI' });
  await dialog.getByPlaceholder('{ "version": 1').fill(LAYOUT);
  await dialog.getByRole('button', { name: 'Apply layout' }).click();

  // dialog closes on success
  await expect(dialog).toBeHidden();
  await page.waitForTimeout(600);

  const mon = await page.evaluate(() => window.__sceneProbe?.('monitor-ultrawide') ?? null);
  expect(mon, 'monitor should exist after paste').not.toBeNull();
  expect(mon!.minY).toBeGreaterThan(0.6);
});

test('bad JSON shows an inline error and keeps the dialog open', async ({ page }) => {
  await ready(page);
  await openDialog(page);

  const dialog = page.getByRole('dialog', { name: 'Export, Import, or Edit with AI' });
  await dialog.getByPlaceholder('{ "version": 1').fill('not json at all');
  await dialog.getByRole('button', { name: 'Apply layout' }).click();

  await expect(dialog.getByText(/valid JSON/i)).toBeVisible();
  await expect(dialog).toBeVisible();
});
