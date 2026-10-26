import type { z } from 'zod';
import { ValidationError } from './errors';

/** Parses untrusted input with a Zod schema, converting failures into a 400 ValidationError. */
export function parseOrThrow<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input ?? {});
  if (result.success) return result.data;
  const issues = result.error.issues.map((issue) => {
    if (issue.code === 'unrecognized_keys') {
      return {
        path: issue.keys.join(', '),
        message: `Unknown parameter${issue.keys.length > 1 ? 's' : ''}: ${issue.keys.join(', ')}.`,
      };
    }
    const path = issue.path.join('.') || '(root)';
    // Arrays arrive when a parameter is repeated (?a=1&a=2); explain that clearly.
    const message =
      issue.code === 'invalid_type' && issue.expected === 'string'
        ? 'Must be provided once, as a single value.'
        : issue.message;
    return { path, message: path === '(root)' ? message : `${path}: ${message}` };
  });
  throw new ValidationError(issues);
}
