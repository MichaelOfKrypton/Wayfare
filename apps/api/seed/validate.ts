import { haversineKm, isWithinSouthAfrica } from '@wayfare/shared';
import type { Dataset } from './generate';

/**
 * Integrity checks the database cannot express on its own (or that are cheaper
 * to report clearly here). Throws with every problem listed.
 */
export function validateDataset(dataset: Dataset): void {
  const problems: string[] = [];
  const destinations = new Map(dataset.destinations.map((d) => [d.slug, d]));

  for (const d of dataset.destinations) {
    if (!isWithinSouthAfrica(d)) problems.push(`destination ${d.slug} is outside South Africa`);
    if (d.parent && !destinations.has(d.parent)) problems.push(`destination ${d.slug} has unknown parent ${d.parent}`);
  }

  const slugs = new Set<string>();
  for (const p of dataset.properties) {
    if (slugs.has(p.slug)) problems.push(`duplicate property slug ${p.slug}`);
    slugs.add(p.slug);

    if (!isWithinSouthAfrica(p)) problems.push(`${p.slug} is outside South Africa`);
    const dest = destinations.get(p.destinationSlug);
    if (!dest) {
      problems.push(`${p.slug} has unknown destination ${p.destinationSlug}`);
    } else if (haversineKm(p, dest) > dest.radiusKm) {
      problems.push(`${p.slug} is ${haversineKm(p, dest).toFixed(1)} km from ${dest.slug} (radius ${dest.radiusKm} km)`);
    }

    const roomNames = new Set(p.roomTypes.map((r) => r.name));
    const providers = new Set(p.listings.map((l) => l.providerSlug));
    for (const offer of p.offers) {
      if (!roomNames.has(offer.roomTypeName)) problems.push(`${p.slug}: offer for unknown room ${offer.roomTypeName}`);
      if (!providers.has(offer.providerSlug)) problems.push(`${p.slug}: offer from unlisted provider ${offer.providerSlug}`);
    }
    if (!p.offers.some((o) => o.status === 'active')) problems.push(`${p.slug} has no active offers`);
    if (p.images.some((i) => !i.alt.trim())) problems.push(`${p.slug} has an image without alt text`);
  }

  // Near-duplicate guard: two properties within 30 m are probably the same place.
  const props = dataset.properties;
  for (let i = 0; i < props.length; i += 1) {
    for (let j = i + 1; j < props.length; j += 1) {
      const a = props[i]!;
      const b = props[j]!;
      if (haversineKm(a, b) < 0.03) problems.push(`${a.slug} and ${b.slug} are within 30 m of each other`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`Seed dataset failed validation:\n  - ${problems.join('\n  - ')}`);
  }
}
