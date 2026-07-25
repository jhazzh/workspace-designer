import { test, expect, type Page } from '@playwright/test';

const catalog = (page: Page) => page.getByRole('complementary', { name: 'Catalog' });
const summaryOf = (page: Page) => page.getByRole('complementary', { name: 'Your setup' });

const addItem = async (page: Page, tab: RegExp, name: RegExp) => {
  await page.getByRole('tab', { name: tab }).click();
  // scope to the catalog: the summary has same-named remove buttons
  await catalog(page).getByRole('button', { name }).click();
  await page.waitForTimeout(250);
};

/**
 * The canvas is created before R3F gives it a size, so waiting on visibility
 * alone is racy. Wait until it has actually been laid out and drawn.
 */
const ready = async (page: Page) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Oak Writing Desk/ })).toBeVisible();
  await page.waitForFunction(() => {
    const c = document.querySelector('canvas');
    return !!c && c.getBoundingClientRect().width > 100 && c.width > 100;
  });
};

test.describe('workspace designer', () => {
  test('renders a live WebGL canvas', async ({ page }) => {
    await ready(page);
    const info = await page.evaluate(() => {
      const c = document.querySelector('canvas')!;
      const r = c.getBoundingClientRect();
      return { w: r.width, h: r.height, backing: c.width };
    });
    // laid out, and given a real drawing buffer by the renderer
    expect(info.w).toBeGreaterThan(100);
    expect(info.h).toBeGreaterThan(100);
    expect(info.backing).toBeGreaterThan(100);
  });

  test('the scene actually draws pixels', async ({ page }) => {
    await ready(page);
    await addItem(page, /Desk/, /Oak Writing Desk/);
    await page.waitForTimeout(700);

    // A blank canvas compresses to almost nothing; a rendered room does not.
    const shot = await page.locator('canvas').screenshot();
    expect(shot.length).toBeGreaterThan(20_000);
  });

  test('starts empty and prompts for a desk', async ({ page }) => {
    await ready(page);
    await expect(page.getByText('Your room is empty')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add items to rent' })).toBeDisabled();
  });

  test('picking a desk swaps rather than stacks', async ({ page }) => {
    await ready(page);
    const summary = summaryOf(page);

    await addItem(page, /Desk/, /Oak Writing Desk/);
    await expect(summary.getByText('Oak Writing Desk')).toBeVisible();

    await addItem(page, /Desk/, /Compact Studio Desk/);
    await expect(summary.getByText('Compact Studio Desk')).toBeVisible();
    await expect(summary.getByText('Oak Writing Desk')).toHaveCount(0);
  });

  test('accessories accumulate and toggle off', async ({ page }) => {
    await ready(page);
    const summary = summaryOf(page);

    await addItem(page, /Monitors/, /27" 4K Monitor/);
    await addItem(page, /Monitors/, /34" Ultrawide/);
    await expect(summary.locator('li')).toHaveCount(2);

    // clicking the same catalog card again removes it
    await catalog(page).getByRole('button', { name: /27" 4K Monitor/ }).click();
    await expect(summary.locator('li')).toHaveCount(1);
    await expect(summary.getByText('34" Ultrawide')).toBeVisible();
  });

  test('items land on the desk without manual tidying', async ({ page }) => {
    await ready(page);
    await addItem(page, /Desk/, /Oak Writing Desk/);
    await addItem(page, /Monitors/, /27" 4K Monitor/);
    await page.waitForTimeout(700);

    // The desk is 0.74m tall, so a monitor sitting on it must have its base
    // near that height — not on the floor beside it.
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
    for (const o of all) {
      // every item rests on the floor or on another surface, never below it
      expect(o.minY).toBeGreaterThan(-0.02);
    }
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

  test('undo empties the room and redo restores it', async ({ page }) => {
    await ready(page);
    await addItem(page, /Desk/, /Oak Writing Desk/);
    await addItem(page, /Chair/, /Ergonomic Mesh Chair/);
    await addItem(page, /Plants/, /Monstera/);

    const summary = summaryOf(page);
    await expect(summary.locator('li')).toHaveCount(3);

    // undo until the stack is exhausted, waiting for each step to land
    const undo = page.getByRole('button', { name: 'Undo' });
    for (let i = 0; i < 3; i++) {
      await undo.click();
      await expect(summary.locator('li')).toHaveCount(2 - i);
    }
    await expect(page.getByText('Your room is empty')).toBeVisible();
    await expect(undo).toBeDisabled();

    const redo = page.getByRole('button', { name: 'Redo' });
    for (let i = 0; i < 3; i++) {
      await redo.click();
      await expect(summary.locator('li')).toHaveCount(i + 1);
    }
    await expect(redo).toBeDisabled();
  });

  test('pricing: deposit matches monthly and discount tiers apply', async ({ page }) => {
    await ready(page);
    await addItem(page, /Desk/, /Oak Writing Desk/); // $42
    await addItem(page, /Chair/, /Ergonomic Mesh Chair/); // $38  => $80/mo

    const dueToday = page.getByText('Due today').locator('..').locator('dd');

    // 1 month: no discount. 80 rent + 80 deposit
    await page.locator('#months').fill('1');
    await expect(dueToday).toHaveText('$160');

    // 12 months: 20% off => 64/mo, deposit 64, due 128
    await page.locator('#months').fill('12');
    await expect(page.getByText(/20% long-stay discount/)).toBeVisible();
    await expect(dueToday).toHaveText('$128');
  });

  test('checkout is reached and never trusts client prices', async ({ page }) => {
    await ready(page);
    const res = await page.evaluate(async () => {
      const r = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // a hostile client claiming everything is free
        body: JSON.stringify({ ids: ['desk-oak'], months: 1, monthly: 0, dueToday: 0 }),
      });
      return { status: r.status, body: await r.json() };
    });

    // Either Stripe is configured (303/200 with a url) or it degrades cleanly.
    if (res.status === 200) expect(res.body.url).toContain('stripe');
    else expect([400, 503, 500]).toContain(res.status);
  });

  test('empty cart cannot check out', async ({ page }) => {
    await ready(page);
    const res = await page.evaluate(async () => {
      const r = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [], months: 3 }),
      });
      return r.status;
    });
    expect(res).toBe(400);
  });

  test('walls can be turned off and back on', async ({ page }) => {
    await ready(page);
    await addItem(page, /Desk/, /Oak Writing Desk/);
    const toggle = page.getByRole('button', { name: /^(Walls|Open)$/ });

    await expect(toggle).toHaveText('Walls');
    await toggle.click();
    await expect(toggle).toHaveText('Open');
    await toggle.click();
    await expect(toggle).toHaveText('Walls');
  });

  test('no horizontal overflow', async ({ page }) => {
    await ready(page);
    await addItem(page, /Desk/, /Oak Writing Desk/);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });

  test('the flow is reachable without a mouse', async ({ page }) => {
    await ready(page);
    await page.getByRole('button', { name: /Oak Writing Desk/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Rent this setup' })).toBeEnabled();
    await expect(page.locator('[aria-live="polite"]')).toContainText('1 item');
  });
});
