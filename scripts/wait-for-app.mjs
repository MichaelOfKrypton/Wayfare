/**
 * Waits until both the API and the web dev server answer, so the browser opens
 * on a working app instead of a connection error.
 */
const TARGETS = [
  { name: 'API', url: 'http://localhost:4000/api/health/ready' },
  { name: 'web app', url: 'http://localhost:5173/' },
];
const TIMEOUT_MS = 120_000;
const started = Date.now();

for (const target of TARGETS) {
  for (;;) {
    try {
      const res = await fetch(target.url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        console.info(`[wait] ${target.name} is up`);
        break;
      }
    } catch {
      // not up yet
    }
    if (Date.now() - started > TIMEOUT_MS) {
      console.error(
        `[wait] ${target.name} did not start within 2 minutes. Check the "Wayfare: dev servers" terminal.`,
      );
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}
console.info('[wait] Wayfare is running at http://localhost:5173');
