import { execSync } from 'node:child_process';
import { TEST_DATABASE_URL } from '../playwright.config';

/** Reset and seed the test database with today's date as the reference. */
export default function globalSetup(): void {
  if (!/_test$/.test(new URL(TEST_DATABASE_URL).pathname)) {
    throw new Error('Refusing to reset a database whose name does not end in "_test".');
  }
  execSync('npm run db:reset -w @wayfare/api', {
    stdio: 'inherit',
    // Always the fictional dataset: the tests assert on its fixed properties.
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
      SEED_REFERENCE_DATE: '',
      SEED_DATASET: 'synthetic',
    },
  });
}
