import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/assets/icons/icon';
import NumberWithFlag from '@/components/custom/number-with-flag';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { allNumbersList, callForwarding, getGreetings, getUserList } from '@/services/api';
import { useUser } from '@/hooks/use-user';
import {
  assignVoicemailGreeting,
  generateVoicemailGreeting,
  voicemailGreetingName,
  voicemailScriptFor,
} from '@/lib/voicemail-greeting';
import { useOrganization } from '@/hooks/use-organisation';
import { handleAlert } from '@/lib/utils';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import Loader from '@/components/custom/loader';
import UpdateForwarding from '@/pages/admin-settings/people/update-forwarding';
import { Ic } from '@/components/mcm/icons';
import { AdminPage } from '@/pages/admin-settings/page-shell';
import {
  buildNumberStandard,
  buildVoicemailPatch,
  describeStandard,
  evaluateNumber,
  evaluateUser,
  extensionOf,
  assignedNameOf,
  type Coverage,
} from '@/lib/call-standard';
import { invalidateNumberLists } from '@/lib/number-list-cache';
import {
  Info,
  Voicemail,
  Wrench,
  KeyRound,
  Phone,
  Sparkles,
  TriangleAlert,
  CircleCheck,
  Building2,
} from 'lucide-react';
import CustomTooltip from '@/components/custom/custom-tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import TableSearchHeader from '@/components/custom/table-search-header';
import SimpleTableFooter, { type SimplePagination } from '@/components/custom/simple-table-footer';
import { useSlidingTabIndicator } from '@/components/custom/use-sliding-tab-indicator';
import '@/components/mcm/mcm-page.css';

/**
 * Admin ▸ Call coverage.
 *
 * Which numbers and extensions would drop a call right now, and a way to fix
 * the ones that can be fixed safely.
 *
 * Every other screen in Numbers answers "what is this number set to". None of
 * them answers "would a caller get through", which is the only question that
 * matters when a number has no handling at all — those numbers look unremarkable
 * in a list and silently drop every call.
 *
 * Apply is deliberately two different writes. A number with no handling at all
 * gets the full standard. A number that already routes somewhere but never
 * catches an unanswered call gets *only* the missing voicemail added, leaving
 * its destination and hours exactly as someone set them. Nothing here replaces
 * a decision an administrator already made.
 */

const STATE_CLASS: Record<Coverage['state'], string> = {
  covered: 'tag pos',
  partial: 'tag warn',
  gap: 'tag neg',
};

/* Shown as a tooltip off the title's info icon rather than a line under it —
   see AdminPage's `titleSuffix` prop. */
const PAGE_DESCRIPTION =
  'Which numbers and extensions would drop a call right now, and what it takes to close each gap.';

type Tab = 'numbers' | 'extensions' | 'greetings';

const CallCoverage = () => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('numbers');
  const { navRef: tabsNavRef, indicatorStyle: tabsIndicatorStyle } = useSlidingTabIndicator(tab);
  const [confirming, setConfirming] = useState<{ did: any; coverage: Coverage } | null>(null);
  const [onlyGaps, setOnlyGaps] = useState(true);
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<any>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [, setGeneratedFor] = useState<string[]>([]);
  const [failedFor, setFailedFor] = useState<Record<string, string>>({});
  /* The per-page picker's dropdown menu renders into document.body by
     default, escaping the .ident-coral-theme scope below and falling back
     to react-select's plain default colors instead of this page's red
     theme — same fix as Identities & addresses' own menuPortalTarget. */
  const [menuPortalTarget, setMenuPortalTarget] = useState<HTMLDivElement | null>(null);
  const { user } = useUser();
  const { mainSiteInfo } = useOrganization();

  /* Spoken aloud, so the admin gets to set it: text-to-speech reads
     "MyCountryMobile" as one run-on word, where "My Country Mobile" is said the
     way a person would. Seeded from the tenant's own branding and remembered
     locally, because there is nowhere on the account to store it. */
  const brandFromOrg = String(
    (mainSiteInfo as any)?.source_name || (mainSiteInfo as any)?.fav_title || '',
  ).trim();
  const [companyName, setCompanyName] = useState<string>(
    () => window.localStorage.getItem('mcm-voicemail-company') || '',
  );
  const spokenCompany = companyName || brandFromOrg;

  /* These three walk every page rather than asking for one huge one: the list
     endpoints cap `limit` at 200 and reject anything larger outright, so a
     single oversized request fails instead of truncating. This screen audits
     the whole estate, so it genuinely needs all of it. */
  const {
    data: numbers = [],
    isPending: numbersLoading,
    refetch: refetchNumbers,
    isRefetching: numbersRefetching,
  } = useQuery({
    /* Shares the prefix the Numbers screens use, so applying the standard here
       refreshes those lists too. */
    queryKey: ['usedNumbersList', 'callCoverage'],
    queryFn: () => fetchAllPages(allNumbersList, { type: 'in_use' }),
  });

  const {
    data: users = [],
    isPending: usersLoading,
    refetch: refetchUsers,
    isRefetching: usersRefetching,
  } = useQuery({
    queryKey: ['fetchUsersList', 'callCoverage'],
    queryFn: () => fetchAllPages(getUserList),
  });

  const {
    data: greetings = [],
    refetch: refetchGreetings,
    isRefetching: greetingsRefetching,
  } = useQuery({
    queryKey: ['greetingList', 'callCoverage'],
    queryFn: () => fetchAllPages(getGreetings, { search: '', type: 'voicemail' }),
  });

  const { mutate: applyStandard, isPending: applying } = useMutation({
    mutationFn: callForwarding,
    onSuccess: () => {
      invalidateNumberLists(queryClient);
      handleAlert({ text: 'Standard call handling applied.', type: 'success' });
      setConfirming(null);
    },
    onError: (error: any) => {
      handleAlert({
        text: error?.response?.data?.message || 'Could not apply the standard to this number.',
        type: 'error',
      });
    },
  });

  const numberRows = useMemo(
    () => (numbers as any[]).map((did) => ({ did, coverage: evaluateNumber(did) })),
    [numbers],
  );

  const userRows = useMemo(
    () => (users as any[]).map((user) => ({ user, coverage: evaluateUser(user) })),
    [users],
  );

  const counts = useMemo(() => {
    const rows = tab === 'numbers' ? numberRows : userRows;
    return {
      total: rows.length,
      gaps: rows.filter((row) => row.coverage.state !== 'covered').length,
      fixable: rows.filter((row) => row.coverage.fixable).length,
    };
  }, [tab, numberRows, userRows]);

  const searchTerm = search.trim().toLowerCase();

  const personName = (person: any) =>
    `${person?.first_name || ''} ${person?.last_name || ''}`.trim();

  const visibleNumbers = (
    onlyGaps ? numberRows.filter((row) => row.coverage.state !== 'covered') : numberRows
  ).filter(
    ({ did }) =>
      !searchTerm ||
      String(did?.did_number || '')
        .toLowerCase()
        .includes(searchTerm) ||
      String(did?.did_name || '')
        .toLowerCase()
        .includes(searchTerm) ||
      String(assignedNameOf(did) || '')
        .toLowerCase()
        .includes(searchTerm),
  );
  const visibleUsers = (
    onlyGaps ? userRows.filter((row) => row.coverage.state !== 'covered') : userRows
  ).filter(
    ({ user: person }) =>
      !searchTerm ||
      `${person?.first_name || ''} ${person?.last_name || ''}`.toLowerCase().includes(searchTerm) ||
      String(person?.extension || '')
        .toLowerCase()
        .includes(searchTerm),
  );
  const visibleGreetingPeople = (users as any[])
    .filter((person) => personName(person))
    .filter((person) => !searchTerm || personName(person).toLowerCase().includes(searchTerm));

  const isLoading = tab === 'numbers' ? numbersLoading : usersLoading;

  /* One pagination state shared across the three tabs — each keeps its own
     page in practice since switching tabs (or narrowing the search/filter)
     resets it back to page 1, the same way TableManager's own pagination
     does. */
  const [pagination, setPagination] = useState<SimplePagination>({ pageIndex: 0, pageSize: 25 });
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [tab, search, onlyGaps]);
  const pageSlice = <T,>(rows: T[]) =>
    rows.slice(pagination.pageIndex * pagination.pageSize, (pagination.pageIndex + 1) * pagination.pageSize);
  const pagedNumbers = pageSlice(visibleNumbers);
  const pagedUsers = pageSlice(visibleUsers);
  const pagedGreetingPeople = pageSlice(visibleGreetingPeople);
  const currentTabTotal =
    tab === 'numbers'
      ? visibleNumbers.length
      : tab === 'extensions'
        ? visibleUsers.length
        : visibleGreetingPeople.length;

  const isTableRefreshing =
    tab === 'numbers' ? numbersRefetching : tab === 'extensions' ? usersRefetching : greetingsRefetching;
  const handleRefreshTable = () => {
    if (tab === 'numbers') refetchNumbers();
    else if (tab === 'extensions') refetchUsers();
    else refetchGreetings();
  };

  const confirmApply = () => {
    if (!confirming) return;
    /* A number with no handling gets the whole standard written. A number that
       already routes somewhere gets only the missing voicemail added, so its
       destination and hours survive untouched. */
    const payload =
      confirming.coverage.state === 'gap'
        ? buildNumberStandard(confirming.did)
        : buildVoicemailPatch(confirming.did);
    if (!payload) {
      handleAlert({ text: 'This number has no extension to send voicemail to.', type: 'error' });
      return;
    }
    applyStandard(payload);
  };

  const rememberCompany = (value: string) => {
    setCompanyName(value);
    try {
      window.localStorage.setItem('mcm-voicemail-company', value);
    } catch {
      /* Private browsing — the field still works for this session. */
    }
  };

  /* A person already has one when a voicemail greeting carries their name.
     Matching on name rather than an id because the greeting library has no
     link back to the person it was made for. */
  const greetingExistsFor = (person: any) => {
    const expected = voicemailGreetingName(personName(person)).slice(0, 50).toLowerCase();
    return (greetings as any[]).some(
      (greeting) => String(greeting?.name || '').toLowerCase() === expected,
    );
  };

  const runGeneration = async (people: any[]) => {
    const companyUuid = (user as any)?.company_info?.uuid;
    if (!companyUuid) {
      handleAlert({
        text: 'Could not resolve this company, so nothing was generated.',
        type: 'error',
      });
      return;
    }

    for (const person of people) {
      const name = personName(person);
      if (!name) continue;
      setGenerating(person?.uuid);
      try {
        const greeting = await generateVoicemailGreeting({
          personName: name,
          companyName: spokenCompany || undefined,
          companyUuid,
        });
        /* Generating without attaching leaves an audio file nobody hears, so
           the two steps are one action. */
        await assignVoicemailGreeting(person, greeting);
        setGeneratedFor((previous) => [...previous, person.uuid]);
        setFailedFor((previous) => {
          const next = { ...previous };
          delete next[person.uuid];
          return next;
        });
      } catch (error: any) {
        setFailedFor((previous) => ({
          ...previous,
          [person.uuid]: error?.message || 'Generation failed',
        }));
      }
    }

    setGenerating(null);
    await refetchGreetings();
    queryClient.invalidateQueries({ queryKey: ['fetchUsersList'] });
    handleAlert({ text: 'Voicemail greetings generated and assigned.', type: 'success' });
  };

  const peopleNeedingGreeting = (users as any[]).filter(
    (person) => personName(person) && !greetingExistsFor(person),
  );

  return (
    <div
      ref={setMenuPortalTarget}
      className="ident-coral-theme call-coverage-page flex min-h-0 w-full flex-1 flex-col"
    >
      <AdminPage
        section="Numbers"
        title="Call coverage"
        titleSuffix={
          <CustomTooltip
            text={PAGE_DESCRIPTION}
            side="right"
            className="w-fit max-w-[260px] whitespace-normal [text-wrap:wrap]! border-0 bg-[#fdf7f5] text-black shadow-[0_6px_20px_rgba(17,17,17,0.18)] [&_svg]:fill-[#fdf7f5]"
          >
            <Info className="h-4 w-4 text-gray-500! transition-colors hover:text-red-600! active:text-red-600! data-[state=delayed-open]:text-red-600! data-[state=instant-open]:text-red-600!" />
          </CustomTooltip>
        }
        headerTabs={
          <nav ref={tabsNavRef} className="mcm-segmented" role="group" aria-label="Call coverage views">
            <span className="ident-segmented-indicator" style={tabsIndicatorStyle} aria-hidden="true" />
            <button
              type="button"
              className={tab === 'numbers' ? 'is-active' : ''}
              onClick={() => setTab('numbers')}
            >
              Numbers
            </button>
            <button
              type="button"
              className={tab === 'extensions' ? 'is-active' : ''}
              onClick={() => setTab('extensions')}
            >
              Extensions
            </button>
            <button
              type="button"
              className={tab === 'greetings' ? 'is-active' : ''}
              onClick={() => setTab('greetings')}
            >
              Voicemail greetings
            </button>
          </nav>
        }
        beforeTable={
          <>
            {/* Stats and search each render as their own separate card here
                (outside `panel-card`), matching Identities & addresses —
                the KPI row, the search/add bar and the tabs+table each read
                as a distinct block instead of one merged container. A quick
                census above the filters, built from `counts`, the same
                numbers already driving the "N of M would drop a call" chip
                below, not separate placeholder data. */}
            {tab !== 'greetings' && (
              <div className="ident-stats-row">
                <div className="ident-stat-card">
                  <div className="ident-stat-label">
                    Total {tab === 'numbers' ? 'Numbers' : 'Extensions'}
                  </div>
                  <div className="ident-stat-value">{counts.total}</div>
                  <div className="ident-stat-caption">
                    Every {tab === 'numbers' ? 'number' : 'extension'} on this account
                  </div>
                </div>
                <div className="ident-stat-card">
                  <div className="ident-stat-label">Covered</div>
                  <div className="ident-stat-value">{counts.total - counts.gaps}</div>
                  <div className="ident-stat-caption">Answered by an extension or voicemail</div>
                </div>
                <div className="ident-stat-card">
                  <div className="ident-stat-label">Would Drop a Call</div>
                  <div className="ident-stat-value">{counts.gaps}</div>
                  <div className="ident-stat-caption">Not connected to a person or box</div>
                </div>
                <div className="ident-stat-card">
                  <div className="ident-stat-label">Fixable Now</div>
                  <div className="ident-stat-value">{counts.fixable}</div>
                  <div className="ident-stat-caption">One click away from covered</div>
                </div>
              </div>
            )}
          </>
        }
      >
        {/* The view tabs now live in the head bar (see `headerTabs`) instead
            of here beside the table. Search now sits inside this table's own
            card, above its column headers — matching the AI Receptionist
            list's table header format. */}
        <div className="ident-table-card ident-table-card--plain w-full flex flex-col">
        {/* Wrapped in the same border-b + px-3/py-2 padding TableManager
            gives its own `customHeader` (see table-manager.tsx) — without
            it the search pill sat flush against the card's edges instead
            of inset like every other Numbers table's search bar. */}
        <div className="border-b border-b-gray-200">
        <div className="px-3 py-2">
          <TableSearchHeader
            value={search}
            onChange={setSearch}
            onRefresh={handleRefreshTable}
            refreshing={isTableRefreshing}
            placeholder="Search"
            rightSlot={
              tab === 'greetings' ? (
                <>
                  <label
                    className="fchip ident-fchip border-neutral-200! bg-white! focus-within:border-[rgba(220,38,38,0.4)]!"
                    style={{ flex: '0 1 auto', minWidth: 260 }}
                  >
                    <Building2 className="h-3.5 w-3.5 flex-none" />
                    Company:
                    <input
                      value={companyName}
                      onChange={(event) => rememberCompany(event.target.value)}
                      placeholder={brandFromOrg || 'Spoken company name'}
                      aria-label="Company name spoken in the greeting"
                      size={Math.max(companyName.length, 18)}
                      style={{
                        border: 0,
                        background: 'transparent',
                        outline: 'none',
                        fontWeight: 700,
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn ident-generate-btn flex-none bg-black! text-white! hover:bg-gray-800!"
                    disabled={Boolean(generating) || !peopleNeedingGreeting.length}
                    onClick={() => runGeneration(peopleNeedingGreeting)}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {generating
                      ? 'Generating…'
                      : `Generate all missing (${peopleNeedingGreeting.length})`}
                  </button>
                  <span
                    className={`fchip ident-fchip ${peopleNeedingGreeting.length ? 'bad' : 'live'}`}
                    style={{ marginLeft: 'auto', whiteSpace: 'nowrap', flex: 'none', marginRight: 8 }}
                  >
                    <Voicemail className="h-3.5 w-3.5" />
                    <span className="num">{peopleNeedingGreeting.length}</span> without a greeting
                  </span>
                </>
              ) : (
                <>
                  <label
                    className="fchip ident-fchip"
                    style={{ marginLeft: 'auto', whiteSpace: 'nowrap', flex: 'none' }}
                  >
                    <input
                      type="checkbox"
                      checked={onlyGaps}
                      onChange={(event) => setOnlyGaps(event.target.checked)}
                    />
                    Only show gaps
                  </label>
                  <span
                    className={`fchip ident-fchip ${counts.gaps ? 'bad' : 'live'}`}
                    style={{ whiteSpace: 'nowrap', flex: 'none', marginRight: 8 }}
                  >
                    {counts.gaps ? (
                      <TriangleAlert className="h-3.5 w-3.5" />
                    ) : (
                      <CircleCheck className="h-3.5 w-3.5" />
                    )}
                    <span className="num">{counts.gaps}</span> of {counts.total} would drop a call
                  </span>
                </>
              )
            }
          />
        </div>
        </div>
        {isLoading ? (
          <div className="flex h-full w-full items-center justify-center p-8">
            <Loader variant="blue" size="lg" />
          </div>
        ) : tab === 'numbers' ? (
          <table>
            <thead>
              <tr>
                <th className="num num-left" style={{ width: '20%' }}>
                  Number
                </th>
                <th className="assigned-col" style={{ width: '20%' }}>
                  Assigned to
                </th>
                <th className="coverage-col" style={{ width: '14%' }}>
                  Coverage
                </th>
                <th className="caller-gets-col" style={{ width: '26%' }}>
                  What a caller gets
                </th>
                <th className="fix-col" style={{ width: '20%' }}>
                  Fix
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleNumbers.length ? (
                pagedNumbers.map(({ did, coverage }) => (
                  <tr key={did?.uuid || did?.did_number}>
                    <td className="num num-left">
                      <span style={{ display: 'block', fontWeight: 500 }}>
                        <NumberWithFlag number={did?.did_number} />
                      </span>
                      {did?.did_name ? (
                        <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{did.did_name}</span>
                      ) : null}
                    </td>
                    <td className="assigned-col">
                      {assignedNameOf(did) ? (
                        <>
                          <span style={{ display: 'block' }}>{assignedNameOf(did)}</span>
                          <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                            Ext {extensionOf(did) || '—'}
                          </span>
                        </>
                      ) : (
                        <span style={{ color: 'var(--ink-4)' }}>Not assigned</span>
                      )}
                    </td>
                    <td>
                      <span className={STATE_CLASS[coverage.state]}>
                        <Phone className="h-3 w-3" />
                        {coverage.headline}
                      </span>
                    </td>
                    <td className="caller-gets-col" style={{ maxWidth: 380 }}>
                      {coverage.detail}
                    </td>
                    <td className="fix-col">
                      {coverage.fixable ? (
                        <button
                          type="button"
                          className="flex items-center gap-1.5 whitespace-nowrap rounded-full border! border-[var(--accent-edge)]! bg-[var(--accent-wash)]! px-3 py-1.5 text-sm font-medium text-[var(--accent)]! hover:bg-red-100!"
                          onClick={() => setConfirming({ did, coverage })}
                          disabled={applying}
                        >
                          <Wrench className="h-3.5 w-3.5" />
                          Apply standard
                        </button>
                      ) : coverage.state === 'covered' ? (
                        <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>—</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-500">
                          <KeyRound className="h-3.5 w-3.5" />
                          Needs a decision
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>
                    <div className="empty">
                      <Ic n="check" size={28} />
                      <p>
                        {onlyGaps ? 'No numbers are dropping calls.' : 'No numbers in use yet.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : tab === 'extensions' ? (
          <table>
            <thead>
              <tr>
                <th className="num" style={{ width: '15%' }}>
                  Extension
                </th>
                <th className="name-col" style={{ width: '20%' }}>
                  Name
                </th>
                <th style={{ width: '14%' }}>Coverage</th>
                <th className="ext-caller-gets-col" style={{ width: '31%' }}>
                  What a caller gets
                </th>
                <th className="fix-col" style={{ width: '20%' }}>
                  Fix
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.length ? (
                pagedUsers.map(({ user, coverage }) => (
                  <tr key={user?.uuid}>
                    <td className="num">{user?.extension || '—'}</td>
                    <td className="name-col">
                      {`${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Unknown'}
                    </td>
                    <td>
                      <span className={STATE_CLASS[coverage.state]}>{coverage.headline}</span>
                    </td>
                    <td style={{ maxWidth: 420 }}>{coverage.detail}</td>
                    <td className="fix-col w-20">
                      <CustomTooltip
                        text={coverage.state === 'covered' ? 'Call rules' : 'Set voicemail'}
                        side="top"
                      >
                        <button
                          type="button"
                          className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-500 hover:bg-red-500 hover:text-white"
                          onClick={() => setEditingUser(user)}
                        >
                          <Voicemail className="h-4 w-4" />
                        </button>
                      </CustomTooltip>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>
                    <div className="empty">
                      <Ic n="check" size={28} />
                      <p>
                        {onlyGaps
                          ? 'Every extension catches its unanswered calls.'
                          : 'No extensions yet.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className="greetings-table">
            <thead>
              <tr>
                <th className="person-col" style={{ width: '13%' }}>
                  Person
                </th>
                <th className="extension-col" style={{ width: '11%' }}>
                  Extension
                </th>
                <th className="greeting-col" style={{ width: '12%' }}>
                  Greeting
                </th>
                <th className="hear-col" style={{ width: '49%' }}>
                  What the caller will hear
                </th>
                <th className="fix-col" style={{ width: '15%' }}>
                  Generate
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleGreetingPeople.length ? (
                pagedGreetingPeople
                  .map((person) => {
                    const has = greetingExistsFor(person);
                    const failure = failedFor[person.uuid];
                    const busy = generating === person.uuid;
                    return (
                      <tr key={person.uuid}>
                        <td className="person-col" style={{ fontWeight: 600 }}>
                          {personName(person)}
                        </td>
                        <td className="num">{person?.extension || '—'}</td>
                        <td className="greeting-col">
                          {has ? (
                            <span className="tag pos">Ready</span>
                          ) : failure ? (
                            <span className="tag neg">Failed</span>
                          ) : (
                            <span className="tag warn">Just a tone</span>
                          )}
                        </td>
                        <td
                          className="hear-col"
                          style={{ maxWidth: 420, color: 'var(--ink-3)', fontSize: 12.5 }}
                        >
                          {failure ||
                            voicemailScriptFor(personName(person), spokenCompany || undefined)}
                        </td>
                        <td className="fix-col">
                          <CustomTooltip
                            text={busy ? 'Generating…' : has ? 'Regenerate' : 'Generate'}
                            side="top"
                          >
                            <button
                              type="button"
                              className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-500 hover:bg-red-500 hover:text-white disabled:pointer-events-none disabled:opacity-50"
                              disabled={Boolean(generating)}
                              onClick={() => runGeneration([person])}
                            >
                              {busy ? (
                                <Loader variant="blue" size="sm" />
                              ) : (
                                <Sparkles className="h-4 w-4" />
                              )}
                            </button>
                          </CustomTooltip>
                        </td>
                      </tr>
                    );
                  })
              ) : (
                <tr>
                  <td colSpan={5}>
                    <div className="empty">
                      <Ic n="alert" size={28} />
                      <p>No extensions yet.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Same red-bordered notice style as All numbers' own banner, and
            positioned the same way relative to the footer: description
            first, pagination footer after it — matching the AI
            Receptionist list's own table-then-footer order. */}
        {tab === 'greetings' ? (
          <p className="mx-4 mt-4 mb-3 flex items-start gap-2 rounded-lg border border-[var(--accent-edge)] bg-[var(--accent-wash)] px-[13px] py-[10px] text-[12.5px] leading-relaxed text-[var(--ink-2)]">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-none text-[var(--accent)]" />
            <span>
              Generating rewrites the person's whole user record — test on one person before
              running it for everyone.
            </span>
          </p>
        ) : null}

        {tab === 'extensions' ? (
          <p className="mx-4 mt-4 mb-3 flex items-start gap-2 rounded-lg border border-[var(--accent-edge)] bg-[var(--accent-wash)] px-[13px] py-[10px] text-[12.5px] leading-relaxed text-[var(--ink-2)]">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-none text-[var(--accent)]" />
            <span>
              Open an extension → <strong>Incoming Calls</strong> → set{' '}
              <strong>If Busy / Unanswered / Unreachable</strong> to{' '}
              <strong>Send to Voicemail</strong>. Not bulk-applied, to avoid rewriting each
              person's whole record.
            </span>
          </p>
        ) : null}

        {(tab === 'greetings' || tab === 'extensions') && (
          <div className="border-t border-[#f0f0f0]" />
        )}

        {!isLoading && currentTabTotal > 0 && (
          <SimpleTableFooter
            totalItems={currentTabTotal}
            pagination={pagination}
            onPaginationChange={setPagination}
            menuPortalTarget={menuPortalTarget}
          />
        )}
        </div>
      </AdminPage>

      {editingUser ? (
        <Dialog
          open={Boolean(editingUser)}
          onOpenChange={(open) => {
            if (open) return;
            setEditingUser(null);
            queryClient.invalidateQueries({ queryKey: ['fetchUsersList'] });
          }}
        >
          <DialogContent
            showCloseButton={false}
            onPointerDownOutside={(e) => e.preventDefault()}
            className="ident-form-popup flex max-h-[88vh] w-full flex-col gap-4 overflow-hidden p-6 sm:max-w-2xl lg:max-w-3xl"
          >
            <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0">
              <DialogTitle className="popup-title">Call rules</DialogTitle>
              <button
                type="button"
                onClick={() => {
                  setEditingUser(null);
                  queryClient.invalidateQueries({ queryKey: ['fetchUsersList'] });
                }}
                aria-label="Close"
                className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full text-gray-500 hover:bg-red-50 hover:text-black"
              >
                <Icon name="CloseIcon" className="h-3 w-4" />
              </button>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <UpdateForwarding
                drawerState
                setDrawerState={() => {
                  setEditingUser(null);
                  queryClient.invalidateQueries({ queryKey: ['fetchUsersList'] });
                }}
                data={editingUser}
                setTabData={() => undefined}
              />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      {confirming ? (
        <Dialog open={Boolean(confirming)} onOpenChange={(open) => !open && setConfirming(null)}>
          <DialogContent
            showCloseButton={false}
            className="ident-form-popup flex max-h-[88vh] w-full flex-col gap-4 overflow-hidden p-6 sm:max-w-2xl lg:max-w-3xl"
          >
            <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0">
              <DialogTitle className="popup-title">Apply standard call handling</DialogTitle>
              <button
                type="button"
                onClick={() => setConfirming(null)}
                aria-label="Close"
                className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full text-gray-500 hover:bg-red-50 hover:text-black"
              >
                <Icon name="CloseIcon" className="h-3 w-4" />
              </button>
            </DialogHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-0.5">
              <p style={{ color: 'var(--ink-2)' }}>
                This writes call handling to <strong>{confirming.did.did_number}</strong>, which{' '}
                {confirming.coverage.state === 'gap'
                  ? 'currently drops every call'
                  : 'currently drops any call that is not answered'}
                . Callers will follow this path:
              </p>

              <div className="mcm-flowpath">
                {describeStandard(confirming.did).map((step, index, all) => (
                  <span key={step} className="mcm-flowstep">
                    <span className={index === all.length - 1 ? 'chip end' : 'chip'}>{step}</span>
                    {index < all.length - 1 ? <span className="arw">→</span> : null}
                  </span>
                ))}
              </div>

              <ul className="mcm-flowfacts">
                <li>
                  Hours are set to <strong>24 hours</strong>. Weekly hours need a closed-hours
                  branch to be safe, and guessing your opening times would be inventing policy.
                </li>
                <li>
                  An unanswered or rejected call goes to <strong>voicemail</strong> on that
                  extension. This is the part the number wizard never saved, which is why calls rang
                  out into silence.
                </li>
                <li>
                  Nothing else on this number changes, and no number that already has handling is
                  touched.
                </li>
              </ul>
            </div>
            <div className="flex flex-none items-center justify-end gap-2 border-t border-gray-200 pt-3">
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-black hover:bg-gray-100"
                onClick={() => setConfirming(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-full border border-black bg-black px-5 py-2 text-sm font-medium text-white hover:bg-gray-800"
                onClick={confirmApply}
                disabled={applying}
              >
                {applying ? 'Applying…' : 'Apply to this number'}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
};

export default CallCoverage;
