import { formatZar } from '@wayfare/shared';
import { describe, expect, it } from 'vitest';
import { pickRecommendation, type RankableOffer } from './recommendation';

const offer = (
  id: number,
  totalCents: number,
  cancellationPolicy: RankableOffer['cancellationPolicy'],
): RankableOffer => ({ id, totalCents, cancellationPolicy });

describe('pickRecommendation', () => {
  it('returns null when there are no offers', () => {
    expect(pickRecommendation([])).toBeNull();
  });

  it('recommends a free-cancellation offer within 10% of the cheapest', () => {
    const rec = pickRecommendation([offer(1, 100_000, 'non_refundable'), offer(2, 109_000, 'free')]);
    expect(rec).toMatchObject({ cheapestId: 1, recommendedId: 2 });
    expect(rec?.reason).toContain(`Free cancellation for ${formatZar(9_000)} more`);
  });

  it('treats exactly 10% as within tolerance', () => {
    const rec = pickRecommendation([offer(1, 100_000, 'partial'), offer(2, 110_000, 'free')]);
    expect(rec?.recommendedId).toBe(2);
  });

  it('keeps the cheapest when free cancellation costs more than 10% extra', () => {
    const rec = pickRecommendation([offer(1, 100_000, 'non_refundable'), offer(2, 120_000, 'free')]);
    expect(rec).toMatchObject({ cheapestId: 1, recommendedId: 1 });
    expect(rec?.reason).toMatch(/over 10% extra/);
  });

  it('explains when the cheapest offer is also free to cancel', () => {
    const rec = pickRecommendation([offer(3, 90_000, 'free'), offer(1, 100_000, 'non_refundable')]);
    expect(rec).toMatchObject({ cheapestId: 3, recommendedId: 3 });
    expect(rec?.reason).toMatch(/includes free cancellation/);
  });

  it('explains when no free-cancellation offer exists', () => {
    expect(pickRecommendation([offer(1, 100_000, 'partial')])?.reason).toMatch(
      /No offer with free cancellation/,
    );
  });

  it('breaks price ties by id for stable output', () => {
    const rec = pickRecommendation([offer(9, 100_000, 'partial'), offer(4, 100_000, 'partial')]);
    expect(rec?.cheapestId).toBe(4);
  });
});
