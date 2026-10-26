import { CompassWatermark } from './Logo';

/**
 * The dark hero background, blue glow and compass watermark, held still while
 * the page scrolls. A fixed layer is clipped to the hero's box (`clip-path`
 * clips fixed descendants), so the hero content and everything below scroll
 * over a static backdrop. Place it as the first child of a positioned hero.
 */
export function HeroBackdrop() {
  return (
    <div className="hero-backdrop" aria-hidden="true">
      <div className="hero-backdrop__layer">
        <CompassWatermark className="hero-backdrop__compass" />
      </div>
    </div>
  );
}
