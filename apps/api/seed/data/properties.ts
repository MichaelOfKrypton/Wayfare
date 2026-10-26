import type { PropertyTypeSlug } from './catalog';

export type Tier = 'budget' | 'mid' | 'premium' | 'luxury';
export type Theme = 'coast' | 'city' | 'winelands' | 'forest' | 'mountain' | 'bushveld';

/**
 * Land-based anchor points. Property coordinates are jittered within `jitterM`
 * metres of an anchor; coastal anchors sit inland of the shoreline so jittered
 * points stay on land.
 */
export interface Anchor {
  destination: string; // destination slug the property belongs to
  suburb: string;
  lat: number;
  lng: number;
  jitterM: number;
  theme: Theme;
  /** Local price level relative to the national baseline. */
  priceLevel: number;
  coastal?: boolean;
  mountains?: boolean;
}

export const ANCHORS: Record<string, Anchor> = {
  'ct-sea-point': { destination: 'cape-town', suburb: 'Sea Point', lat: -33.9205, lng: 18.3905, jitterM: 300, theme: 'coast', priceLevel: 1.25, coastal: true, mountains: true },
  'ct-camps-bay': { destination: 'cape-town', suburb: 'Camps Bay', lat: -33.953, lng: 18.385, jitterM: 280, theme: 'coast', priceLevel: 1.6, coastal: true, mountains: true },
  'ct-green-point': { destination: 'cape-town', suburb: 'Green Point', lat: -33.911, lng: 18.408, jitterM: 250, theme: 'city', priceLevel: 1.3, coastal: true },
  'ct-gardens': { destination: 'cape-town', suburb: 'Gardens', lat: -33.934, lng: 18.413, jitterM: 500, theme: 'mountain', priceLevel: 1.15, mountains: true },
  'ct-woodstock': { destination: 'cape-town', suburb: 'Woodstock', lat: -33.93, lng: 18.447, jitterM: 350, theme: 'city', priceLevel: 0.95 },
  'ct-constantia': { destination: 'cape-town', suburb: 'Constantia', lat: -34.025, lng: 18.445, jitterM: 1200, theme: 'winelands', priceLevel: 1.35, mountains: true },
  'jhb-sandton': { destination: 'johannesburg', suburb: 'Sandton', lat: -26.1076, lng: 28.0567, jitterM: 900, theme: 'city', priceLevel: 1.15 },
  'jhb-rosebank': { destination: 'johannesburg', suburb: 'Rosebank', lat: -26.1458, lng: 28.042, jitterM: 600, theme: 'city', priceLevel: 1.05 },
  'jhb-melville': { destination: 'johannesburg', suburb: 'Melville', lat: -26.175, lng: 28.008, jitterM: 500, theme: 'city', priceLevel: 0.8 },
  'jhb-maboneng': { destination: 'johannesburg', suburb: 'Maboneng', lat: -26.2045, lng: 28.059, jitterM: 300, theme: 'city', priceLevel: 0.75 },
  'dbn-umhlanga': { destination: 'durban', suburb: 'Umhlanga', lat: -29.724, lng: 31.076, jitterM: 400, theme: 'coast', priceLevel: 1.15, coastal: true },
  'dbn-beachfront': { destination: 'durban', suburb: 'Durban Beachfront', lat: -29.852, lng: 31.025, jitterM: 280, theme: 'coast', priceLevel: 0.9, coastal: true },
  'dbn-berea': { destination: 'durban', suburb: 'Berea', lat: -29.838, lng: 31.005, jitterM: 600, theme: 'city', priceLevel: 0.8 },
  'pta-hatfield': { destination: 'pretoria', suburb: 'Hatfield', lat: -25.7487, lng: 28.238, jitterM: 600, theme: 'city', priceLevel: 0.85 },
  'pta-brooklyn': { destination: 'pretoria', suburb: 'Brooklyn', lat: -25.77, lng: 28.237, jitterM: 500, theme: 'city', priceLevel: 0.95 },
  'stb-town': { destination: 'stellenbosch', suburb: 'Stellenbosch Central', lat: -33.9345, lng: 18.861, jitterM: 600, theme: 'winelands', priceLevel: 1.1, mountains: true },
  'stb-farms': { destination: 'stellenbosch', suburb: 'Jonkershoek Valley', lat: -33.955, lng: 18.92, jitterM: 1500, theme: 'winelands', priceLevel: 1.25, mountains: true },
  'paarl-town': { destination: 'paarl', suburb: 'Paarl', lat: -33.735, lng: 18.963, jitterM: 1200, theme: 'winelands', priceLevel: 0.9, mountains: true },
  'fhk-village': { destination: 'franschhoek', suburb: 'Franschhoek', lat: -33.911, lng: 19.12, jitterM: 700, theme: 'winelands', priceLevel: 1.45, mountains: true },
  'george-town': { destination: 'george', suburb: 'George', lat: -33.96, lng: 22.455, jitterM: 1500, theme: 'forest', priceLevel: 0.85, mountains: true },
  'knysna-town': { destination: 'knysna', suburb: 'Knysna Central', lat: -34.033, lng: 23.044, jitterM: 300, theme: 'coast', priceLevel: 1.05, coastal: true },
  'knysna-paradise': { destination: 'knysna', suburb: 'Paradise', lat: -34.032, lng: 23.03, jitterM: 400, theme: 'forest', priceLevel: 1.0 },
  'knysna-forest': { destination: 'knysna', suburb: 'Knysna Forest', lat: -33.98, lng: 23.09, jitterM: 1500, theme: 'forest', priceLevel: 1.1 },
  'plett-town': { destination: 'plettenberg-bay', suburb: 'Plettenberg Bay', lat: -34.048, lng: 23.365, jitterM: 350, theme: 'coast', priceLevel: 1.3, coastal: true },
  'plett-hills': { destination: 'plettenberg-bay', suburb: 'Piesang Valley', lat: -34.04, lng: 23.35, jitterM: 600, theme: 'forest', priceLevel: 1.15 },
  'hermanus-central': { destination: 'hermanus', suburb: 'Hermanus Central', lat: -34.415, lng: 19.236, jitterM: 300, theme: 'coast', priceLevel: 1.15, coastal: true, mountains: true },
  'hermanus-east': { destination: 'hermanus', suburb: 'Voëlklip', lat: -34.405, lng: 19.265, jitterM: 300, theme: 'coast', priceLevel: 1.1, coastal: true },
  'clarens-village': { destination: 'clarens', suburb: 'Clarens', lat: -28.513, lng: 28.421, jitterM: 600, theme: 'mountain', priceLevel: 0.85, mountains: true },
  'clarens-farms': { destination: 'clarens', suburb: 'Clarens Valley', lat: -28.53, lng: 28.39, jitterM: 1500, theme: 'mountain', priceLevel: 0.8, mountains: true },
  'gqb-summerstrand': { destination: 'gqeberha', suburb: 'Summerstrand', lat: -33.996, lng: 25.656, jitterM: 250, theme: 'coast', priceLevel: 0.9, coastal: true },
  'gqb-walmer': { destination: 'gqeberha', suburb: 'Walmer', lat: -33.98, lng: 25.58, jitterM: 600, theme: 'city', priceLevel: 0.8 },
  'hazyview-town': { destination: 'hazyview', suburb: 'Hazyview', lat: -25.045, lng: 31.12, jitterM: 1200, theme: 'bushveld', priceLevel: 0.95 },
  'hazyview-bush': { destination: 'hazyview', suburb: 'Sabie River', lat: -25.03, lng: 31.17, jitterM: 2000, theme: 'bushveld', priceLevel: 1.3 },
  'berg-valley': { destination: 'central-drakensberg', suburb: 'Champagne Valley', lat: -28.97, lng: 29.43, jitterM: 2500, theme: 'mountain', priceLevel: 0.95, mountains: true },
};

export interface PropertySeed {
  name: string;
  anchor: keyof typeof ANCHORS;
  type: PropertyTypeSlug;
  tier: Tier;
}

/**
 * Fictional properties. Names are invented for this demo; any resemblance to a
 * real establishment is coincidental.
 */
export const PROPERTIES: PropertySeed[] = [
  // Cape Town (16)
  { name: 'Atlantic Lantern Suites', anchor: 'ct-sea-point', type: 'apartment', tier: 'premium' },
  { name: 'Promenade Pebble Guesthouse', anchor: 'ct-sea-point', type: 'guesthouse', tier: 'mid' },
  { name: 'Saltwind Backpackers', anchor: 'ct-sea-point', type: 'backpackers', tier: 'budget' },
  { name: 'Apostles Ridge Villa', anchor: 'ct-camps-bay', type: 'holiday-home', tier: 'luxury' },
  { name: 'Glen Beach Boutique Rooms', anchor: 'ct-camps-bay', type: 'boutique-hotel', tier: 'luxury' },
  { name: 'Lion’s Head Terrace Apartments', anchor: 'ct-camps-bay', type: 'apartment', tier: 'premium' },
  { name: 'Foghorn Point Hotel', anchor: 'ct-green-point', type: 'hotel', tier: 'premium' },
  { name: 'Lighthouse Lane B&B', anchor: 'ct-green-point', type: 'bed-and-breakfast', tier: 'mid' },
  { name: 'Kloof Nek Garden House', anchor: 'ct-gardens', type: 'guesthouse', tier: 'mid' },
  { name: 'Orange Street Garden Hotel', anchor: 'ct-gardens', type: 'hotel', tier: 'mid' },
  { name: 'Tafelberg Studio Lofts', anchor: 'ct-gardens', type: 'apartment', tier: 'mid' },
  { name: 'Hiddingh Hill Hostel', anchor: 'ct-gardens', type: 'backpackers', tier: 'budget' },
  { name: 'Albert Road Mill Lofts', anchor: 'ct-woodstock', type: 'apartment', tier: 'mid' },
  { name: 'Salt River Social Hostel', anchor: 'ct-woodstock', type: 'backpackers', tier: 'budget' },
  { name: 'Silvertree Vineyard Cottages', anchor: 'ct-constantia', type: 'self-catering', tier: 'premium' },
  { name: 'Constantia Nek Manor', anchor: 'ct-constantia', type: 'boutique-hotel', tier: 'luxury' },
  // Johannesburg (10)
  { name: 'Maude Street Executive Hotel', anchor: 'jhb-sandton', type: 'hotel', tier: 'premium' },
  { name: 'Grayston Business Suites', anchor: 'jhb-sandton', type: 'apartment', tier: 'mid' },
  { name: 'Morningside Oak Guesthouse', anchor: 'jhb-sandton', type: 'guesthouse', tier: 'mid' },
  { name: 'Rivonia Road Budget Rooms', anchor: 'jhb-sandton', type: 'hotel', tier: 'budget' },
  { name: 'Jellicoe Avenue Art Hotel', anchor: 'jhb-rosebank', type: 'boutique-hotel', tier: 'premium' },
  { name: 'Parkwood Jacaranda B&B', anchor: 'jhb-rosebank', type: 'bed-and-breakfast', tier: 'mid' },
  { name: 'Oxford Lane Apartments', anchor: 'jhb-rosebank', type: 'apartment', tier: 'mid' },
  { name: '7th Street Creative Guesthouse', anchor: 'jhb-melville', type: 'guesthouse', tier: 'budget' },
  { name: 'Melville Koppies Cottage', anchor: 'jhb-melville', type: 'self-catering', tier: 'budget' },
  { name: 'Fox Street Warehouse Hostel', anchor: 'jhb-maboneng', type: 'backpackers', tier: 'budget' },
  // Durban (9)
  { name: 'Lighthouse Shore Hotel', anchor: 'dbn-umhlanga', type: 'hotel', tier: 'premium' },
  { name: 'Umhlanga Ridge Holiday Flats', anchor: 'dbn-umhlanga', type: 'apartment', tier: 'mid' },
  { name: 'Lagoon Drive Family Home', anchor: 'dbn-umhlanga', type: 'holiday-home', tier: 'premium' },
  { name: 'Chartwell Palms B&B', anchor: 'dbn-umhlanga', type: 'bed-and-breakfast', tier: 'mid' },
  { name: 'Golden Mile Surf Hotel', anchor: 'dbn-beachfront', type: 'hotel', tier: 'mid' },
  { name: 'Snell Parade Sea Studios', anchor: 'dbn-beachfront', type: 'apartment', tier: 'budget' },
  { name: 'North Beach Bunkhouse', anchor: 'dbn-beachfront', type: 'backpackers', tier: 'budget' },
  { name: 'Musgrave Heights Guesthouse', anchor: 'dbn-berea', type: 'guesthouse', tier: 'mid' },
  { name: 'Florida Road Boutique Rooms', anchor: 'dbn-berea', type: 'boutique-hotel', tier: 'premium' },
  // Pretoria (5)
  { name: 'Jacaranda Quad Hotel', anchor: 'pta-hatfield', type: 'hotel', tier: 'mid' },
  { name: 'Burnett Street Student Lodge', anchor: 'pta-hatfield', type: 'backpackers', tier: 'budget' },
  { name: 'Embassy Row Guesthouse', anchor: 'pta-brooklyn', type: 'guesthouse', tier: 'premium' },
  { name: 'Brooklyn Garden Cottage', anchor: 'pta-brooklyn', type: 'self-catering', tier: 'mid' },
  { name: 'Lynnwood Ridge B&B', anchor: 'pta-brooklyn', type: 'bed-and-breakfast', tier: 'mid' },
  // Stellenbosch (6)
  { name: 'Dorp Street Oak Guesthouse', anchor: 'stb-town', type: 'guesthouse', tier: 'mid' },
  { name: 'Eikestad Boutique Hotel', anchor: 'stb-town', type: 'boutique-hotel', tier: 'premium' },
  { name: 'Brandwacht Student Rooms', anchor: 'stb-town', type: 'backpackers', tier: 'budget' },
  { name: 'Jonkershoek River Cottages', anchor: 'stb-farms', type: 'self-catering', tier: 'mid' },
  { name: 'Klein Bergkelder Wine Farm Stay', anchor: 'stb-farms', type: 'farm-stay', tier: 'premium' },
  { name: 'Helderberg Vista Estate', anchor: 'stb-farms', type: 'boutique-hotel', tier: 'luxury' },
  // Paarl (4)
  { name: 'Paarl Rock Guesthouse', anchor: 'paarl-town', type: 'guesthouse', tier: 'mid' },
  { name: 'Berg River Farm Cottages', anchor: 'paarl-town', type: 'farm-stay', tier: 'budget' },
  { name: 'Main Street Manor B&B', anchor: 'paarl-town', type: 'bed-and-breakfast', tier: 'mid' },
  { name: 'Drakenstein Vineyard Lodge', anchor: 'paarl-town', type: 'lodge', tier: 'premium' },
  // Franschhoek (4)
  { name: 'Huguenot Lane Boutique Hotel', anchor: 'fhk-village', type: 'boutique-hotel', tier: 'luxury' },
  { name: 'La Petite Vigne Cottages', anchor: 'fhk-village', type: 'self-catering', tier: 'premium' },
  { name: 'Valley Road Guesthouse', anchor: 'fhk-village', type: 'guesthouse', tier: 'mid' },
  { name: 'Wemmershoek Olive Farm', anchor: 'fhk-village', type: 'farm-stay', tier: 'mid' },
  // George (4)
  { name: 'Outeniqua Peak Hotel', anchor: 'george-town', type: 'hotel', tier: 'mid' },
  { name: 'Yellowwood Forest Guesthouse', anchor: 'george-town', type: 'guesthouse', tier: 'mid' },
  { name: 'Blanco Hills Farm Stay', anchor: 'george-town', type: 'farm-stay', tier: 'budget' },
  { name: 'Garden Route Airport Inn', anchor: 'george-town', type: 'hotel', tier: 'budget' },
  // Knysna (6)
  { name: 'Lagoon Quay Apartments', anchor: 'knysna-town', type: 'apartment', tier: 'premium' },
  { name: 'Waterfront Heron B&B', anchor: 'knysna-town', type: 'bed-and-breakfast', tier: 'mid' },
  { name: 'Fynbos Ridge Guesthouse', anchor: 'knysna-paradise', type: 'guesthouse', tier: 'mid' },
  { name: 'Paradise Hill Family House', anchor: 'knysna-paradise', type: 'holiday-home', tier: 'mid' },
  { name: 'Stinkwood Hollow Forest Lodge', anchor: 'knysna-forest', type: 'lodge', tier: 'premium' },
  { name: 'Woodcutter’s Cabins', anchor: 'knysna-forest', type: 'self-catering', tier: 'budget' },
  // Plettenberg Bay (4)
  { name: 'Keurbooms Tide House', anchor: 'plett-town', type: 'holiday-home', tier: 'luxury' },
  { name: 'Formosa Bay Hotel', anchor: 'plett-town', type: 'hotel', tier: 'premium' },
  { name: 'Piesang Valley Cottages', anchor: 'plett-hills', type: 'self-catering', tier: 'mid' },
  { name: 'Bitou Hills Guesthouse', anchor: 'plett-hills', type: 'guesthouse', tier: 'mid' },
  // Hermanus (5)
  { name: 'Cliff Path Whale House', anchor: 'hermanus-central', type: 'guesthouse', tier: 'premium' },
  { name: 'Old Harbour B&B', anchor: 'hermanus-central', type: 'bed-and-breakfast', tier: 'mid' },
  { name: 'Walker Bay Backpackers', anchor: 'hermanus-central', type: 'backpackers', tier: 'budget' },
  { name: 'Voëlklip Beach Cottage', anchor: 'hermanus-east', type: 'self-catering', tier: 'mid' },
  { name: 'Fernkloof Ridge House', anchor: 'hermanus-east', type: 'holiday-home', tier: 'premium' },
  // Clarens (4)
  { name: 'Sandstone Square Guesthouse', anchor: 'clarens-village', type: 'guesthouse', tier: 'mid' },
  { name: 'Kloof Willow Cottages', anchor: 'clarens-village', type: 'self-catering', tier: 'budget' },
  { name: 'Maluti Meadows Farm Stay', anchor: 'clarens-farms', type: 'farm-stay', tier: 'mid' },
  { name: 'Rooiberg Sandstone Lodge', anchor: 'clarens-farms', type: 'lodge', tier: 'premium' },
  // Gqeberha (5)
  { name: 'Summerstrand Bay Hotel', anchor: 'gqb-summerstrand', type: 'hotel', tier: 'mid' },
  { name: 'Pier Street Apartments', anchor: 'gqb-summerstrand', type: 'apartment', tier: 'mid' },
  { name: 'Bluewater Swell Lodge', anchor: 'gqb-summerstrand', type: 'backpackers', tier: 'budget' },
  { name: 'Walmer Heights Guesthouse', anchor: 'gqb-walmer', type: 'guesthouse', tier: 'mid' },
  { name: 'Mill Park Manor B&B', anchor: 'gqb-walmer', type: 'bed-and-breakfast', tier: 'premium' },
  // Hazyview (5)
  { name: 'Leadwood Bend Bush Lodge', anchor: 'hazyview-bush', type: 'lodge', tier: 'luxury' },
  { name: 'Marula Grove Chalets', anchor: 'hazyview-bush', type: 'self-catering', tier: 'mid' },
  { name: 'White River Road Guesthouse', anchor: 'hazyview-town', type: 'guesthouse', tier: 'budget' },
  { name: 'Bushbuck Crossing Hotel', anchor: 'hazyview-town', type: 'hotel', tier: 'mid' },
  { name: 'Banana Farm Family Stay', anchor: 'hazyview-town', type: 'farm-stay', tier: 'budget' },
  // Central Drakensberg (4)
  { name: 'Sterkhorn View Lodge', anchor: 'berg-valley', type: 'lodge', tier: 'premium' },
  { name: 'Little Mountain Brook Cabins', anchor: 'berg-valley', type: 'self-catering', tier: 'budget' },
  { name: 'Little Berg Farm House', anchor: 'berg-valley', type: 'farm-stay', tier: 'mid' },
  { name: 'Escarpment Trails Guesthouse', anchor: 'berg-valley', type: 'guesthouse', tier: 'mid' },
];
