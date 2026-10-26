import type { RatingSummary } from '@wayfare/shared';
import styles from './RatingPill.module.css';

function scoreWord(score: number): string {
  if (score >= 9) return 'Exceptional';
  if (score >= 8.5) return 'Excellent';
  if (score >= 8) return 'Very good';
  if (score >= 7) return 'Good';
  return 'Fair';
}

/** Synthetic score: always labelled as a demo score so it is never mistaken for real reviews. */
export function RatingPill({
  rating,
  compact = false,
}: {
  rating: RatingSummary | null;
  compact?: boolean;
}) {
  if (!rating) {
    return <span className={styles.unrated}>Not yet rated</span>;
  }
  const label = `${rating.label}: ${rating.score.toFixed(1)} out of 10 (${scoreWord(rating.score)}), from ${rating.count} synthetic ratings`;
  return (
    <span className={styles.wrap} title={label}>
      <span className={styles.score} aria-hidden="true">
        {rating.score.toFixed(1)}
      </span>
      <span className={styles.text} aria-hidden="true">
        <span className={styles.word}>{scoreWord(rating.score)}</span>
        {!compact && (
          <span className={styles.meta}>{rating.count.toLocaleString('en-ZA')} · demo score</span>
        )}
      </span>
      <span className="visually-hidden">{label}</span>
    </span>
  );
}
