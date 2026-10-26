import { expect, searchUrl, test } from './fixtures';

test.describe('mobile layout', () => {
  test('results, filter drawer and map toggle are usable at phone width', async ({ page }) => {
    await page.goto(searchUrl({ destination: 'durban' }));
    await expect(page.getByTestId('property-card').first()).toBeVisible();

    // No horizontal page scroll.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    await page.getByRole('button', { name: /^Filters/ }).click();
    const drawer = page.getByRole('dialog', { name: 'Filters' });
    await expect(drawer).toBeVisible();
    await drawer.getByLabel('Free cancellation only').check();
    await expect(page).toHaveURL(/freeCancellation=true/);
    await drawer.getByRole('button', { name: /^Show/ }).click();
    await expect(drawer).toBeHidden();

    await page.getByRole('button', { name: 'Map', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Map of matching stays' })).toBeVisible();
    await page.getByRole('button', { name: 'Show list' }).click();
    await expect(page.getByTestId('property-card').first()).toBeVisible();
  });

  test('property page has no horizontal overflow and stacks offers', async ({ page }) => {
    await page.goto('/properties/fynbos-ridge-guesthouse-knysna');
    await expect(page.getByTestId('offer-row').first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
