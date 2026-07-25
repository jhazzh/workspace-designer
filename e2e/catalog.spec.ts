import { test, expect } from '@playwright/test';
import { addItem, catalog, openSummary, ready, summary } from './helpers';

test.describe('catalog', () => {
  test('starts empty and prompts for a desk', async ({ page }) => {
    await ready(page);
    await expect(page.getByText('Your room is empty')).toBeVisible();
    // checkout lives in the summary panel, collapsed on mobile
    await openSummary(page);
    await expect(page.getByRole('button', { name: 'Add items to rent' })).toBeDisabled();
  });

  test('desks accumulate rather than swapping', async ({ page }) => {
    await ready(page);
    const s = summary(page);

    // desks are a multi slot: a second one joins the first. Both adds happen
    // before opening the summary, since the mobile accordion shows one panel.
    await addItem(page, /Desk/, /Oak Writing Desk/);
    await addItem(page, /Desk/, /Compact Studio Desk/);

    await openSummary(page);
    await expect(s.getByText('Compact Studio Desk')).toBeVisible();
    await expect(s.getByText('Oak Writing Desk')).toBeVisible();
    await expect(s.locator('li')).toHaveCount(2);
  });

  test('accessories accumulate and toggle off', async ({ page }) => {
    await ready(page);
    const s = summary(page);

    await addItem(page, /Monitors/, /27" 4K Monitor/);
    await addItem(page, /Monitors/, /34" Ultrawide/);

    // toHaveCount matches hidden rows, so the panel need not be open for these
    await expect(s.locator('li')).toHaveCount(2);

    // the card's − step removes one; exact name avoids the "Add one" sibling
    await catalog(page)
      .getByRole('button', { name: 'Remove one 27" 4K Monitor', exact: true })
      .click();
    await expect(s.locator('li')).toHaveCount(1);

    // only this last check needs the summary actually on screen
    await openSummary(page);
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
