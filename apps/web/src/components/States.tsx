import { AlertTriangle, SearchX } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';
import styles from './States.module.css';

export function EmptyState({
  title,
  children,
  actions,
  icon = <SearchX size={28} aria-hidden="true" />,
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className={styles.state} role="status">
      <div className={styles.icon}>{icon}</div>
      <h2 className={styles.title}>{title}</h2>
      {children && <div className={styles.body}>{children}</div>}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className={`${styles.state} ${styles.error}`} role="alert">
      <div className={styles.icon}>
        <AlertTriangle size={28} aria-hidden="true" />
      </div>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.body}>{message}</p>
      {onRetry && (
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

export function Skeleton({
  width = '100%',
  height = 16,
  radius = 4,
}: {
  width?: string | number;
  height?: number;
  radius?: number;
}) {
  return (
    <span
      className={styles.skeleton}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}
