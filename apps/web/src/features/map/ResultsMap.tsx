import { formatZar, type MapPoint, type SearchReference } from '@wayfare/shared';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import { WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createBaseMap } from './baseMap';
import styles from './ResultsMap.module.css';

export interface ResultsMapProps {
  points: MapPoint[];
  reference: SearchReference | null;
  selectedId: number | null;
  hoveredId: number | null;
  onSelect: (id: number) => void;
}

const MARKER_WIDTH = 92;
const MARKER_HEIGHT = 28;

function priceIcon(point: MapPoint, state: { selected: boolean; highlighted: boolean }) {
  const classes = ['price-marker'];
  if (state.selected) classes.push('price-marker--selected');
  else if (state.highlighted) classes.push('price-marker--highlighted');
  return L.divIcon({
    className: classes.join(' '),
    // Only a formatted number goes into HTML; names are set via setAttribute below.
    html: `<span class="price-marker__pill">${formatZar(point.averageNightlyCents)}</span>`,
    iconSize: [MARKER_WIDTH, MARKER_HEIGHT],
    iconAnchor: [MARKER_WIDTH / 2, MARKER_HEIGHT + 6],
  });
}

/**
 * Leaflet map of all matching properties (ADR-005). Markers are created once per
 * result set and then updated in place, so hovering cards stays cheap.
 */
export default function ResultsMap({
  points,
  reference,
  selectedId,
  hoveredId,
  onSelect,
}: ResultsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const referenceLayerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef(new Map<number, { marker: L.Marker; point: MapPoint }>());
  const onSelectRef = useRef(onSelect);
  const [tilesFailed, setTilesFailed] = useState(false);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = createBaseMap(containerRef.current, {
      onTileError: () => setTilesFailed(true),
      onTileLoad: () => setTilesFailed(false),
    });
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 45,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (c) => {
        // Leaflet copies `title` onto the (keyboard-focusable) cluster element: its accessible name.
        c.options.title = `${c.getChildCount()} stays in this area. Select to zoom in.`;
        return L.divIcon({
          className: 'marker-cluster-custom',
          html: `<span aria-hidden="true">${c.getChildCount()}</span>`,
          iconSize: [40, 40],
        });
      },
    });
    map.addLayer(cluster);
    referenceLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    clusterRef.current = cluster;
    const markers = markersRef.current;
    return () => {
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
      markers.clear();
    };
  }, []);

  // Rebuild markers when the result set changes, then fit the view.
  const pointsKey = points.map((p) => `${p.id}:${p.averageNightlyCents}`).join(',');
  useEffect(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!map || !cluster) return;
    cluster.clearLayers();
    markersRef.current.clear();
    const markers = points.map((point) => {
      const marker = L.marker([point.lat, point.lng], {
        icon: priceIcon(point, { selected: false, highlighted: false }),
        keyboard: true,
        riseOnHover: true,
      });
      marker.on('click', () => onSelectRef.current(point.id));
      marker.on('add', () => {
        const el = marker.getElement();
        el?.setAttribute(
          'aria-label',
          `${point.name}, ${formatZar(point.averageNightlyCents)} average per night`,
        );
        el?.setAttribute('role', 'button');
      });
      markersRef.current.set(point.id, { marker, point });
      return marker;
    });
    cluster.addLayers(markers);

    const refLayer = referenceLayerRef.current;
    refLayer?.clearLayers();
    if (reference && refLayer) {
      L.marker([reference.lat, reference.lng], {
        interactive: false,
        keyboard: false,
        zIndexOffset: -1000,
        icon: L.divIcon({
          className: 'price-marker price-marker--reference',
          html: `<span class="price-marker__pill">${reference.kind === 'coordinates' ? 'You are here' : 'Centre'}</span>`,
          iconSize: [MARKER_WIDTH, MARKER_HEIGHT],
          iconAnchor: [MARKER_WIDTH / 2, MARKER_HEIGHT + 6],
        }),
      }).addTo(refLayer);
    }

    const latLngs: L.LatLngExpression[] = points.map((p) => [p.lat, p.lng]);
    if (reference) latLngs.push([reference.lat, reference.lng]);
    if (latLngs.length === 1) map.setView(latLngs[0]!, 13);
    else if (latLngs.length > 1)
      map.fitBounds(L.latLngBounds(latLngs), { padding: [48, 48], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pointsKey captures the relevant changes
  }, [pointsKey, reference?.lat, reference?.lng, reference?.kind]);

  // Update only the markers whose state changed.
  const previous = useRef<{ selectedId: number | null; hoveredId: number | null }>({
    selectedId: null,
    hoveredId: null,
  });
  useEffect(() => {
    const touched = new Set([
      previous.current.selectedId,
      previous.current.hoveredId,
      selectedId,
      hoveredId,
    ]);
    for (const id of touched) {
      if (id === null) continue;
      const entry = markersRef.current.get(id);
      if (!entry) continue;
      const selected = id === selectedId;
      const highlighted = id === hoveredId;
      entry.marker.setIcon(priceIcon(entry.point, { selected, highlighted }));
      entry.marker.setZIndexOffset(selected ? 2000 : highlighted ? 1000 : 0);
      const el = entry.marker.getElement();
      el?.setAttribute(
        'aria-label',
        `${entry.point.name}, ${formatZar(entry.point.averageNightlyCents)} average per night`,
      );
      el?.setAttribute('aria-pressed', String(selected));
    }
    if (selectedId !== null && selectedId !== previous.current.selectedId) {
      const entry = markersRef.current.get(selectedId);
      if (entry && clusterRef.current) {
        // Expand clusters / pan so the selected property is visible.
        clusterRef.current.zoomToShowLayer(entry.marker, () => {
          if (mapRef.current && !mapRef.current.getBounds().contains(entry.marker.getLatLng())) {
            mapRef.current.panTo(entry.marker.getLatLng());
          }
        });
      }
    }
    previous.current = { selectedId, hoveredId };
  }, [selectedId, hoveredId, pointsKey]);

  return (
    <div className={styles.wrap}>
      <div
        ref={containerRef}
        className={styles.map}
        role="region"
        aria-label="Map of matching stays"
      />
      {tilesFailed && (
        <div className={styles.tileNotice} role="status">
          <WifiOff size={16} aria-hidden="true" />
          Map tiles are unavailable (they need an internet connection). Prices and the list still
          work.
        </div>
      )}
    </div>
  );
}
