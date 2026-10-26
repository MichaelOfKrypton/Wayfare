import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './Pagination.module.css';

/** Compact page list: first, last, current ±1, with ellipses. */
export function pageItems(page: number, totalPages: number): (number | 'gap')[] {
  const pages = new Set(
    [1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages),
  );
  const sorted = [...pages].sort((a, b) => a - b);
  const items: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) items.push('gap');
    items.push(p);
  });
  return items;
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className={styles.nav} aria-label="Results pages">
      <button
        type="button"
        className={styles.step}
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
      >
        <ChevronLeft size={16} aria-hidden="true" /> Previous
      </button>
      <ul className={styles.pages}>
        {pageItems(page, totalPages).map((item, i) =>
          item === 'gap' ? (
            <li key={`gap-${i}`} className={styles.gap} aria-hidden="true">
              …
            </li>
          ) : (
            <li key={item}>
              <button
                type="button"
                className={styles.page}
                aria-current={item === page ? 'page' : undefined}
                aria-label={`Page ${item}`}
                onClick={() => onChange(item)}
              >
                {item}
              </button>
            </li>
          ),
        )}
      </ul>
      <button
        type="button"
        className={styles.step}
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
      >
        Next <ChevronRight size={16} aria-hidden="true" />
      </button>
    </nav>
  );
}
