/* Every destination you can call, with its dialling code and price.
 *
 * The rates screen next to this one answers one question at a time: pick a
 * country, see its rates. That is right for checking a single number before
 * dialling it, and no use for "which destinations cost the most" or "send our
 * price list to finance".
 *
 * The list of destinations is instant, because the countries and their dialling
 * codes already ship with the app. Prices are not: the endpoint that has them
 * takes one country per request, so a full price list is 250 round trips. They
 * are fetched in small batches, and every row says which of the four things it
 * is - priced, not sold here, still loading, or not asked for yet - because a
 * blank price reads as free.
 */

import { Info } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import CustomTooltip from '@/components/custom/custom-tooltip';
import TableSearchHeader from '@/components/custom/table-search-header';
import { Icon } from '@/assets/icons/icon';
import { callingRatesList } from '@/services/api';
import countryList from '@/lib/countries.json';
import { demoRates } from './constant';
import {
  buildDestinations,
  markFailed,
  markLoading,
  matchesSearch,
  nextToPrice,
  priceProgress,
  readRateAnswer,
  toCsv,
  type Destination,
} from '@/lib/destination-rates';

/* Small enough that the table fills visibly and the service is not hammered.
   250 at once would be refused by the browser and finish in an order nobody
   can predict. */
const BATCH = 8;

/* Rows shown before the list asks whether you want more. */
const PAGE = 25;

const price = (value?: number): string =>
  value === undefined ? '—' : `$${value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`;

const STATE_TEXT: Record<Destination['state'], string> = {
  unknown: 'Not loaded',
  loading: 'Loading…',
  priced: '',
  unpriced: 'Not sold',
  failed: 'Failed',
};

type Filter = 'all' | 'priced' | 'unpriced' | 'unknown';

const Destinations = () => {
  /* DEMO prices — remove with `demoRates` before release. The rates endpoint
     returns nothing for this workspace, so every one of the 250 rows read
     "Not loaded" and pressing Load fired 250 requests that all came back
     empty. Seeding through `readRateAnswer` means the demo takes exactly the
     same path a real answer does. */
  const [rows, setRows] = useState<Destination[]>(() =>
    buildDestinations(countryList as any).map((destination) =>
      readRateAnswer(
        destination,
        demoRates(destination.name, destination.iso, destination.dialCode),
      ),
    ),
  );
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  /* 250 rows in one scroll is a wall you have to drag through to reach
     anything, so the list opens short. One press shows the rest — pressing
     "show more" over and over to walk a 250-row list is its own kind of
     wall — and the same control collapses it back. */
  const [expanded, setExpanded] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  /* Read inside the loop so pressing Stop takes effect on the next batch rather
     than only after every remaining country has been fetched. */
  const stopped = useRef(false);
  /* The toggle lives at the FOOT of the list, so pressing it leaves you at
     the bottom looking at row 25 (expanding) or past the end of a list that
     just shrank (collapsing). Either way the answer is the top of the
     table. */
  const bodyRef = useRef<HTMLDivElement>(null);

  const toggleExpanded = () => {
    setExpanded((open) => !open);
    /* Scroll the container itself. `scrollIntoView` on the card did nothing
       here — the page's scroll region is `.mcm-intbody`, and on small
       screens it is the document instead, so both are reset explicitly.
       rAF, so the new row count is committed before the scroll lands. */
    requestAnimationFrame(() => {
      bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          matchesSearch(r, search) &&
          (filter === 'all' ||
            (filter === 'priced' && r.state === 'priced') ||
            (filter === 'unpriced' && r.state === 'unpriced') ||
            (filter === 'unknown' && (r.state === 'unknown' || r.state === 'failed'))),
      ),
    [rows, search, filter],
  );
  const progress = useMemo(() => priceProgress(rows), [rows]);

  /* Searching or switching tabs starts a different list, so it starts
     collapsed — otherwise a search inherits the last one's expansion and
     looks like it returned far more than it did. */
  useEffect(() => setExpanded(false), [search, filter]);

  const visible = expanded ? shown : shown.slice(0, PAGE);
  const remaining = shown.length - visible.length;

  const countOf = (state: Destination['state']) => rows.filter((r) => r.state === state).length;
  const tabs = [
    { key: 'all' as const, label: 'All', count: rows.length },
    { key: 'priced' as const, label: 'Priced', count: countOf('priced') },
    { key: 'unpriced' as const, label: 'Not sold', count: countOf('unpriced') },
    {
      key: 'unknown' as const,
      label: 'Not loaded',
      count: countOf('unknown') + countOf('failed'),
    },
  ];

  const fetchOne = useCallback(async (destination: Destination) => {
    setRows((all) => all.map((r) => (r.iso === destination.iso ? markLoading(r) : r)));
    try {
      const answer = await callingRatesList({
        filter: { key: 'COUNTRY', value: destination.name },
      });
      setRows((all) => all.map((r) => (r.iso === destination.iso ? readRateAnswer(r, answer) : r)));
    } catch {
      setRows((all) => all.map((r) => (r.iso === destination.iso ? markFailed(r) : r)));
    }
  }, []);

  /* Walks the whole list in batches. The queue is recomputed from current state
     each round rather than captured up front, so a row somebody loaded by hand
     in the meantime is not fetched twice. */
  const loadAll = useCallback(async () => {
    stopped.current = false;
    setLoadingAll(true);
    try {
      for (;;) {
        if (stopped.current) break;
        let batch: Destination[] = [];
        setRows((all) => {
          batch = nextToPrice(all, BATCH);
          return all;
        });
        await new Promise((r) => setTimeout(r, 0));
        if (batch.length === 0) break;
        await Promise.all(batch.map(fetchOne));
      }
    } finally {
      setLoadingAll(false);
    }
  }, [fetchOne]);

  const exportCsv = () => {
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'destinations-and-rates.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="mcm-intpage is-stickytable flex w-full min-w-0 flex-col overflow-hidden">
      {/* Same head as the rest of the console: eyebrow, serif title, the
          description folded behind the "i", filter and search on the row.
          This screen carried the older AdminPage shell, so it and the
          Outbound Rates page beside it did not look like the same section. */}
      <div className="mcm-intpage-head">
        <div className="mcm-intpage-eyebrow">SMS / Calling Rates</div>
        {/* Title over column 1, filter centred on column 2 -- the same
            three-column head every other list page uses. Only the search
            moved into the table card (the toolbar strip below). */}
        <div className="mcm-intpage-headrow">
          <div className="mcm-intpage-headleft">
            <div className="flex min-w-0 items-center gap-2">
              <h1>Destinations</h1>
              <CustomTooltip
                side="bottom"
                sideOffset={10}
                className="mcm-tooltip-info"
                text="Everywhere you can call, with its dialling code and what a call there costs."
              >
                <Info className="mcm-intpage-info" />
              </CustomTooltip>
            </div>

            <div className="mcm-segmented" role="group" aria-label="Filter destinations">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  aria-pressed={filter === tab.key}
                  className={filter === tab.key ? 'is-active' : ''}
                  onClick={() => setFilter(tab.key)}
                >
                  {tab.label}
                  <em>{tab.count}</em>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* One strip: where the prices have got to, and what you can do about
          it. Loading only appears while there is something left to load —
          it used to sit there as a disabled "All loaded" button, which is a
          control that can never be pressed telling you something the
          sentence beside it already said. */}
      <div className="mcm-destbar">
        <span className="mcm-destbar-progress">
          {progress.complete
            ? `All ${progress.total} destinations priced`
            : `${progress.known} of ${progress.total} priced — prices load one country at a time`}
        </span>

        {loadingAll ? (
          <button type="button" className="btn" onClick={() => (stopped.current = true)}>
            Stop
          </button>
        ) : progress.missing > 0 ? (
          <button type="button" className="btn" onClick={() => void loadAll()}>
            Load {progress.missing} remaining
          </button>
        ) : null}

        {/* Secondary, not the black CTA: exporting is a convenience here, not
            the thing the page is for. */}
        <button type="button" className="btn mcm-destbar-export" onClick={exportCsv}>
          <Icon name="DownloadIcon" className="h-3.5 w-3.5" />
          Export CSV
        </button>
      </div>

      <div className="mcm-intbody flex-1 overflow-y-auto p-3" ref={bodyRef}>
        {/* Table and its footer share one bordered card, so the control that
            extends the list sits inside the thing it extends rather than
            floating on the page background under it. */}
        <div className="mcm-tablecard">
          {/* Search left, filter right, inside the card above the columns. */}
          <div className="mcm-tabletools">
            <TableSearchHeader
              value={search}
              onChange={setSearch}
              placeholder="Country, code, or a number"
            />
          </div>
          <div className="scroller overflow-x-auto">
            <table className="mcm-desttbl w-full min-w-[48rem] border-collapse text-sm">
              <thead className="mcm-ratetbl-head sticky top-0 z-10">
                <tr>
                  <th>Destination</th>
                  <th>Code</th>
                  <th>Outbound</th>
                  <th>Inbound</th>
                  <th>SMS</th>
                  <th>MMS</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((d) => (
                  <tr key={d.iso}>
                    <td className="font-medium text-gray-900">
                      <span className="mcm-desttbl-flag">{d.flag}</span>
                      {d.name}
                    </td>
                    <td className="tabular-nums text-gray-700">{d.dialCode}</td>
                    <td className="tabular-nums text-gray-900">
                      {d.state === 'priced' ? price(d.outbound) : '—'}
                    </td>
                    <td className="tabular-nums text-gray-700">
                      {d.state === 'priced' ? price(d.inbound) : '—'}
                    </td>
                    <td className="tabular-nums text-gray-700">
                      {d.state === 'priced' ? price(d.sms) : '—'}
                    </td>
                    <td className="tabular-nums text-gray-700">
                      {d.state === 'priced' ? price(d.mms) : '—'}
                    </td>
                    {/* A dash on its own would read as "free". The state column is
                        what stops a blank price being mistaken for a zero one. */}
                    <td className="text-xs">
                      {d.state === 'priced' ? (
                        <span className="mcm-intstatus connected">
                          <i />
                          Priced
                        </span>
                      ) : d.state === 'unknown' ? (
                        <button
                          type="button"
                          className="mcm-desttbl-load"
                          onClick={() => void fetchOne(d)}
                        >
                          Load price
                        </button>
                      ) : (
                        <span
                          className={
                            d.state === 'failed'
                              ? 'text-red-700'
                              : d.state === 'unpriced'
                                ? 'text-gray-500'
                                : 'text-gray-400'
                          }
                          title={d.note}
                        >
                          {STATE_TEXT[d.state]}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {shown.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-xs text-gray-600">
                      {search.trim()
                        ? `Nothing matches “${search.trim()}”.`
                        : 'No destinations in this view.'}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {/* The list extends on request rather than dumping all 250 rows
              into one scroll. The count rides on the button, so it is clear
              how much is still behind it before you press. */}
          {shown.length > PAGE ? (
            <div className="mcm-destmore">
              <button
                type="button"
                className="btn"
                onClick={toggleExpanded}
              >
                {expanded ? 'Show less' : 'Show all destinations'}
                <span>
                  {expanded ? `(collapse to first ${PAGE})` : `(${remaining} remaining)`}
                </span>
              </button>
            </div>
          ) : null}
        </div>

        {!progress.complete ? (
          <div className="mcm-ratetbl-note">
            <Icon name="InfoIcon" className="mcm-ratetbl-note-icon" />
            <p>
              A price only appears once it has been fetched. <strong>Not sold</strong> means no
              price is published for that destination — it is not the same as a price of nothing.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default Destinations;
