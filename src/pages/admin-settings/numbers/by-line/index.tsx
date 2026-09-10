import { FC, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Info } from 'lucide-react';

import Loader from '@/components/custom/loader';
import NumberWithFlag from '@/components/custom/number-with-flag';
import CustomTooltip from '@/components/custom/custom-tooltip';
import TableSearchHeader from '@/components/custom/table-search-header';
import SimpleTableFooter, { type SimplePagination } from '@/components/custom/simple-table-footer';
import { Icon } from '@/assets/icons/icon';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import { allNumbersList } from '@/services/api';
import {
  canEditLabel,
  groupByLine,
  labelOf,
  matchesLineSearch,
  numberTypeOf,
  numbersWithoutLine,
  isSmsCapable,
} from '@/lib/number-labels';

/**
 * The numbers on each shared line, together.
 *
 * Every other view here is a flat list of numbers, which answers "what do we
 * own" and never answers "what rings Support". That second question is the one
 * asked when a number has to be added, retired or explained to a customer, and
 * today it is answered by reading the Forwarded-to column of a hundred rows.
 *
 * Nothing new is fetched. A line does not store its numbers — each number
 * stores where it forwards — so the grouping is that relationship read
 * backwards, out of the same list the other views use.
 *
 * The warning at the top is there because this screen would otherwise be
 * quietly misleading. A number pointed at a department, queue or menu is stored
 * correctly and looks correct here, and the switch that answers inbound calls
 * handles only two destinations: an extension and a voicemail box. Everything
 * else it logs as unhandled and drops. Showing these numbers grouped under
 * their line without saying so would tell an admin their setup is fine.
 */

const TYPE_WORDS: Record<string, string> = {
  DEPARTMENT: 'Department',
  QUEUE: 'Queue',
  IVR: 'Menu',
  AI: 'AI receptionist',
};

interface NumbersByLineProps {
  search: string;
  setSearch: (value: string) => void;
  onEditLabel: (did: any) => void;
  canLabel: boolean;
  menuPortalTarget?: HTMLElement | null;
}

const NumbersByLine: FC<NumbersByLineProps> = ({
  search,
  setSearch,
  onEditLabel,
  canLabel,
  menuPortalTarget,
}) => {
  const {
    data: numbers = [],
    isPending,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['numbersByLine'],
    queryFn: () => fetchAllPages(allNumbersList),
    staleTime: 60 * 1000,
  });

  const groups = useMemo(() => groupByLine(numbers), [numbers]);
  const visible = useMemo(
    () => groups.filter((group) => matchesLineSearch(group, search)),
    [groups, search],
  );
  const unlinked = useMemo(() => numbersWithoutLine(numbers).length, [numbers]);

  /* Groups are the "records" this view paginates — each line's own numbers
     stay together on one page rather than being split mid-line. Resets to
     page 1 whenever the search narrows (or widens) the result set, the
     same way TableManager's own pagination does. */
  const [pagination, setPagination] = useState<SimplePagination>({ pageIndex: 0, pageSize: 25 });
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [search]);
  const pagedVisible = useMemo(
    () =>
      visible.slice(
        pagination.pageIndex * pagination.pageSize,
        (pagination.pageIndex + 1) * pagination.pageSize,
      ),
    [visible, pagination],
  );

  if (isPending) {
    return (
      <div className="flex w-full items-center justify-center p-8">
        <Loader variant="blue" size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Description first, then search — matching All numbers' order. All
          numbers' own version of this banner is matched (and re-tinted) by
          the shared `p:first-child` CSS rule (`.mcm-adminpage-body >
          .panel-card > .tbl-wrap > div > p:first-child`) — border-primary/30
          and text-gray-900 never actually render there, that rule's own
          --accent-edge border/--ink-2 text/12.5px size win instead. This
          paragraph sits one div deeper (inside this component's own root),
          so that selector doesn't reach it; its colors/size are spelled out
          directly here to match what All numbers actually renders, not what
          its className claims. */}
      <p className="mx-4 mt-4 flex items-start gap-2 rounded-lg border border-[var(--accent-edge)] bg-[var(--accent-wash)] px-[13px] py-[10px] text-[12.5px] leading-relaxed text-[var(--ink-2)]">
        <Info className="mt-0.5 h-3.5 w-3.5 flex-none text-[var(--accent)]" />
        <span>
          Only numbers pointing at an extension or voicemail are actually connected — others
          (department, queue, menu, AI receptionist) save here but drop the call.
        </span>
      </p>

      {/* Each line renders its own small table below, so there is no single
          table header to attach this to — it sits here instead, in the same
          style as the other views' table search. Wrapped in the same
          border-b + px-3/py-2 padding TableManager gives its own
          `customHeader` (see table-manager.tsx) — without it the search
          pill sat flush against the card's edges instead of inset like
          every other Numbers table's search bar. */}
      {/* -mt-2 pulls this closer to the description above without touching
          the parent's gap-4, which also spaces the line cards and pagination
          below this and should stay as-is. */}
      <div className="ident-table-card ident-table-card--plain w-full flex flex-col -mt-2">
        <div>
          <div className="px-3 py-2">
            <TableSearchHeader
              value={search}
              onChange={setSearch}
              onRefresh={() => refetch()}
              refreshing={isRefetching}
              placeholder="Search lines"
            />
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="px-3 py-8 text-center">
          <p className="font-semibold text-gray-900">No lines to show</p>
          <p className="text-sm text-gray-500">
            {groups.length
              ? 'No line matches that search.'
              : 'Point a number at a department, queue or menu and it will be grouped here.'}
          </p>
        </div>
      ) : (
        pagedVisible.map((group) => (
          <section key={group.line.key} className="ident-line-card flex flex-col">
            <header className="ident-line-card__head flex flex-wrap items-baseline gap-2">
              <h3 className="text-md font-semibold text-gray-900">{group.line.name}</h3>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                {TYPE_WORDS[group.line.type] || group.line.type}
              </span>
              <span className="text-xs text-gray-500">
                {group.numbers.length} {group.numbers.length === 1 ? 'number' : 'numbers'}
              </span>
            </header>
            <div className="ident-line-card__table-wrap">
              <table className="ident-line-table">
                <thead>
                  <tr>
                    <th>Phone number</th>
                    <th>Label</th>
                    <th>Type</th>
                    <th>Texting</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {group.numbers.map((did: any, index: number) => {
                    const label = labelOf(did);
                    const allowed = canEditLabel(did);
                    return (
                      <tr key={did?.uuid || did?.did_number}>
                        <td>
                          {/* inline-flex, not flex: a block-level flex div ignores
                              the td's text-align: center entirely (block boxes
                              don't respond to an ancestor's text-align for their
                              own position), which is why this column alone stayed
                              left-aligned while every plain-text column centered
                              correctly. */}
                          <div className="inline-flex items-center gap-2">
                            <NumberWithFlag number={did?.did_number} />
                            {/* Not a stored flag — the platform has none. It is the
                                first number on the line, which is the one people
                                mean when they say "the Support number". */}
                            {index === 0 ? (
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-800">
                                Primary
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          {label ? (
                            <span className="block max-w-[190px] truncate text-[13px] font-normal text-slate-950 transition-colors">
                              {label}
                            </span>
                          ) : (
                            <span className="text-gray-500">No label</span>
                          )}
                        </td>
                        <td>{numberTypeOf(did)}</td>
                        <td>{isSmsCapable(did) ? 'Yes' : 'No'}</td>
                        <td className="text-center">
                          {canLabel && allowed.ok ? (
                            <CustomTooltip text={label ? 'Edit label' : 'Add label'} side="top">
                              <div
                                className="cursor-pointer flex items-center justify-center rounded-full w-8 h-8 bg-red-100 text-red-500 hover:bg-red-500 hover:text-white mx-auto"
                                onClick={() => onEditLabel(did)}
                              >
                                <Icon name="EditStrokIcon" className="w-4 h-4" />
                              </div>
                            </CustomTooltip>
                          ) : (
                            <span className="text-gray-500">--</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="ident-line-card__footer">
              {group.numbers.length} {group.numbers.length === 1 ? 'record' : 'records'}
            </div>
          </section>
        ))
      )}

      {/* Same red-bordered notice style as the banner above (and border/bg/
          text colors and size match what that banner actually renders with,
          not its literal Tailwind classes — see the comment on it), sitting
          above the footer rather than after it. */}
      {unlinked ? (
        <p className="mx-4 mb-3 flex items-start gap-2 rounded-lg border border-[var(--accent-edge)] bg-[var(--accent-wash)] px-[13px] py-[10px] text-[12.5px] leading-relaxed text-[var(--ink-2)]">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-none text-[var(--accent)]" />
          <span>
            {unlinked} {unlinked === 1 ? "number isn't" : "numbers aren't"} on a shared line — see{' '}
            {unlinked === 1 ? 'it' : 'them'} in All numbers.
          </span>
        </p>
      ) : null}

      {visible.length > 0 && (
        <SimpleTableFooter
          totalItems={visible.length}
          pagination={pagination}
          onPaginationChange={setPagination}
          menuPortalTarget={menuPortalTarget}
        />
      )}
    </div>
  );
};

export default NumbersByLine;
