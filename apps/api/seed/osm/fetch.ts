/**
 * Downloads real accommodation places from OpenStreetMap (Overpass API) and
 * freely licensed photos from Wikimedia Commons, and writes the committed
 * snapshot `seed/data/osm-snapshot.json`. Run rarely: `npm run data:fetch-osm`.
 *
 * Usage policy notes:
 * - Overpass: a handful of queries per run, identified with a User-Agent, with
 *   exponential backoff and mirror fallback when a server is busy.
 * - Wikimedia APIs: batched requests (50 titles each) with a descriptive User-Agent.
 * - Only free licences (CC0, public domain, CC BY, CC BY-SA) are kept, with credit.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { haversineKm, isWithinSouthAfrica } from '@wayfare/shared';
import { DESTINATIONS } from '../data/destinations';
import { commonsThumbUrl } from './normalize';
import { DESTINATION_ARTICLES, EXTRA_DESTINATIONS, KEPT_TAGS, OSM_TOURISM_VALUES } from './sources';
import { SNAPSHOT_PATH, type OsmPlace, type OsmSnapshot, type Photo } from './snapshot';

const USER_AGENT =
  'WayfarePortfolio/0.2 (+https://github.com/MichaelOfKrypton/Wayfare; one-off seed snapshot)';
const OVERPASS_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const THUMB_WIDTH = 960; // a standard Wikimedia thumbnail step

const log = (msg: string) => console.info(`[osm] ${msg}`);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(
  urls: string[],
  init: RequestInit,
  label: string,
  attempts = 8,
): Promise<unknown> {
  let delay = 5_000;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const url = urls[attempt % urls.length]!;
    try {
      const res = await fetch(url, {
        ...init,
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...init.headers },
        signal: AbortSignal.timeout(180_000),
      });
      const text = await res.text();
      if (res.ok && text.trimStart().startsWith('{')) return JSON.parse(text);
      log(`${label}: ${new URL(url).host} answered ${res.status}, retrying in ${delay / 1000}s`);
    } catch (error) {
      log(
        `${label}: ${new URL(url).host} failed (${(error as Error).message}), retrying in ${delay / 1000}s`,
      );
    }
    await sleep(delay);
    delay = Math.min(delay * 2, 120_000);
  }
  throw new Error(`${label}: giving up after ${attempts} attempts`);
}

// ---------------------------------------------------------------------------
// OpenStreetMap
// ---------------------------------------------------------------------------
interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/**
 * Finished queries are kept in a local cache folder, so a run interrupted by a
 * busy server resumes where it stopped instead of downloading everything again.
 */
const CACHE_DIR = join(tmpdir(), 'wayfare-osm-cache');

async function cachedOverpass(
  query: string,
  label: string,
): Promise<{ elements: OverpassElement[] }> {
  const file = join(CACHE_DIR, `${createHash('sha1').update(query).digest('hex')}.json`);
  if (existsSync(file))
    return JSON.parse(readFileSync(file, 'utf8')) as { elements: OverpassElement[] };
  const data = (await fetchWithRetry(
    OVERPASS_SERVERS,
    {
      method: 'POST',
      body: new URLSearchParams({ data: query }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
    label,
  )) as { elements: OverpassElement[] };
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(file, JSON.stringify(data));
  return data;
}

async function fetchPlaces(): Promise<OsmPlace[]> {
  // Suburbs and landmarks lie inside their parent's circle, so only top-level
  // destinations are queried: fewer, lighter requests for the shared servers.
  const destinations = [...DESTINATIONS, ...EXTRA_DESTINATIONS].filter((d) => !d.parent);
  const tourism = OSM_TOURISM_VALUES.join('|');
  const byKey = new Map<string, OsmPlace>();
  const failed: string[] = [];

  for (const [index, d] of destinations.entries()) {
    const query =
      `[out:json][timeout:90];` +
      `nwr["tourism"~"^(${tourism})$"]["name"](around:${d.radiusKm * 1000},${d.lat},${d.lng});` +
      `out center tags;`;
    let data: { elements: OverpassElement[] };
    try {
      data = await cachedOverpass(query, `places ${d.slug}`);
    } catch (error) {
      log((error as Error).message);
      failed.push(d.slug);
      continue;
    }

    for (const el of data.elements) {
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      if (lat === undefined || lng === undefined || !el.tags?.name) continue;
      const point = { lat: round6(lat), lng: round6(lng) };
      if (!isWithinSouthAfrica(point)) continue;
      const tags: Record<string, string> = {};
      for (const key of KEPT_TAGS) {
        const value = el.tags[key];
        if (value !== undefined) tags[key] = value.slice(0, 300);
      }
      byKey.set(`${el.type}/${el.id}`, { osmType: el.type, osmId: el.id, ...point, tags });
    }
    log(`${index + 1}/${destinations.length} ${d.slug}: ${byKey.size} places so far`);
    await sleep(1_500);
  }
  if (failed.length) {
    throw new Error(
      `servers were too busy for: ${failed.join(', ')}. Run the command again later; finished parts are cached.`,
    );
  }
  return [...byKey.values()].sort((a, b) =>
    a.osmType === b.osmType ? a.osmId - b.osmId : a.osmType.localeCompare(b.osmType),
  );
}

/** Warns when a hand-entered destination coordinate is far from OpenStreetMap's place node. */
async function checkExtraDestinations(): Promise<void> {
  const clauses = EXTRA_DESTINATIONS.map(
    (d) => `node["place"~"^(city|town|village)$"](around:15000,${d.lat},${d.lng});`,
  ).join('\n');
  const data = (await fetchWithRetry(
    OVERPASS_SERVERS,
    {
      method: 'POST',
      body: new URLSearchParams({ data: `[out:json][timeout:60];(\n${clauses}\n);out;` }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
    'town check',
    3,
  )) as { elements: OverpassElement[] };
  const normalise = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  for (const d of EXTRA_DESTINATIONS) {
    const node = data.elements.find((e) => normalise(e.tags?.name ?? '') === normalise(d.name));
    if (!node || node.lat === undefined || node.lon === undefined) {
      log(`WARNING: no OSM place node found for ${d.name}`);
      continue;
    }
    const drift = haversineKm(d, { lat: node.lat, lng: node.lon });
    if (drift > 2) {
      log(`WARNING: ${d.name} is ${drift.toFixed(1)} km from OSM (${node.lat}, ${node.lon})`);
    }
  }
}

// ---------------------------------------------------------------------------
// Wikimedia
// ---------------------------------------------------------------------------
const FREE_LICENCE = /^(cc0|pd|public domain|cc-by(-sa)?-[\d.]+)/i;

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface ImageInfo {
  thumburl?: string;
  thumbwidth?: number;
  thumbheight?: number;
  descriptionurl?: string;
  extmetadata?: Record<string, { value: string }>;
}

/** Resolves Commons file names to photo records, keeping only free licences. */
async function describeFiles(fileNames: string[]): Promise<Map<string, Photo>> {
  const result = new Map<string, Photo>();
  const unique = [...new Set(fileNames)];
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: String(THUMB_WIDTH),
      iiextmetadatafilter: 'Artist|LicenseShortName|License',
      titles: batch.map((f) => `File:${f}`).join('|'),
    });
    const data = (await fetchWithRetry([`${COMMONS_API}?${params}`], {}, 'commons')) as {
      query?: {
        normalized?: { from: string; to: string }[];
        pages: { title: string; imageinfo?: ImageInfo[] }[];
      };
    };
    const fromTitle = new Map<string, string>();
    for (const n of data.query?.normalized ?? []) fromTitle.set(n.to, n.from);
    for (const page of data.query?.pages ?? []) {
      const info = page.imageinfo?.[0];
      const meta = info?.extmetadata ?? {};
      const licence = meta.License?.value ?? '';
      const artist = stripHtml(meta.Artist?.value ?? '');
      if (!info?.thumburl || !info.descriptionurl || !FREE_LICENCE.test(licence) || !artist)
        continue;
      const thumb = commonsThumbUrl(info.thumburl);
      if (!thumb) continue;
      const original = (fromTitle.get(page.title) ?? page.title).replace(/^File:/, '');
      const licenceName = stripHtml(meta.LicenseShortName?.value ?? licence).slice(0, 40);
      result.set(original.replace(/_/g, ' '), {
        url: thumb,
        width: info.thumbwidth ?? THUMB_WIDTH,
        height: info.thumbheight ?? Math.round((THUMB_WIDTH * 2) / 3),
        credit: `${artist.slice(0, 120)} · ${licenceName} · Wikimedia Commons`,
        creditUrl: info.descriptionurl.replace(/^http:/, 'https:'),
        licence: licenceName,
      });
    }
    await sleep(500);
  }
  return result;
}

/** Wikidata item → its "image" (P18) file name. */
async function wikidataImages(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(ids.filter((id) => /^Q\d+$/.test(id)))];
  for (let i = 0; i < unique.length; i += 50) {
    const params = new URLSearchParams({
      action: 'wbgetentities',
      format: 'json',
      props: 'claims',
      ids: unique.slice(i, i + 50).join('|'),
    });
    const data = (await fetchWithRetry([`${WIKIDATA_API}?${params}`], {}, 'wikidata')) as {
      entities: Record<
        string,
        { claims?: { P18?: { mainsnak?: { datavalue?: { value?: string } } }[] } }
      >;
    };
    for (const [id, entity] of Object.entries(data.entities ?? {})) {
      const file = entity.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      if (file) out.set(id, file);
    }
    await sleep(500);
  }
  return out;
}

async function attachPlacePhotos(places: OsmPlace[]): Promise<void> {
  const fileFor = new Map<OsmPlace, string>();
  for (const place of places) {
    const commons = place.tags.wikimedia_commons;
    if (commons?.startsWith('File:')) fileFor.set(place, commons.slice(5));
  }
  const wikidata = await wikidataImages(
    places.filter((p) => !fileFor.has(p) && p.tags.wikidata).map((p) => p.tags.wikidata!),
  );
  for (const place of places) {
    const file = place.tags.wikidata ? wikidata.get(place.tags.wikidata) : undefined;
    if (!fileFor.has(place) && file) fileFor.set(place, file);
  }
  const photos = await describeFiles([...fileFor.values()]);
  for (const [place, file] of fileFor) {
    const photo = photos.get(file.replace(/_/g, ' '));
    if (photo) place.photo = photo;
  }
  log(`${places.filter((p) => p.photo).length} places have a free photo`);
}

async function destinationPhotos(): Promise<Record<string, Photo>> {
  const entries = Object.entries(DESTINATION_ARTICLES);
  const fileByTitle = new Map<string, string>();
  for (let i = 0; i < entries.length; i += 50) {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      prop: 'pageimages',
      piprop: 'name',
      pilicense: 'free',
      redirects: '1',
      titles: entries
        .slice(i, i + 50)
        .map(([, t]) => t)
        .join('|'),
    });
    const data = (await fetchWithRetry([`${WIKIPEDIA_API}?${params}`], {}, 'wikipedia')) as {
      query: {
        normalized?: { from: string; to: string }[];
        redirects?: { from: string; to: string }[];
        pages: { title: string; pageimage?: string }[];
      };
    };
    const back = new Map<string, string>();
    for (const n of [...(data.query.normalized ?? []), ...(data.query.redirects ?? [])]) {
      back.set(n.to, back.get(n.from) ?? n.from);
    }
    for (const page of data.query.pages) {
      if (page.pageimage) fileByTitle.set(back.get(page.title) ?? page.title, page.pageimage);
    }
  }
  const photos = await describeFiles([...fileByTitle.values()]);
  const result: Record<string, Photo> = {};
  for (const [slug, title] of entries) {
    const file = fileByTitle.get(title);
    const photo = file ? photos.get(file.replace(/_/g, ' ')) : undefined;
    if (photo) result[slug] = photo;
    else log(`no free photo for destination ${slug}`);
  }
  return result;
}

// ---------------------------------------------------------------------------
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

async function main(): Promise<void> {
  const places = await fetchPlaces();
  // A sanity check only: a busy server here must not stop the download.
  await checkExtraDestinations().catch((error: unknown) =>
    log(`skipped town check (${(error as Error).message})`),
  );
  log(`${places.length} named accommodation places`);
  await attachPlacePhotos(places);
  const destinationPhotoMap = await destinationPhotos();
  log(`${Object.keys(destinationPhotoMap).length} destinations have a photo`);

  const snapshot: OsmSnapshot = {
    fetchedAt: new Date().toISOString(),
    attribution: '© OpenStreetMap contributors',
    licence: 'ODbL-1.0 (https://opendatacommons.org/licenses/odbl/1-0/)',
    destinationPhotos: destinationPhotoMap,
    places,
  };
  // One place per line keeps diffs between snapshots readable.
  const body = [
    '{',
    `"fetchedAt": ${JSON.stringify(snapshot.fetchedAt)},`,
    `"attribution": ${JSON.stringify(snapshot.attribution)},`,
    `"licence": ${JSON.stringify(snapshot.licence)},`,
    `"destinationPhotos": ${JSON.stringify(snapshot.destinationPhotos, null, 1)},`,
    '"places": [',
    snapshot.places.map((p) => JSON.stringify(p)).join(',\n'),
    ']',
    '}',
    '',
  ].join('\n');
  writeFileSync(SNAPSHOT_PATH, body);
  log(`wrote ${SNAPSHOT_PATH}`);
}

main().catch((error: unknown) => {
  console.error(`[osm] ${(error as Error).message}`);
  process.exitCode = 1;
});
