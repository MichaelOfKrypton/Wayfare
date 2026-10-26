import type { ReactNode } from 'react';
import styles from './Badge.module.css';

export type BadgeTone = 'neutral' | 'accent' | 'primary' | 'success' | 'warning' | 'danger';

/** Always text (+ optional icon) — status is never conveyed by colour alone. */
export function Badge({
  tone = 'neutral',
  icon,
  children,
  title,
}: {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`} title={title}>
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}
