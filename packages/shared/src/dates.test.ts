import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayOfWeek,
  diffDays,
  isValidDateString,
  todayInTimeZone,
  validateStayDates,
} from './dates';

describe('isValidDateString', () => {
  it.each(['2026-10-26', '2028-02-29'])('accepts %s', (v) =>
    expect(isValidDateString(v)).toBe(true),
  );
  it.each(['2026-02-30', '2027-02-29', '26-10-2026', '2026-1-5', '', '2026-10-26T00:00'])(
    'rejects %s',
    (v) => expect(isValidDateString(v)).toBe(false),
  );
});

describe('date arithmetic', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('diffs days', () => {
    expect(diffDays('2026-10-26', '2026-11-02')).toBe(7);
    expect(diffDays('2026-11-02', '2026-10-26')).toBe(-7);
  });
  it('returns PostgreSQL-style day of week', () => {
    expect(dayOfWeek('2026-10-26')).toBe(1); // Monday
    expect(dayOfWeek('2026-11-01')).toBe(0); // Sunday
  });
});

describe('todayInTimeZone', () => {
  it('uses SAST, which can differ from the UTC date', () => {
    // 23:30 UTC on 25 Oct is 01:30 SAST on 26 Oct.
    expect(todayInTimeZone(new Date('2026-10-25T23:30:00Z'))).toBe('2026-10-26');
    expect(todayInTimeZone(new Date('2026-10-25T21:59:00Z'))).toBe('2026-10-25');
  });
});

describe('validateStayDates', () => {
  const today = '2026-10-26';
  it('accepts tonight', () => {
    expect(validateStayDates('2026-10-26', '2026-10-27', today)).toEqual([]);
  });
  it('rejects past check-in', () => {
    expect(validateStayDates('2026-10-25', '2026-10-27', today)[0]?.path).toBe('checkIn');
  });
  it('rejects check-out on or before check-in', () => {
    expect(validateStayDates('2026-10-27', '2026-10-27', today)[0]?.message).toMatch(/after/);
  });
  it('rejects stays over 30 nights and check-ins over a year ahead', () => {
    expect(validateStayDates('2026-10-26', '2026-11-26', today)[0]?.message).toMatch(/30 nights/);
    expect(validateStayDates('2027-10-27', '2027-10-28', today)[0]?.message).toMatch(/365/);
  });
  it('rejects malformed dates', () => {
    expect(validateStayDates('nope', '2026-10-27', today)).toHaveLength(1);
  });
});
