const { test, expect } = require('@playwright/test');

test.describe('image card form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/vanilla-js-web-app-example');
  });

  test('adds a submitted image to the list', async ({ page }) => {
    const title = 'Playwright test image';
    const imageUrl = 'https://example.com/playwright-test.png';
    const cards = page.locator('#card-list .card-title');
    const initialCount = await cards.count();

    await page.locator('#title').fill(title);
    await page.locator('#imageUrl').fill(imageUrl);
    await page.locator('#btnSubmit').click();

    await expect(cards).toHaveCount(initialCount + 1);
    await expect(cards.last()).toHaveText(title);
    await expect(page.locator('#card-list img').last()).toHaveAttribute('src', imageUrl);
  });

  test('shows validation feedback for an empty form', async ({ page }) => {
    const form = page.locator('form.needs-validation');

    await page.locator('#btnSubmit').click();

    await expect(form).toHaveClass(/was-validated/);
    expect(await page.locator('#title').evaluate((element) => element.validity.valid)).toBe(false);
    expect(await page.locator('#imageUrl').evaluate((element) => element.validity.valid)).toBe(false);
    await expect(page.locator('#titleFeedback')).toBeVisible();
    await expect(page.locator('#urlFeedback')).toBeVisible();
  });
});