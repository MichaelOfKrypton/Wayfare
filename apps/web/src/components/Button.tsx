import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'accent';
type Size = 'sm' | 'md' | 'lg';

interface StyleProps {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: ReactNode;
}

const cx = (variant: Variant, size: Size, block?: boolean, extra?: string) =>
  [styles.button, styles[variant], styles[size], block ? styles.block : '', extra ?? '']
    .filter(Boolean)
    .join(' ');

export function Button({
  variant = 'primary',
  size = 'md',
  block,
  icon,
  className,
  children,
  type = 'button',
  loading,
  ...rest
}: StyleProps & ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      type={type}
      className={cx(variant, size, block, className)}
      aria-busy={loading || undefined}
      {...rest}
      disabled={rest.disabled || loading}
    >
      {icon && <span className={styles.icon}>{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  block,
  icon,
  className,
  children,
  ...rest
}: StyleProps & LinkProps) {
  return (
    <Link className={cx(variant, size, block, className)} {...rest}>
      {icon && <span className={styles.icon}>{icon}</span>}
      <span>{children}</span>
    </Link>
  );
}
