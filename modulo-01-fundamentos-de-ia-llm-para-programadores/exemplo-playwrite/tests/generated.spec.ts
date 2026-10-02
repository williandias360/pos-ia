import { test, expect } from '@playwright/test';

const appPath = '/vanilla-js-web-app-example';

test.describe('image card form', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem('tdd-ew-db');
    });
    await page.goto(appPath);
  });

  test('submits the form and updates the image list', async ({ page }) => {
    const title = 'Generated MCP image';
    const imageUrl = 'https://example.com/generated-mcp.png';
    const cards = page.getByRole('article');

    await expect(cards).toHaveCount(3);
    await page.getByRole('textbox', { name: 'Image Title' }).fill(title);
    await page.getByRole('textbox', { name: 'Image URL' }).fill(imageUrl);
    await page.getByRole('button', { name: 'Submit Form' }).click();

    await expect(cards).toHaveCount(4);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: `Image of an ${title}`, exact: true }))
      .toHaveAttribute('src', imageUrl);
    await expect(page.getByRole('textbox', { name: 'Image Title' })).toHaveValue('');
    await expect(page.getByRole('textbox', { name: 'Image URL' })).toHaveValue('');
  });

  test('shows validation feedback for an empty form', async ({ page }) => {
    const titleInput = page.getByRole('textbox', { name: 'Image Title' });
    const imageUrlInput = page.getByRole('textbox', { name: 'Image URL' });

    await page.getByRole('button', { name: 'Submit Form' }).click();

    await expect(page.locator('form.needs-validation')).toHaveClass(/was-validated/);
    await expect(titleInput).toBeFocused();
    expect(await titleInput.evaluate((element) => (element as HTMLInputElement).validity.valid)).toBe(false);
    expect(await imageUrlInput.evaluate((element) => (element as HTMLInputElement).validity.valid)).toBe(false);
    await expect(page.getByText('Please type a title for the image.', { exact: true })).toBeVisible();
    await expect(page.getByText('Please type a valid URL', { exact: true })).toBeVisible();
  });
});