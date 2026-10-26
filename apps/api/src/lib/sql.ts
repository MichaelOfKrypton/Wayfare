/**
 * Collects bound parameters while a query is assembled. Values can only ever be
 * referenced as `$n` placeholders, so user input never becomes SQL text.
 * (Identifiers such as ORDER BY expressions come from whitelisted constants.)
 */
export class SqlParams {
  readonly values: unknown[] = [];

  add(value: unknown): string {
    this.values.push(value);
    return `$${this.values.length}`;
  }

  clone(): SqlParams {
    const copy = new SqlParams();
    copy.values.push(...this.values);
    return copy;
  }
}

/** Escapes LIKE/ILIKE wildcards so user text is matched literally. */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
