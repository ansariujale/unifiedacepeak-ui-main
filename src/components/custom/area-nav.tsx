import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCompanyFeatures } from '@/hooks/rbac';
import { useUser } from '@/hooks/use-user';
import { cn } from '@/lib/utils';
import { Icon } from '@/assets/icons/icon';
import type { IconType } from '@/assets/icons/type';
import { AREA_VIEWS, NAV_AREAS, areaOfPath, type NavArea } from './nav-areas';
import { navList, navListBottom } from './sidebar';

/**
 * The console's top-level area nav.
 *
 * It reads the same RBAC-filtered nav items the sidebar renders, so an area
 * only appears when the signed-in user can actually reach something inside it.
 * Choosing an area navigates to its first available item; the sidebar then
 * derives the same active area from the URL, which keeps the two in step
 * without either one owning the other's state.
 */
const AreaNav = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { features } = useCompanyFeatures();
  const { user = {} } = useUser();
  const IS_ADMIN = user?.user_info?.role === 'ADMIN';

  const items = useMemo(
    () => [...navList(features, IS_ADMIN), ...navListBottom(features, IS_ADMIN)],
    [features, IS_ADMIN],
  );

  const areas = useMemo(
    () =>
      NAV_AREAS.map((area) => ({
        area,
        entries: items.filter((item) => area.items.includes(item.name)),
      })).filter(({ entries }) => entries.length > 0),
    [items],
  );

  const activeArea = useMemo(() => areaOfPath(pathname, items), [pathname, items]);

  const openArea = ({ area, entries }: { area: NavArea; entries: typeof items }) => {
    if (area.id === activeArea) return;
    // Areas that navigate by views open at their view home; the rest open at
    // their first reachable route item.
    const target = AREA_VIEWS[area.id]?.base || entries[0]?.link;
    if (target) navigate(target);
  };

  /* A pill that slides between tabs, rather than each tab just swapping its
     own background in place — that read as a hard cut, not a switch. Sized
     off the active button's own box so it tracks labels of different
     lengths, and re-measured whenever the active area, the tab set, or the
     viewport changes (a narrower screen re-wraps/re-widths the same tabs). */
  const navRef = useRef<HTMLElement>(null);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const [indicator, setIndicator] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const activeButton = buttonRefs.current.get(activeArea);
      const nav = navRef.current;
      if (!activeButton || !nav) {
        setIndicator((prev) => (prev === null ? prev : null));
        return;
      }
      /* The button's own box, exactly — not an inset guessed from the nav
         bar's overall height, which made the active pill a different size
         than the hover pill (the hover background is just the button's own
         background, sized to its actual padding box). */
      const left = activeButton.offsetLeft;
      const top = activeButton.offsetTop;
      const width = activeButton.offsetWidth;
      const height = activeButton.offsetHeight;
      /* `areas` is a fresh array from `useMemo` most renders — this effect
         depends on it (a new area can appear or disappear) but that means it
         reruns far more often than the measured box actually changes.
         Bailing out via the functional updater when the numbers match keeps
         the state reference stable, so a no-op measurement doesn't trigger
         another render that reruns this same effect — which otherwise loops
         until React's update-depth guard throws and crashes the header. */
      setIndicator((prev) =>
        prev &&
        prev.left === left &&
        prev.top === top &&
        prev.width === width &&
        prev.height === height
          ? prev
          : { left, top, width, height },
      );
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [activeArea, areas]);

  if (areas.length < 2) return null;

  return (
    <nav className="mcm-areanav" aria-label="Areas" ref={navRef}>
      {indicator && (
        <span
          className="mcm-areanav-indicator"
          style={{
            transform: `translate(${indicator.left}px, ${indicator.top}px)`,
            width: indicator.width,
            height: indicator.height,
          }}
          aria-hidden="true"
        />
      )}
      {areas.map(({ area, entries }) => {
        const isActive = area.id === activeArea;
        return (
          <button
            key={area.id}
            type="button"
            ref={(node) => {
              if (node) buttonRefs.current.set(area.id, node);
              else buttonRefs.current.delete(area.id);
            }}
            className={cn('mcm-areanav-btn', isActive && 'is-active')}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => openArea({ area, entries })}
          >
            <Icon name={area.icon as IconType} className="h-4 w-4" />
            <span>{area.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default AreaNav;
