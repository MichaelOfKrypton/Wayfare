import { todayInTimeZone } from '@wayfare/shared';

/** Injectable time source so date rules ("check-in cannot be in the past") are testable. */
export interface Clock {
  now(): Date;
  /** Today's calendar date in South Africa (YYYY-MM-DD). */
  today(): string;
}

export const systemClock: Clock = {
  now: () => new Date(),
  today: () => todayInTimeZone(new Date()),
};

export function fixedClock(isoInstant: string): Clock {
  const instant = new Date(isoInstant);
  return { now: () => instant, today: () => todayInTimeZone(instant) };
}
