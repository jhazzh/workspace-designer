import { test, expect } from '@playwright/test';
import { addItem, openCatalog, openSummary, ready } from './helpers';

test.describe('accessibility & responsive', () => {
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
    // the catalog is collapsed on mobile, so its contents aren't focusable yet
    await openCatalog(page);
    await page.getByRole('button', { name: /Oak Writing Desk/ }).focus();
    await page.keyboard.press('Enter');
    // the narration is outside both panels, so it reports regardless of state
    await expect(page.locator('p.sr-only[aria-live="polite"]')).toContainText('1 item');
    // checkout lives in the summary panel, collapsed on mobile after the above
    await openSummary(page);
    await expect(page.getByRole('button', { name: 'Rent this setup' })).toBeEnabled();
  });
});
