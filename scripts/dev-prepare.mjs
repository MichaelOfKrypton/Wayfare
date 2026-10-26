/**
 * Prepares everything `npm run dev` needs, so one F5 (or `npm run dev:prepare`)
 * works from any state:
 *   1. creates .env from .env.example if missing
 *   2. starts Docker Desktop if the Docker engine isn't running (Windows/macOS)
 *   3. starts the PostGIS container and waits until it's healthy
 *   4. applies migrations, and seeds the demo data if the database is empty
 *   5. frees ports 4000/5173 if an older Wayfare dev server is still holding them
 */
import { execSync, spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { platform } from 'node:os';

const ROOT = new URL('..', import.meta.url);
const run = (cmd, opts = {}) => execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts });
const quiet = (cmd) => spawnSync(cmd, { cwd: ROOT, shell: true, encoding: 'utf8' });
const log = (msg) => console.info(`[prepare] ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fail(msg) {
  console.error(`\n[prepare] ${msg}\n`);
  process.exit(1);
}

// 1. Environment file
if (!existsSync(new URL('.env', ROOT))) {
  copyFileSync(new URL('.env.example', ROOT), new URL('.env', ROOT));
  log('created .env from .env.example');
}

// 2. Docker engine
const dockerUp = () => quiet('docker info --format "{{.ServerVersion}}"').status === 0;
if (quiet('docker --version').status !== 0) {
  fail('Docker is not installed. Install Docker Desktop, or see "Without Docker" in the README.');
}
if (!dockerUp()) {
  const os = platform();
  if (os === 'win32') {
    const exe = 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe';
    if (!existsSync(exe))
      fail('Docker Desktop is not running. Please start it and press F5 again.');
    log('starting Docker Desktop…');
    spawn(exe, [], { detached: true, stdio: 'ignore' }).unref();
  } else if (os === 'darwin') {
    log('starting Docker Desktop…');
    quiet('open -a Docker');
  } else {
    fail(
      'The Docker engine is not running. Start it (e.g. `sudo systemctl start docker`) and try again.',
    );
  }
  for (let i = 0; i < 90 && !dockerUp(); i += 1) await sleep(2000);
  if (!dockerUp())
    fail('Docker did not become ready within 3 minutes. Start Docker Desktop manually and retry.');
  log('Docker is ready');
}

// 3. Database container
log('starting the database container…');
run('docker compose up -d --wait');

// 4. Schema and data
run('npm run db:migrate --silent');
const { default: pg } = await import('pg');
const { parseEnv } = await import('node:util');
const { readFileSync } = await import('node:fs');
const env = parseEnv(readFileSync(new URL('.env', ROOT), 'utf8'));
const client = new pg.Client({ connectionString: process.env.DATABASE_URL ?? env.DATABASE_URL });
await client.connect();
const { rows } = await client.query('SELECT count(*)::int AS n FROM properties');
await client.end();
if (rows[0].n === 0) {
  log('database is empty, seeding the demo data…');
  run('npm run db:seed --silent');
} else {
  log(`database ready (${rows[0].n} properties)`);
}

// 5. Ports held by a previous Wayfare dev session
async function isWayfare(port) {
  try {
    const url = port === 4000 ? 'http://localhost:4000/api/health' : `http://localhost:${port}/`;
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
    const body = await res.text();
    return port === 4000 ? body.includes('"status":"ok"') : body.includes('Wayfare');
  } catch {
    return false;
  }
}

function pidsOnPort(port) {
  if (platform() === 'win32') {
    const out = quiet('netstat -ano').stdout ?? '';
    return [
      ...new Set(
        out
          .split(/\r?\n/)
          .filter((l) => /LISTENING/.test(l) && new RegExp(`:${port}\\s`).test(l))
          .map((l) => l.trim().split(/\s+/).pop())
          .filter((pid) => pid && pid !== '0'),
      ),
    ];
  }
  return (quiet(`lsof -ti tcp:${port} -sTCP:LISTEN`).stdout ?? '').split(/\s+/).filter(Boolean);
}

for (const port of [4000, 5173]) {
  const pids = pidsOnPort(port);
  if (pids.length === 0) continue;
  if (!(await isWayfare(port))) {
    fail(
      `Port ${port} is used by another program (PID ${pids.join(', ')}). Close it and press F5 again.`,
    );
  }
  log(`stopping an earlier Wayfare server on port ${port}`);
  for (const pid of pids) {
    quiet(platform() === 'win32' ? `taskkill /PID ${pid} /T /F` : `kill ${pid}`);
  }
}

log('all set, starting the app');
