import { describe, expect, it } from 'vitest';
import { escapeLike, SqlParams } from './sql';

describe('escapeLike', () => {
  it('escapes LIKE wildcards and the escape character itself', () => {
    expect(escapeLike('100%')).toBe('100\\%');
    expect(escapeLike('B_B')).toBe('B\\_B');
    expect(escapeLike('a\\b')).toBe('a\\\\b');
    expect(escapeLike('plain text')).toBe('plain text');
  });
});

describe('SqlParams', () => {
  it('numbers placeholders in order and never inlines values', () => {
    const params = new SqlParams();
    const a = params.add("'; DROP TABLE properties; --");
    const b = params.add(42);
    expect([a, b]).toEqual(['$1', '$2']);
    expect(params.values).toEqual(["'; DROP TABLE properties; --", 42]);
  });

  it('clones independently so two queries can share a prefix', () => {
    const base = new SqlParams();
    base.add('x');
    const copy = base.clone();
    copy.add('y');
    expect(base.values).toEqual(['x']);
    expect(copy.add('z')).toBe('$3');
  });
});
