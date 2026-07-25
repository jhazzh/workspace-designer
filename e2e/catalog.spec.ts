import { test, expect } from '@playwright/test';
import { addItem, catalog, ready, summary } from './helpers';

test.describe('catalog', () => {
  test('starts empty and prompts for a desk', async ({ page }) => {
    await ready(page);
    await expect(page.getByText('Your room is empty')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add items to rent' })).toBeDisabled();
  });

  test('picking a desk swaps rather than stacks', async ({ page }) => {
    await ready(page);
    const s = summary(page);

    await addItem(page, /Desk/, /Oak Writing Desk/);
    await expect(s.getByText('Oak Writing Desk')).toBeVisible();

    await addItem(page, /Desk/, /Compact Studio Desk/);
    await expect(s.getByText('Compact Studio Desk')).toBeVisible();
    await expect(s.getByText('Oak Writing Desk')).toHaveCount(0);
  });

  test('accessories accumulate and toggle off', async ({ page }) => {
    await ready(page);
    const s = summary(page);

    await addItem(page, /Monitors/, /27" 4K Monitor/);
    await addItem(page, /Monitors/, /34" Ultrawide/);
    await expect(s.locator('li')).toHaveCount(2);

    // clicking the same catalog card again removes it
    await catalog(page).getByRole('button', { name: /27" 4K Monitor/ }).click();
    await expect(s.locator('li')).toHaveCount(1);
    await expect(s.getByText('34" Ultrawide')).toBeVisible();
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
});
