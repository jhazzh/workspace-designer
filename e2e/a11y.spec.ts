import { test, expect } from '@playwright/test';
import { addItem, ready } from './helpers';

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
    await page.getByRole('button', { name: /Oak Writing Desk/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Rent this setup' })).toBeEnabled();
    await expect(page.locator('[aria-live="polite"]')).toContainText('1 item');
  });
});
