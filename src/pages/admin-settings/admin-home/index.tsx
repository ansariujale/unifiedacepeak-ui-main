import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { useCompanyFeatures } from '@/hooks/rbac';
import { useUser } from '@/hooks/use-user';
import Loader from '@/components/custom/loader';
import CustomTooltip from '@/components/custom/custom-tooltip';
import { Ic, McmIconSprite } from '@/components/mcm/icons';
import { Icon } from '@/assets/icons/icon';
import type { IconType } from '@/assets/icons/type';
import { adminSettingArr, canShowItem } from '../sidebar';
import { useAdminShortcuts } from '../use-admin-shortcuts';
import '@/components/mcm/mcm-page.css';

/**
 * Admin — the landing page.
 *
 * Admin has ~35 screens across 11 sections. An accordion makes you open a
 * section to discover what is in it; this lays every screen a person can reach
 * on one page, grouped, so the whole area is legible at a glance and one click
 * away. It reads the same `adminSettingArr` the nav does, so a screen someone
 * lacks permission for never appears here either.
 */

type Entry = { title: string; path: string; icon?: string };
type Group = { title: string; icon: string; entries: Entry[] };

/* Six wedges is as far as the donut goes legibly — the rest bucket into
   "Others" rather than shrinking to slivers nobody can read. */
const DONUT_COLORS = [
  'var(--accent)',
  'var(--warn)',
  'var(--ai)',
  'var(--live)',
  'var(--hold)',
  'var(--ink-4)',
];

/** Cycled by index across "Most Accessed Areas" tiles — see `.tint-0`
    through `.tint-3` in mcm-page.css. */
const AREA_TILE_TINTS = 4;

/* "All Screens" column count at each breakpoint — matches what CSS
   `column-count` used to switch at, but read in JS because the masonry
   packing below needs to know it upfront. */
const SCREENS_COLUMN_QUERIES = ['(min-width: 1440px)', '(min-width: 1024px)', '(min-width: 640px)'];
const screensColumnCountFromMatches = (matches: boolean[]) =>
  matches[0] ? 4 : matches[1] ? 3 : matches[2] ? 2 : 1;

const useScreensColumnCount = () => {
  const [count, setCount] = useState(1);
  useEffect(() => {
    const queries = SCREENS_COLUMN_QUERIES.map((q) => window.matchMedia(q));
    const measure = () => setCount(screensColumnCountFromMatches(queries.map((q) => q.matches)));
    measure();
    queries.forEach((q) => q.addEventListener('change', measure));
    return () => queries.forEach((q) => q.removeEventListener('change', measure));
  }, []);
  return count;
};

const AdminHome = () => {
  const { features, user_info } = useCompanyFeatures();
  const { loader, user } = useUser();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'recent'>('all');
  const { recent, clearRecent } = useAdminShortcuts();

  const IS_ADMIN = user_info?.role === 'ADMIN';

  /* Same sliding-pill treatment as the header's area tabs: one indicator
     that moves/resizes to the active tab's own box, instead of each tab's
     background just swapping in place. `tab` is a plain string, so — unlike
     the area nav's `areas` array — there's no unstable-reference risk here;
     the equality guard in setTabIndicator is kept anyway for consistency and
     to avoid a same-value render on every mount. */
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const [tabIndicator, setTabIndicator] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  useLayoutEffect(() => {
    const activeButton = tabButtonRefs.current.get(tab);
    if (!activeButton) {
      setTabIndicator((prev) => (prev === null ? prev : null));
      return;
    }
    const left = activeButton.offsetLeft;
    const top = activeButton.offsetTop;
    const width = activeButton.offsetWidth;
    const height = activeButton.offsetHeight;
    setTabIndicator((prev) =>
      prev && prev.left === left && prev.top === top && prev.width === width && prev.height === height
        ? prev
        : { left, top, width, height },
    );
  }, [tab]);

  /* Sections flattened into groups of links, honouring the same visibility
     rules the nav applies. A section with no reachable screens is dropped. */
  const groups: Group[] = useMemo(() => {
    if (!user_info) return [];
    return adminSettingArr(features, IS_ADMIN)
      .filter((section: any) => canShowItem(section, IS_ADMIN))
      .map((section: any) => {
        const entries: Entry[] =
          section?.type === 'accordion'
            ? (section?.children || [])
                .filter((child: any) => canShowItem(child, IS_ADMIN))
                .map((child: any) => ({ title: child.title, path: child.path, icon: child.icon }))
            : [{ title: section.title, path: section.path, icon: section.icon }];
        return { title: section.title, icon: section.icon, entries: entries.filter((e) => e.path) };
      })
      .filter((group: Group) => group.entries.length > 0);
  }, [features, IS_ADMIN, user_info]);

  const allEntries = useMemo(
    () =>
      groups.flatMap((group) => group.entries.map((entry) => ({ ...entry, group: group.title }))),
    [groups],
  );

  const visibleGroups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return groups;
    return groups
      .map((group) => ({
        ...group,
        entries: group.entries.filter(
          (entry) =>
            entry.title.toLowerCase().includes(needle) ||
            group.title.toLowerCase().includes(needle),
        ),
      }))
      .filter((group) => group.entries.length > 0);
  }, [groups, search]);

  const screensColumnCount = useScreensColumnCount();

  /* Greedy shortest-column-first packing for "All Screens": each group goes
     into whichever column currently has the least content, weighted by its
     real entry count (a kicker plus each entry row are close enough in
     height that row count is an accurate enough proxy without measuring the
     DOM). CSS `column-count` was tried first — it balances by pre-splitting
     total height evenly, so a card that doesn't fit that even split gets
     bumped to the next column and leaves a gap under the shorter ones. This
     packs tightly instead, the same way a real masonry layout would. */
  const screensColumns = useMemo(() => {
    const columns: Group[][] = Array.from({ length: screensColumnCount }, () => []);
    const heights = new Array(screensColumnCount).fill(0);
    visibleGroups.forEach((group) => {
      let shortest = 0;
      for (let i = 1; i < heights.length; i++) {
        if (heights[i] < heights[shortest]) shortest = i;
      }
      columns[shortest].push(group);
      heights[shortest] += group.entries.length + 1;
    });
    return columns;
  }, [visibleGroups, screensColumnCount]);

  /* Recent is a list of paths; resolving each through `allEntries` means a
     screen you lose access to quietly disappears.
     A visited path may be a detail screen ("…/people/edit/42"), which is not
     itself a nav entry. Fall back to the longest nav path it sits under, so
     editing a person still counts as having used People rather than vanishing.
     Longest wins because "/admin-settings/phone" and "/admin-settings/phone/queues"
     can both be prefixes and only the more specific one is the screen you saw. */
  const resolveEntry = useCallback(
    (path: string) =>
      allEntries.find((entry) => entry.path === path) ||
      allEntries
        .filter((entry) => path.startsWith(`${entry.path}/`))
        .sort((a, b) => b.path.length - a.path.length)[0],
    [allEntries],
  );

  const recentEntries = useMemo(() => {
    const seen = new Set<string>();
    const resolved: Array<Entry & { group: string }> = [];
    recent.forEach((path) => {
      const entry = resolveEntry(path);
      /* Two detail routes can collapse onto the same screen, so dedupe after
         resolving, not before. */
      if (!entry || seen.has(entry.path)) return;
      seen.add(entry.path);
      resolved.push(entry);
    });
    /* Recent stores 24 so unresolvable routes cannot push real screens out;
       only the most recent eight are shown. */
    return resolved.slice(0, 8);
  }, [recent, resolveEntry]);

  /* The count comes from what actually resolves, so the tab never promises
     more than it can show. */
  const recentCount = recentEntries.length;

  /* Same fallback chain the header uses for the profile card, so "Your role"
     here always matches what the top bar already told you. */
  const roleLabel =
    user?.user_info?.custom_role_data?.name ||
    user?.user_info?.role_data?.name ||
    user?.user_info?.role ||
    'User';

  /* Top five areas by screen count, everything past that folded into one
     "Others" wedge — a real breakdown of `groups`, not a mock. */
  const screensByArea = useMemo(() => {
    const sorted = [...groups]
      .map((group) => ({ title: group.title, icon: group.icon, count: group.entries.length }))
      .sort((a, b) => b.count - a.count);
    const top = sorted.slice(0, 5);
    const others = sorted.slice(5).reduce((sum, group) => sum + group.count, 0);
    return others > 0 ? [...top, { title: 'Others', icon: '', count: others }] : top;
  }, [groups]);

  const donutSlices = useMemo(() => {
    const total = screensByArea.reduce((sum, slice) => sum + slice.count, 0);
    let cursor = 0;
    return screensByArea.map((slice, index) => {
      const pct = total ? (slice.count / total) * 100 : 0;
      const start = cursor;
      cursor += pct;
      return { ...slice, pct, start, end: cursor, color: DONUT_COLORS[index % DONUT_COLORS.length] };
    });
  }, [screensByArea]);

  const donutGradient = donutSlices.length
    ? `conic-gradient(${donutSlices.map((slice) => `${slice.color} ${slice.start}% ${slice.end}%`).join(', ')})`
    : 'var(--line)';

  /* Ranked by real visits — every path in the last-24 shortcut history,
     resolved to its group and tallied, not just the eight shown in the
     Recently Used tab. A screen nobody has opened yet still appears (visits:
     0) so the grid stays the full area list, sized by real screen count. */
  const mostAccessedAreas = useMemo(() => {
    const visitCounts = new Map<string, number>();
    recent.forEach((path: string) => {
      const entry = resolveEntry(path);
      if (!entry) return;
      visitCounts.set(entry.group, (visitCounts.get(entry.group) || 0) + 1);
    });
    return [...groups]
      .map((group) => ({
        title: group.title,
        icon: group.icon,
        screens: group.entries.length,
        firstPath: group.entries[0]?.path,
        visits: visitCounts.get(group.title) || 0,
      }))
      .sort((a, b) => b.visits - a.visits || b.screens - a.screens)
      .slice(0, 7);
  }, [groups, recent, resolveEntry]);

  if (loader || !user_info) {
    return (
      <div className="flex h-full w-full items-center justify-center p-5">
        <Loader variant="blue" size="lg" />
      </div>
    );
  }

  return (
    <section className="mcm-adminhome flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
      <McmIconSprite />
      <div className="mcm-adminhome-head">
        <div>
          <div className="mcm-adminhome-eyebrow">Admin</div>
          <div className="mcm-adminhome-titlerow">
            <h1>Everything you administer</h1>
            <CustomTooltip
              text={`${allEntries.length} screens across ${groups.length} areas. Only what your role can reach is listed.`}
              side="right"
              openOnMount
              className="w-max max-w-[260px] border-0 bg-[#fdf7f5] text-black shadow-none [&_svg]:fill-[#fdf7f5]"
            >
              <span className="mcm-adminhome-infobtn" aria-label="About this page">
                <Info />
              </span>
            </CustomTooltip>
          </div>
        </div>
        <div className="mcm-adminhome-search">
          <Ic n="search" size={15} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search admin"
            aria-label="Search admin screens"
          />
        </div>
      </div>

      <div className="ptabstrip mcm-adminhome-tabs" ref={tabsRef}>
        {tabIndicator && (
          <span
            className="mcm-adminhome-tabindicator"
            style={{
              transform: `translate(${tabIndicator.left}px, ${tabIndicator.top}px)`,
              width: tabIndicator.width,
              height: tabIndicator.height,
            }}
            aria-hidden="true"
          />
        )}
        <button
          type="button"
          ref={(node) => {
            if (node) tabButtonRefs.current.set('all', node);
            else tabButtonRefs.current.delete('all');
          }}
          className={tab === 'all' ? 'on' : ''}
          onClick={() => setTab('all')}
        >
          All
        </button>
        <button
          type="button"
          ref={(node) => {
            if (node) tabButtonRefs.current.set('recent', node);
            else tabButtonRefs.current.delete('recent');
          }}
          className={tab === 'recent' ? 'on' : ''}
          onClick={() => setTab('recent')}
        >
          Recently used{recentCount ? ` (${recentCount})` : ''}
        </button>
        {tab === 'recent' && recentCount ? (
          <button type="button" className="mcm-adminhome-clear" onClick={clearRecent}>
            Clear
          </button>
        ) : null}
      </div>

      <div className="mcm-adminhome-body">
        {tab === 'all' ? (
          <div className="mcm-adminoverview">
            <div className="mcm-adminoverview-eyebrow">
              <span>Overview</span>
            </div>
            <div className="mcm-adminkpirow">
              <div className="mcm-adminkpicard">
                <div className="mcm-adminkpicard-body">
                  <div className="mcm-adminkpicard-label">Total Screens</div>
                  <div className="mcm-adminkpicard-value">{allEntries.length}</div>
                  <div className="mcm-adminkpicard-sub">Across {groups.length} areas</div>
                </div>
              </div>
              <div className="mcm-adminkpicard">
                <div className="mcm-adminkpicard-body">
                  <div className="mcm-adminkpicard-label">Areas</div>
                  <div className="mcm-adminkpicard-value">{groups.length}</div>
                  <div className="mcm-adminkpicard-sub">Sections you can reach</div>
                </div>
              </div>
              <div className="mcm-adminkpicard">
                <div className="mcm-adminkpicard-body">
                  <div className="mcm-adminkpicard-label">Recently Used</div>
                  <div className="mcm-adminkpicard-value">{recentCount}</div>
                  <div className="mcm-adminkpicard-sub">Screens you've opened</div>
                </div>
              </div>
              <div className="mcm-adminkpicard">
                <div className="mcm-adminkpicard-body">
                  <div className="mcm-adminkpicard-label">Your Role</div>
                  <div className="mcm-adminkpicard-value mcm-adminkpicard-value-text">
                    {roleLabel}
                  </div>
                  <div className="mcm-adminkpicard-sub">
                    {IS_ADMIN ? 'Full access' : 'Limited access'}
                  </div>
                </div>
              </div>
            </div>

            <div className="mcm-adminoverview-row">
              <div className="mcm-admindonut-card">
                <div className="mcm-admincard-h">Screens by Area</div>
                <div className="mcm-admindonut-wrap">
                  <div className="mcm-admindonut" style={{ background: donutGradient }}>
                    <div className="mcm-admindonut-hole">
                      <strong>{allEntries.length}</strong>
                      <span>Total</span>
                    </div>
                  </div>
                  <ul className="mcm-admindonut-legend">
                    {donutSlices.map((slice) => (
                      <li key={slice.title}>
                        <span className="mcm-admindonut-dot" style={{ background: slice.color }} />
                        <span className="mcm-admindonut-name">{slice.title}</span>
                        <span className="mcm-admindonut-count">
                          {slice.count} ({Math.round(slice.pct)}%)
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mcm-adminareas-card">
                <div className="mcm-admincard-h">Most Accessed Areas</div>
                <div className="mcm-adminareas-grid">
                  {mostAccessedAreas.map((area) => (
                    <Link
                      className="mcm-adminareas-tile"
                      to={area.firstPath || '/admin-settings'}
                      key={area.title}
                    >
                      {area.icon ? (
                        <span className="mcm-adminareas-tile-iconwrap" data-icon={area.icon}>
                          <Icon name={area.icon as IconType} />
                        </span>
                      ) : null}
                      <span className="mcm-adminareas-tile-body">
                        <span className="mcm-adminareas-tile-title">{area.title}</span>
                        <span className="mcm-adminareas-tile-sub">
                          {area.screens} screen{area.screens === 1 ? '' : 's'}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {tab === 'all' ? (
          visibleGroups.length ? (
            <>
              <div className="mcm-adminscreens-head">All Screens</div>
              <div className="mcm-adminscreens-grid">
                {screensColumns.map((column, columnIndex) => (
                  <div className="mcm-adminscreens-col" key={columnIndex}>
                    {column.map((group) => (
                      <div className="mcm-adminscreens-group" key={group.title}>
                        <div className="mcm-adminscreens-kicker">
                          {group.icon ? (
                            <Icon name={group.icon as IconType} className="mcm-adminscreens-kickericon" />
                          ) : null}
                          <span className="mcm-adminscreens-kickertitle">{group.title}</span>
                          <span className="mcm-adminscreens-kickercount">{group.entries.length}</span>
                        </div>
                        <ul className="mcm-adminscreens-list">
                          {group.entries.map((entry) => (
                            <li key={entry.path}>
                              <Link to={entry.path}>
                                {entry.icon ? (
                                  <span className="mcm-adminscreens-iconwrap">
                                    <Icon name={entry.icon as IconType} />
                                  </span>
                                ) : null}
                                <span>{entry.title}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="mcm-adminhome-empty">Nothing matches “{search}”.</p>
          )
        ) : recentEntries.length ? (
          <>
            <div className="mcm-admincard-h">Recently used</div>
            <div className="mcm-admin-kpigrid">
              {recentEntries.map((entry) => (
                <Link className="mcm-admin-kpitile" to={entry.path} key={entry.path}>
                  {entry.icon ? (
                    <span className="mcm-admin-kpitile-iconwrap">
                      <Icon name={entry.icon as IconType} />
                    </span>
                  ) : null}
                  <span className="mcm-admin-kpitile-body">
                    <span className="mcm-admin-kpitile-k">{entry.group}</span>
                    <span className="mcm-admin-kpitile-v">{entry.title}</span>
                  </span>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <p className="mcm-adminhome-empty">Screens you open will show up here.</p>
        )}
      </div>
    </section>
  );
};

export default AdminHome;
