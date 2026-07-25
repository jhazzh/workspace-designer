import { test, expect } from '@playwright/test';
import { addItem, ready, summary } from './helpers';

test.describe('undo / redo', () => {
  test('undo empties the room and redo restores it', async ({ page }) => {
    await ready(page);
    await addItem(page, /Desk/, /Oak Writing Desk/);
    await addItem(page, /Chair/, /Ergonomic Mesh Chair/);
    await addItem(page, /Plants/, /Monstera/);

    const rows = summary(page).locator('li');
    await expect(rows).toHaveCount(3);

    // Drive undo/redo by keyboard, not by clicking the toolbar. After each
    // undo the scene re-arranges, and for a frame the WebGL canvas can swallow
    // a pointer click aimed at the button above it. The shortcut has no such
    // race and exercises the same store action.
    const undo = () => page.keyboard.press('Control+z');
    const redo = () => page.keyboard.press('Control+y');

    await undo();
    await expect(rows).toHaveCount(2);
    await undo();
    await expect(rows).toHaveCount(1);
    await undo();
    await expect(rows).toHaveCount(0);
    await expect(page.getByText('Your room is empty')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();

    await redo();
    await expect(rows).toHaveCount(1);
    await redo();
    await expect(rows).toHaveCount(2);
    await redo();
    await expect(rows).toHaveCount(3);
    await expect(page.getByRole('button', { name: 'Redo' })).toBeDisabled();
  });
});
