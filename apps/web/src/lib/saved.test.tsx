import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveButton } from '../components/SaveButton';
import { MAX_SAVED, SAVED_KEY, savedStore } from './saved';

beforeEach(() => {
  localStorage.clear();
  savedStore.resetCache();
});

describe('savedStore', () => {
  it('saves newest first, toggles off, and persists to localStorage', () => {
    expect(savedStore.toggle({ slug: 'a-place', name: 'A' })).toBe(true);
    expect(savedStore.toggle({ slug: 'b-place', name: 'B' })).toBe(true);
    expect(savedStore.list().map((p) => p.slug)).toEqual(['b-place', 'a-place']);
    expect(JSON.parse(localStorage.getItem(SAVED_KEY)!)).toHaveLength(2);
    expect(savedStore.toggle({ slug: 'a-place', name: 'A' })).toBe(false);
    expect(savedStore.isSaved('a-place')).toBe(false);
  });

  it(`keeps at most ${MAX_SAVED} places`, () => {
    for (let i = 0; i < MAX_SAVED + 5; i++) savedStore.toggle({ slug: `p-${i}`, name: `P${i}` });
    expect(savedStore.list()).toHaveLength(MAX_SAVED);
    expect(savedStore.list()[0]!.slug).toBe(`p-${MAX_SAVED + 4}`);
  });

  it('ignores corrupt or hostile stored data', () => {
    localStorage.setItem(
      SAVED_KEY,
      JSON.stringify([
        { slug: 'good-one', name: 'Good', savedAt: '2026-01-01' },
        { slug: '../../etc', name: 'Bad', savedAt: 'x' },
        { slug: 42 },
        'nonsense',
      ]),
    );
    expect(savedStore.list().map((p) => p.slug)).toEqual(['good-one']);
    localStorage.setItem(SAVED_KEY, '{not json');
    savedStore.resetCache();
    expect(savedStore.list()).toEqual([]);
  });

  it('keeps working in memory when storage is unavailable', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(savedStore.toggle({ slug: 'mem-only', name: 'M' })).toBe(true);
    expect(savedStore.isSaved('mem-only')).toBe(true);
    spy.mockRestore();
  });
});

describe('<SaveButton>', () => {
  it('toggles the saved state and announces it', async () => {
    render(<SaveButton slug="the-vineyard" name="The Vineyard" variant="inline" />);
    const button = screen.getByRole('button', { name: 'Save The Vineyard' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(button);
    expect(
      screen.getByRole('button', { name: 'Remove The Vineyard from saved places' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(savedStore.isSaved('the-vineyard')).toBe(true);
  });

  it('updates when another tab changes the saved list', () => {
    render(<SaveButton slug="tab-sync" name="Tab Sync" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    act(() => {
      localStorage.setItem(
        SAVED_KEY,
        JSON.stringify([{ slug: 'tab-sync', name: 'Tab Sync', savedAt: '2026-01-01' }]),
      );
      window.dispatchEvent(new StorageEvent('storage', { key: SAVED_KEY }));
    });
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });
});
