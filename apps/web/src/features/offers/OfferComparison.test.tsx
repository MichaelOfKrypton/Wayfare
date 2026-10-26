import { formatZar, type Offer, type OffersResponse } from '@wayfare/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';
import { OfferComparison } from './OfferComparison';

beforeAll(() => {
  // jsdom lacks <dialog> methods.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

function offer(id: number, totalCents: number, overrides: Partial<Offer> = {}): Offer {
  return {
    id,
    provider: { slug: `p${id}`, name: `Provider ${id}`, kind: 'ota' },
    mealPlan: 'room_only',
    cancellationPolicy: 'non_refundable',
    freeCancellationHours: null,
    price: {
      nights: 2,
      weekendNights: 0,
      roomSubtotalCents: totalCents,
      feesCents: 0,
      feeLabel: null,
      taxCents: Math.round((totalCents * 15) / 115),
      taxRateBps: 1500,
      taxIncluded: true,
      totalCents,
      averageNightlyCents: totalCents / 2,
      currency: 'ZAR',
    },
    badges: [],
    dataStatus: 'simulated',
    lastCheckedAt: new Date().toISOString(),
    exampleUrl: null,
    ...overrides,
  };
}

const data: OffersResponse = {
  stay: { checkIn: '2026-11-01', checkOut: '2026-11-03', nights: 2, guests: 2 },
  summary: {
    eligibleCount: 2,
    cheapestOfferId: 1,
    recommendedOfferId: 2,
    recommendationReason: 'Free cancellation for R 100 more than the cheapest offer (within 10%).',
    priceSpreadCents: 10_000,
  },
  groups: [
    {
      roomType: { id: 10, name: 'Garden Room', maxGuests: 2, bedrooms: 1 },
      offers: [
        offer(1, 200_000, { badges: ['cheapest'] }),
        offer(2, 210_000, {
          badges: ['recommended'],
          cancellationPolicy: 'free',
          freeCancellationHours: 48,
        }),
      ],
    },
  ],
  unavailable: [{ roomTypeName: 'Family Suite', reason: 'booked_for_dates', minNights: null }],
};

describe('<OfferComparison>', () => {
  it('summarises cheapest and recommended offers with the reason', () => {
    render(<OfferComparison data={data} propertyName="Test House" />);
    expect(screen.getByText(/Free cancellation for R 100 more/)).toBeInTheDocument();
    expect(
      screen.getAllByText(formatZar(200_000).replaceAll(String.fromCharCode(160), ' ')).length,
    ).toBeGreaterThan(0);
  });

  it('flags material differences between cheapest and recommended', () => {
    render(<OfferComparison data={data} propertyName="Test House" />);
    expect(screen.getByText(/not identical/)).toHaveTextContent(
      'non-refundable vs free cancellation',
    );
  });

  it('labels every offer as simulated and shows badges as text', () => {
    render(<OfferComparison data={data} propertyName="Test House" />);
    const rows = screen.getAllByTestId('offer-row');
    expect(rows).toHaveLength(2);
    for (const row of rows)
      expect(within(row).getByText(/Simulated · generated/)).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Cheapest')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Recommended')).toBeInTheDocument();
  });

  it('explains unavailable rooms', () => {
    render(<OfferComparison data={data} propertyName="Test House" />);
    expect(screen.getByText(/Fully booked for your dates/)).toBeInTheDocument();
  });

  it('opens an honest explanation instead of a fake booking link', async () => {
    render(<OfferComparison data={data} propertyName="Test House" />);
    await userEvent.click(screen.getAllByRole('button', { name: 'View deal' })[0]!);
    expect(screen.getByRole('dialog', { name: 'This is a simulated offer' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /book/i })).toBeNull();
  });

  it('shows a clear empty state when nothing is eligible', () => {
    render(
      <OfferComparison
        data={{
          ...data,
          groups: [],
          summary: {
            ...data.summary,
            eligibleCount: 0,
            cheapestOfferId: null,
            recommendedOfferId: null,
          },
        }}
        propertyName="Test House"
      />,
    );
    expect(screen.getByText('No offers for these dates and guests')).toBeInTheDocument();
  });
});
