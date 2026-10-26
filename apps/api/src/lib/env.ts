import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

/** Repository root (apps/api/src/lib → ../../../..). */
export const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

/**
 * Loads the root `.env` without overriding variables that are already set,
 * so the shell (or the test runner) always wins.
 */
export function loadRootEnv(): void {
  const file = `${REPO_ROOT}.env`;
  if (!existsSync(file)) return;
  const parsed = parseEnv(readFileSync(file, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined && value !== undefined) process.env[key] = value;
  }
}
