import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Pagination, pageItems } from './Pagination';

describe('pageItems', () => {
  it('shows all pages when there are few', () => {
    expect(pageItems(2, 3)).toEqual([1, 2, 3]);
  });
  it('collapses distant pages into gaps', () => {
    expect(pageItems(5, 10)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10]);
    expect(pageItems(1, 10)).toEqual([1, 2, 'gap', 10]);
  });
});

describe('<Pagination>', () => {
  it('renders nothing for a single page', () => {
    const { container } = render(<Pagination page={1} totalPages={1} onChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('marks the current page and reports clicks', async () => {
    const onChange = vi.fn();
    render(<Pagination page={2} totalPages={5} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(screen.getByRole('button', { name: /Next/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Page 5' }));
    expect(onChange.mock.calls).toEqual([[3], [5]]);
  });

  it('disables Previous on the first page', () => {
    render(<Pagination page={1} totalPages={3} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled();
  });
});
