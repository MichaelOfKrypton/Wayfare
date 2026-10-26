import { Heart } from 'lucide-react';
import { useState } from 'react';
import { savedStore, useSaved } from '../lib/saved';
import styles from './SaveButton.module.css';

/** Heart toggle that saves a place to this browser. */
export function SaveButton({
  slug,
  name,
  variant = 'overlay',
}: {
  slug: string;
  name: string;
  /** `overlay` sits on a photo; `inline` is a labelled button. */
  variant?: 'overlay' | 'inline';
}) {
  const saved = useSaved().some((p) => p.slug === slug);
  const [justSaved, setJustSaved] = useState(false);

  return (
    <button
      type="button"
      className={`${styles.button} ${styles[variant]} ${saved ? styles.saved : ''} ${justSaved ? styles.pop : ''}`}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name} from saved places` : `Save ${name}`}
      title={saved ? 'Saved. Click to remove.' : 'Save to compare later'}
      onClick={(event) => {
        // The card behind is a link; keep this click to the button.
        event.preventDefault();
        event.stopPropagation();
        setJustSaved(savedStore.toggle({ slug, name }));
      }}
      onAnimationEnd={() => setJustSaved(false)}
    >
      <Heart size={variant === 'overlay' ? 18 : 16} aria-hidden="true" />
      {variant === 'inline' && <span>{saved ? 'Saved' : 'Save'}</span>}
    </button>
  );
}
