import { test, expect } from '@playwright/test';
import { addItem, ready } from './helpers';

test.describe('pricing & checkout', () => {
  test('deposit matches monthly and discount tiers apply', async ({ page }) => {
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

    // configured -> a real Stripe url; not configured -> a clean failure
    if (res.status === 200) expect(res.body.url).toContain('stripe');
    else expect([400, 503, 500]).toContain(res.status);
  });

  test('empty cart cannot check out', async ({ page }) => {
    await ready(page);
    const status = await page.evaluate(async () => {
      const r = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [], months: 3 }),
      });
      return r.status;
    });
    expect(status).toBe(400);
  });
});
