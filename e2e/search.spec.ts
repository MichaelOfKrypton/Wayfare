import { expect, rands, searchUrl, test } from './fixtures';

test.describe('home and search', () => {
  test('homepage renders with demo disclosure and featured destinations', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Find tonight');
    await expect(page.getByRole('note')).toContainText('simulated');
    await expect(page.getByRole('link', { name: /Cape Town/ }).first()).toBeVisible();
  });

  test('searches via the destination autocomplete using the keyboard', async ({ page }) => {
    await page.goto('/');
    const combobox = page.getByRole('combobox', { name: 'Where to?' });
    await combobox.fill('Knys');
    await expect(page.getByRole('option', { name: /Knysna/ }).first()).toBeVisible();
    await combobox.press('ArrowDown'); // "Use my current location"
    await combobox.press('ArrowDown'); // first destination
    await combobox.press('Enter');
    await expect(combobox).toHaveValue('Knysna');
    await page.getByRole('button', { name: 'Search', exact: true }).click();

    await expect(page).toHaveURL(/destination=knysna/);
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toContainText(/\d+ stays? in Knysna/);
    const count = Number((await heading.textContent())!.match(/(\d+)/)![1]);
    await expect(page.getByTestId('property-card')).toHaveCount(Math.min(count, 20));
  });

  test('explains when a typed destination is unknown', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('combobox', { name: 'Where to?' }).fill('Atlantis');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.getByText(/couldn't find "Atlantis"/)).toBeVisible();
    await expect(page).toHaveURL('/');
  });
});

test.describe('filters and sorting', () => {
  test('free cancellation filter narrows results and updates the URL', async ({ page }) => {
    await page.goto(searchUrl({ destination: 'cape-town' }));
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toContainText('in Cape Town');
    const before = Number((await heading.textContent())!.match(/(\d+)/)![1]);

    await page.getByLabel('Free cancellation only').check();
    await expect(page).toHaveURL(/freeCancellation=true/);
    await expect(heading).not.toContainText(`${before} stays`);
    const cards = page.getByTestId('property-card');
    for (const card of await cards.all()) {
      await expect(card.getByText('Free cancellation')).toBeVisible();
    }
  });

  test('type and amenity filters combine', async ({ page }) => {
    await page.goto(searchUrl({ destination: 'cape-town' }));
    // The type checkbox, not a heart button whose place name contains "Apartment".
    await page.getByRole('checkbox', { name: /^Apartment\b/ }).check();
    await page.getByRole('button', { name: 'Wi-Fi', exact: true }).click();
    await expect(page).toHaveURL(/types=apartment/);
    await expect(page).toHaveURL(/amenities=wifi/);
    const cards = page.getByTestId('property-card');
    await expect(cards.first()).toBeVisible();
    for (const card of await cards.all()) {
      await expect(card.getByText('Apartment', { exact: true })).toBeVisible();
    }
  });

  test('sorting by price orders cards from low to high', async ({ page }) => {
    await page.goto(searchUrl({ destination: 'cape-town' }));
    const response = page.waitForResponse(
      (r) => r.url().includes('/api/search') && r.url().includes('sort=price_asc'),
    );
    await page.getByRole('combobox', { name: 'Sort by' }).selectOption('price_asc');
    await response;
    await expect(page.getByText('Updating…')).toHaveCount(0);
    const nightly = (
      await page
        .getByTestId('property-card')
        .locator('p', { hasText: 'avg / night' })
        .locator('.tabular')
        .allTextContents()
    ).map(rands);
    expect(nightly.length).toBeGreaterThan(2);
    expect(nightly).toEqual([...nightly].sort((a, b) => a - b));
  });

  test('an impossible budget shows a helpful empty state', async ({ page }) => {
    await page.goto(searchUrl({ destination: 'clarens', maxPrice: '1' }));
    await expect(page.getByRole('heading', { name: 'No stays match this search' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.getByTestId('property-card').first()).toBeVisible();
  });

  test('stale links with past dates are corrected, not broken', async ({ page }) => {
    await page.goto('/search?destination=durban&checkIn=2020-01-01&checkOut=2020-01-02&guests=2');
    await expect(page.getByText(/cannot be in the past/)).toBeVisible();
    await expect(page.getByTestId('property-card').first()).toBeVisible();
  });
});

test.describe('map and list', () => {
  test('selecting a map marker highlights its card, and hovering a card highlights its marker', async ({
    page,
  }) => {
    await page.goto(searchUrl({ destination: 'knysna' }));
    await expect(page.getByTestId('property-card').first()).toBeVisible();
    // Tiles are blocked in tests, so the offline notice must appear while markers still work.
    await expect(page.getByText(/Map tiles are unavailable/)).toBeVisible();

    const marker = page.locator('.leaflet-marker-icon.price-marker[role=button]').first();
    await expect(marker).toBeVisible();
    const label = (await marker.getAttribute('aria-label'))!;
    const name = label.split(',')[0]!;
    await marker.click();
    const card = page
      .getByTestId('property-card')
      .filter({ has: page.getByRole('heading', { name }) });
    await expect(card).toHaveAttribute('aria-current', 'true');

    const otherCard = page
      .getByTestId('property-card')
      .filter({ hasNot: page.getByRole('heading', { name }) })
      .first();
    const otherName = (await otherCard.getByRole('heading').textContent())!.trim();
    await otherCard.hover();
    const otherMarker = page.locator(`.leaflet-marker-icon[aria-label^="${otherName},"]`);
    if (await otherMarker.count()) {
      await expect(otherMarker).toHaveClass(/price-marker--highlighted/);
    }
  });
});

test.describe('property and offers', () => {
  test('opens a property from results and compares simulated offers', async ({ page }) => {
    await page.goto(searchUrl({ destination: 'hermanus' }));
    const firstCard = page.getByTestId('property-card').first();
    const name = (await firstCard.getByRole('heading').textContent())!.trim();
    const cardTotal = rands(
      (await firstCard
        .locator('p', { hasText: /total$/ })
        .locator('.tabular')
        .textContent()) ?? '',
    );
    await firstCard.getByRole('link', { name }).click();

    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Compare offers' })).toBeVisible();
    const rows = page.getByTestId('offer-row');
    await expect(rows.first()).toBeVisible();
    await expect(rows.first()).toContainText('Simulated');
    // The cheapest offer on the property page equals the price shown on the card.
    const cheapestRow = rows.filter({ hasText: 'Cheapest' });
    await expect(cheapestRow).toHaveCount(1);
    expect(
      rands((await cheapestRow.locator('td').nth(3).locator('span').first().textContent())!),
    ).toBe(cardTotal);

    await rows.first().getByRole('button', { name: 'View deal' }).click();
    const dialog = page.getByRole('dialog', { name: 'This is a simulated offer' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('changing dates on the property page re-prices offers', async ({ page }) => {
    await page.goto('/properties/fynbos-ridge-guesthouse-knysna');
    await expect(page.getByTestId('offer-row').first()).toBeVisible();
    await page.getByLabel('Guests', { exact: true }).selectOption('16');
    await page.getByRole('button', { name: /Update/ }).click();
    await expect(page).toHaveURL(/guests=16/);
    await expect(page.getByText('No offers for these dates and guests')).toBeVisible();
    await expect(page.getByText(/Too small for your group/).first()).toBeVisible();
  });

  test('unknown property shows a not-found state', async ({ page }) => {
    await page.goto('/properties/does-not-exist');
    await expect(page.getByRole('heading', { name: /couldn’t find that property/ })).toBeVisible();
  });
});
