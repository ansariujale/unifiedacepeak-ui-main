import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DottedMap from 'dotted-map';
import CustomTooltip from '@/components/custom/custom-tooltip';

/**
 * The world map behind Global Presence. Built with `dotted-map` (MIT,
 * framework-agnostic — no React-version peer-dependency risk) rather than a
 * full geo-projection React library, since all this needs is the same
 * approximate dotted-continents look the reference design uses, not an
 * interactive/precise choropleth.
 *
 * `DottedMap` renders the dot grid as one SVG string; the labelled pins are
 * plain HTML positioned on top of it using the pixel coordinates `addPin`
 * hands back, converted to percentages via the map's own `image` size — so
 * the labels stay correctly placed at any card width without recomputing a
 * projection ourselves. Each pin is a real interactive element: hover for
 * that region's connection quality, click to jump to Performance.
 */

export interface PresenceRegion {
  name: string;
  lat: number;
  lng: number;
  color: string;
  /** Connection quality — no backend source for this (see the
      `NeedsBackendFlag` on Region Status in home/index.tsx); placeholder,
      shared between the map's pins and the Region Status list below it so
      the two never drift apart. */
  pct: number;
}

/** Approximate anchor points, one per region shown in Region Status below
    — real geography, placeholder `pct`. */
export const PRESENCE_REGIONS: PresenceRegion[] = [
  { name: 'North America', lat: 40, lng: -100, color: '#dc2626', pct: 100 },
  { name: 'Europe', lat: 50, lng: 15, color: '#7c3aed', pct: 98 },
  { name: 'Asia', lat: 28, lng: 95, color: '#0d9488', pct: 96 },
  { name: 'Oceania', lat: -26, lng: 135, color: '#6b7891', pct: 95 },
  { name: 'South America', lat: -16, lng: -60, color: '#c2670a', pct: 92 },
  { name: 'Africa', lat: 4, lng: 20, color: '#0e7490', pct: 90 },
];

const GlobalPresenceMap = () => {
  const navigate = useNavigate();

  const { svg, labels, aspectRatio } = useMemo(() => {
    // 40 rows keeps this at ~1,300 dots (~90KB of markup) instead of the
    // ~4,500 dots `height: 58` produces — plenty of density for a card this
    // size without bloating the DOM with circles too small to register.
    const map = new DottedMap({ height: 40, grid: 'diagonal' });

    const points = PRESENCE_REGIONS.map((region) => ({
      region,
      point: map.addPin({
        lat: region.lat,
        lng: region.lng,
        svgOptions: { color: region.color, radius: 0.9 },
      }),
    }));

    const svgMarkup = map.getSVG({
      shape: 'circle',
      color: '#d8dce3',
      backgroundColor: 'transparent',
      radius: 0.28,
    });

    const { width, height } = map.image;
    const labelPoints = points.map(({ region, point }) => ({
      name: region.name,
      color: region.color,
      pct: region.pct,
      leftPct: (point.x / width) * 100,
      topPct: (point.y / height) * 100,
    }));

    return { svg: svgMarkup, labels: labelPoints, aspectRatio: width / height };
  }, []);

  return (
    // Fills the card's full width; height follows from the map's own real
    // aspect ratio at that width (set inline below) rather than being
    // independently constrained, so the whole map is always visible with
    // no cropping or scrolling.
    <div className="dash-home__presence-map">
      <div className="dash-home__presence-map-inner" style={{ aspectRatio }}>
        <div
          className="dash-home__presence-map-svg"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        {labels.map((label) => (
          <CustomTooltip
            key={label.name}
            text={`${label.name}: ${label.pct}% connection quality`}
            side="top"
          >
            <button
              type="button"
              onClick={() => navigate('/performance')}
              className="dash-home__presence-pin"
              style={{ left: `${label.leftPct}%`, top: `${label.topPct}%` }}
            >
              <span className="dash-home__presence-pin-dot" style={{ backgroundColor: label.color }} />
              <span className="dash-home__presence-pin-label" style={{ color: label.color }}>
                {label.name}
              </span>
            </button>
          </CustomTooltip>
        ))}
      </div>
    </div>
  );
};

export default GlobalPresenceMap;
