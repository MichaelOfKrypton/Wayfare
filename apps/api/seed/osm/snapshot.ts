/**
 * The committed OpenStreetMap snapshot (`seed/data/osm-snapshot.json`): its
 * shape, and a loader that validates it before the seed uses it.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

export const SNAPSHOT_PATH = fileURLToPath(new URL('../data/osm-snapshot.json', import.meta.url));

const photoSchema = z.object({
  url: z.string().regex(/^https:\/\/upload\.wikimedia\.org\//),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  credit: z.string().min(1).max(200),
  creditUrl: z.string().regex(/^https:\/\/commons\.wikimedia\.org\//),
  licence: z.string().min(1).max(40),
});
export type Photo = z.infer<typeof photoSchema>;

const placeSchema = z.object({
  osmType: z.enum(['node', 'way', 'relation']),
  osmId: z.number().int().positive(),
  lat: z.number(),
  lng: z.number(),
  tags: z.record(z.string(), z.string()),
  photo: photoSchema.optional(),
});
export type OsmPlace = z.infer<typeof placeSchema>;

const snapshotSchema = z.object({
  fetchedAt: z.string(),
  attribution: z.string(),
  licence: z.string(),
  destinationPhotos: z.record(z.string(), photoSchema),
  places: z.array(placeSchema),
});
export type OsmSnapshot = z.infer<typeof snapshotSchema>;

export function hasSnapshot(): boolean {
  return existsSync(SNAPSHOT_PATH);
}

export function loadSnapshot(path = SNAPSHOT_PATH): OsmSnapshot {
  return snapshotSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
}
