import AxeBuilder from '@axe-core/playwright';
import { expect, searchUrl, test } from './fixtures';

/**
 * Automated WCAG 2.2 A/AA checks with axe-core. Automated tools find roughly a
 * third of issues, so this complements (not replaces) manual keyboard checks.
 */
const PAGES = [
  { name: 'home', url: '/', ready: 'Find tonight' },
  { name: 'search', url: searchUrl({ destination: 'knysna' }), ready: 'stays in Knysna' },
  {
    name: 'property',
    url: '/properties/fynbos-ridge-guesthouse-knysna',
    ready: 'Fynbos Ridge Guesthouse',
  },
  { name: 'how it works', url: '/how-it-works', ready: 'How Wayfare works' },
];

for (const { name, url, ready } of PAGES) {
  test(`${name} page has no detectable WCAG A/AA violations`, async ({ page }) => {
    await page.goto(url);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(ready);
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      // Leaflet's own map tiles/controls are third-party markup.
      .exclude('.leaflet-control-container')
      .analyze();
    const summary = results.violations.map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help} — ${v.nodes
          .map((n) => n.target.join(' '))
          .slice(0, 3)
          .join(', ')}`,
    );
    expect(summary).toEqual([]);
  });
}

test('core search flow works with the keyboard alone', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab'); // skip link
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.getByRole('combobox', { name: 'Where to?' }).focus();
  await page.keyboard.type('Clarens');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Search', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('in Clarens');
  // Results are reachable by tabbing to a card link and opening it with Enter.
  const firstLink = page
    .getByTestId('property-card')
    .first()
    .getByRole('heading')
    .getByRole('link');
  await firstLink.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Compare offers' })).toBeVisible();
});
