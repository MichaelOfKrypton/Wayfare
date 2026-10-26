import { defineConfig, devices } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';

/**
 * E2E tests run their own API (port 4100) and web server (port 5174) against the
 * test database, which global-setup resets and seeds. Dev servers are untouched.
 */
function rootEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  if (!existsSync('.env')) return undefined;
  const line = readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${key}=`));
  return line?.slice(key.length + 1);
}

const TEST_DATABASE_URL =
  rootEnv('TEST_DATABASE_URL') ?? 'postgres://wayfare:wayfare_dev@localhost:54329/wayfare_test';
const API_PORT = 4100;
const WEB_PORT = 5174;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      testIgnore: /mobile/,
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile/ },
  ],
  webServer: [
    {
      command: 'npm run start -w @wayfare/api',
      url: `http://localhost:${API_PORT}/api/health/ready`,
      env: { DATABASE_URL: TEST_DATABASE_URL, API_PORT: String(API_PORT), NODE_ENV: 'test' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npm run dev -w @wayfare/web -- --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      env: { VITE_API_PROXY_TARGET: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});

export { TEST_DATABASE_URL };
