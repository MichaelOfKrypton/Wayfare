import L from 'leaflet';
import { WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createBaseMap } from './baseMap';
import styles from './ResultsMap.module.css';

/** Single-property location map for the details page. */
export default function PropertyMap({
  lat,
  lng,
  name,
}: {
  lat: number;
  lng: number;
  name: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tilesFailed, setTilesFailed] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = createBaseMap(containerRef.current, {
      scrollWheelZoom: false,
      onTileError: () => setTilesFailed(true),
      onTileLoad: () => setTilesFailed(false),
    });
    map.setView([lat, lng], 14);
    const marker = L.marker([lat, lng], {
      keyboard: false,
      interactive: false,
      icon: L.divIcon({
        className: 'price-marker price-marker--selected',
        html: '<span class="price-marker__pill">Here</span>',
        iconSize: [92, 28],
        iconAnchor: [46, 34],
      }),
    }).addTo(map);
    marker.getElement()?.setAttribute('aria-hidden', 'true');
    return () => {
      map.remove();
    };
  }, [lat, lng]);

  return (
    <div className={styles.wrap}>
      <div
        ref={containerRef}
        className={styles.map}
        role="region"
        aria-label={`Map showing the location of ${name}`}
      />
      {tilesFailed && (
        <div className={styles.tileNotice} role="status">
          <WifiOff size={16} aria-hidden="true" />
          Map tiles are unavailable offline.
        </div>
      )}
    </div>
  );
}
