import { expect, rands, searchUrl, test } from './fixtures';

test.describe('price calendar', () => {
  test('choosing the cheapest date sets the stay and re-prices the offers', async ({ page }) => {
    await page.goto('/properties/fynbos-ridge-guesthouse-knysna');
    await expect(page.getByRole('heading', { name: 'Find the cheapest dates' })).toBeVisible();

    const cheapest = page.getByRole('button', { name: /cheapest this month/ }).first();
    await expect(cheapest).toBeVisible();
    const name = (await cheapest.textContent())!;
    const total = rands(name.match(/(R[\s\u00a0][\d\s\u00a0]+) total/)![1]!);
    await cheapest.click();

    // The URL now holds the chosen stay, and the cheapest offer matches the calendar.
    await expect(page).toHaveURL(/checkIn=\d{4}-\d{2}-\d{2}/);
    await expect(cheapest).toHaveAttribute('aria-pressed', 'true');
    const cheapestRow = page.getByTestId('offer-row').filter({ hasText: 'Cheapest' });
    await expect(cheapestRow).toHaveCount(1);
    expect(
      rands((await cheapestRow.locator('td').nth(3).locator('span').first().textContent())!),
    ).toBe(total);
  });

  test('changing the stay length re-prices the month', async ({ page }) => {
    await page.goto('/properties/fynbos-ridge-guesthouse-knysna');
    const nights = page.getByLabel('Stay length');
    await nights.selectOption('3');
    await expect(page.getByText(/for 3 nights from each check-in date/)).toBeVisible();
    await page.getByRole('button', { name: 'Next month' }).click();
    await expect(page.getByRole('button', { name: /per night/ }).first()).toBeVisible();
  });
});

test.describe('saved places', () => {
  test('save from results, compare side by side, then remove', async ({ page }) => {
    await page.goto(searchUrl({ destination: 'knysna' }));
    const cards = page.getByTestId('property-card');
    await expect(cards.first()).toBeVisible();
    const names = [
      (await cards.nth(0).getByRole('heading').textContent())!.trim(),
      (await cards.nth(1).getByRole('heading').textContent())!.trim(),
    ];
    for (const [i, name] of names.entries()) {
      await cards
        .nth(i)
        .getByRole('button', { name: `Save ${name}` })
        .click();
      await expect(
        cards.nth(i).getByRole('button', { name: `Remove ${name} from saved places` }),
      ).toHaveAttribute('aria-pressed', 'true');
    }

    const nav = page.getByRole('link', { name: /Saved/ });
    await expect(nav).toContainText('2');
    await nav.click();

    await expect(page.getByRole('heading', { name: 'Saved places', level: 1 })).toBeVisible();
    const table = page.getByRole('table');
    for (const name of names) {
      await expect(table.getByRole('link', { name })).toBeVisible();
    }
    await expect(table.getByText('Price for your stay')).toBeVisible();

    // Saved places survive a reload (localStorage).
    await page.reload();
    await expect(page.getByRole('table').getByRole('link', { name: names[0]! })).toBeVisible();

    await page.getByRole('button', { name: `Remove ${names[0]} from saved places` }).click();
    await expect(page.getByRole('table').getByRole('link', { name: names[0]! })).toHaveCount(0);
    await expect(nav).toContainText('1');
  });

  test('shows a helpful empty state', async ({ page }) => {
    await page.goto('/saved');
    await expect(page.getByText('Nothing saved yet')).toBeVisible();
    await expect(page.getByRole('link', { name: /Browse stays/ })).toBeVisible();
  });
});
