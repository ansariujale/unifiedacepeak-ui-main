import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  Check,
  ChevronDown,
  Eye,
  RefreshCcw,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import moment from 'moment';

import TableManager from '@/components/custom/table-manager';
import AlertConfirm from '@/components/custom/alert-confirm';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import CustomTooltip from '@/components/custom/custom-tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Ic, McmIconSprite } from '@/components/mcm/icons';
import { capitalizeFirstLetter, convertDateFormateApis, handleAlert } from '@/lib/utils';
import { campaignAnalytics, campaignList, deleteCampaign, playPauseCampaign } from '@/services/api';
import { useCompanyFeatures } from '@/hooks/rbac';
import useDebounce from '@/hooks/use-debounce';
import type { IAutoDialer } from '../power-predictive/campaign-list';

import AddEditCampaign from './add-edit-campaign';
import AgentDetailsModal from './modal/agent-details-modal';
import { DIALER_TYPE } from './add-edit-campaign/consts';
import {
  DIAL_METHOD_LABEL,
  OutcomeBar,
  OutcomeLegend,
  StatusPill,
  fmt,
  num,
  pct,
  readOutcomes,
} from './campaign-ui';
import '@/components/mcm/mcm-page.css';
import './campaign.css';

/**
 * MCM Unified Console — Campaigns.
 *
 * Ported from the design artifact's outbound module. The artifact's argument
 * is that a campaign row is an object you operate, not a record you read: the
 * four contact outcomes sit on every row rather than behind a popover, and the
 * transport controls are on the row itself.
 *
 * Every figure comes from `campaignAnalytics`, which is what the platform
 * actually measures today. The artifact also showed pacing — abandon rate
 * against a compliance cap, idle and effective-idle agents, outbound line
 * allocation, adjusted calls per agent. None of those exist in any current
 * endpoint, so they are not drawn here; the panel footer says so rather than
 * showing a plausible number nobody computed.
 */

export interface ModalState {
  open: boolean;
  data: any[];
  type: string | null;
}

/* TEMP: sample rows for reviewing the table with the account empty.
   Mimics the real API's response shape (rather than TableManager's
   `staticData` escape hatch, which leaves the footer's record count
   and page-number pager broken) so those keep working correctly.
   Remove this function and go back to `fetcherFn: campaignList` once
   real data exists. */
const fetchDummyCampaigns = () =>
  Promise.resolve({
    data: {
      data: {
        result: {
          totalItems: 3,
          totalPages: 1,
          rows: [
            {
              _id: 'dummy-1',
              name: 'Spring promo outreach',
              dialMethod: 'PREVIEW',
              createdAt: '2026-08-20T10:00:00.000Z',
              startDate: '2026-08-28T00:00:00.000Z',
              endDate: '2026-09-28T00:00:00.000Z',
              campaignStatus: 'PROCESSING',
              members: JSON.stringify([
                { user_uuid: 'u1', label: 'Kiran Yadav' },
                { user_uuid: 'u2', label: 'Lisa' },
              ]),
              campaignAnalytics: {
                assignedLeads: 420,
                dialedLeads: 260,
                answeredLeads: 140,
                totalCallNotAnswered: 90,
                totalDnc: 30,
              },
            },
            {
              _id: 'dummy-2',
              name: 'Renewal reminders',
              dialMethod: 'PREDICTIVE',
              createdAt: '2026-08-12T10:00:00.000Z',
              startDate: '2026-08-15T00:00:00.000Z',
              endDate: '2026-09-15T00:00:00.000Z',
              campaignStatus: 'PAUSE',
              members: JSON.stringify([{ user_uuid: 'u3', label: 'Alex Dunphy' }]),
              campaignAnalytics: {
                assignedLeads: 180,
                dialedLeads: 180,
                answeredLeads: 96,
                totalCallNotAnswered: 60,
                totalDnc: 24,
              },
            },
            {
              _id: 'dummy-3',
              name: 'Welcome call series',
              dialMethod: 'NORMAL',
              createdAt: '2026-09-01T10:00:00.000Z',
              startDate: '2026-09-05T00:00:00.000Z',
              endDate: '2026-10-05T00:00:00.000Z',
              campaignStatus: 'NEW',
              members: JSON.stringify([]),
              campaignAnalytics: {
                assignedLeads: 60,
                dialedLeads: 0,
                answeredLeads: 0,
                totalCallNotAnswered: 0,
                totalDnc: 0,
              },
            },
          ],
        },
      },
    },
  });

const STATUS_FILTERS: Array<[string, string]> = [
  ['ALL', 'All'],
  ['PROCESSING', 'Running'],
  ['PAUSE', 'Paused'],
  ['NEW', 'Scheduled'],
  ['COMPLETED', 'Completed'],
];

/* Dialling mode moved out of the chip row and into a single dropdown: four
   chips for a one-of-four choice read as four independent toggles, and they
   pushed the row onto a second line at ordinary widths. The values are the
   same `dialMethod` codes the list query already filters on. */
const MODE_FILTERS: Array<[string, string]> = [
  ['ALL', 'All modes'],
  [DIALER_TYPE.PREDICTIVE, 'Predictive'],
  [DIALER_TYPE.NORMAL, 'Progressive'],
  [DIALER_TYPE.PREVIEW, 'Preview'],
];

/**
 * `embedded` is set when Performance -> Campaigns renders this list beneath its
 * own stat cards. In that case the page title and the KPI strip would be a
 * second header and a second set of totals on the same screen, so both are
 * dropped and the frame stops claiming full height.
 */
const Campaign = ({ embedded = false }: { embedded?: boolean }) => {
  const navigate = useNavigate();
  const queryClient: any = useQueryClient();
  const { features } = useCompanyFeatures();
  const campaignAccess = features?.plan_features?.campaign?.action;

  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [modeFilter, setModeFilter] = useState<string>('ALL');
  const debouncedSearch = useDebounce(search, 1000);
  const campaignTableRef = useRef<any>(null);

  const [modalState, setModalState] = useState<ModalState>({ open: false, type: null, data: [] });
  const [drawerState, setDrawerState] = useState<{ isModalOpen: boolean; selectedCampaign: any }>({
    isModalOpen: false,
    selectedCampaign: null,
  });
  const [refreshingCampaignIds, setRefreshingCampaignIds] = useState<Record<string, boolean>>({});
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState<IAutoDialer | null>(null);

  /* ── aggregates for the KPI strip ────────────────────────────────────
     The table is paginated, so totals cannot come from the visible page.
     This pulls the campaign set once and counts it, the same way the
     inventory pages pull their full list for a summary. */
  const { data: allCampaigns = [], isLoading: isLoadingKpis } = useQuery({
    queryKey: ['campaignListForKpis'],
    enabled: !embedded,
    queryFn: () =>
      campaignList({ page: 1, limit: 500, filters: [], sort: { key: 'createdAt', desc: true } }),
    select: (data: any) => data?.data?.data?.result?.rows || [],
    refetchOnWindowFocus: false,
  });

  const kpis = useMemo(() => {
    const rows: any[] = Array.isArray(allCampaigns) ? allCampaigns : [];
    const byStatus = (status: string) =>
      rows.filter((r) => String(r?.campaignStatus).toUpperCase() === status).length;

    const totals = rows.reduce(
      (acc, row) => {
        const o = readOutcomes(row?.campaignAnalytics);
        acc.assigned += o.assigned;
        acc.answered += o.answered;
        acc.noAnswer += o.noAnswer;
        acc.dnc += o.dnc;
        acc.pending += o.pending;
        acc.dialed += o.dialed;
        return acc;
      },
      { assigned: 0, answered: 0, noAnswer: 0, dnc: 0, pending: 0, dialed: 0 },
    );

    return {
      total: rows.length,
      running: byStatus('PROCESSING'),
      paused: byStatus('PAUSE'),
      scheduled: byStatus('NEW'),
      completed: byStatus('COMPLETED'),
      ...totals,
    };
  }, [allCampaigns]);

  /* ── mutations ────────────────────────────────────────────────────── */
  const invalidateCampaigns = () => {
    queryClient.invalidateQueries(['getCampaignList']);
    queryClient.invalidateQueries({ queryKey: ['getCampaignListForPreview'] });
    queryClient.invalidateQueries({ queryKey: ['campaignListForKpis'] });
  };

  const { mutate: mutateStatus } = useMutation({
    mutationFn: playPauseCampaign,
    onSuccess: (data: any, variables: any) => {
      if (data?.status !== 200) return;
      invalidateCampaigns();
      if (variables?.campaignStatus === 'RESCHEDULED') {
        handleAlert({ text: 'Campaign has been rescheduled successfully', type: 'success' });
      }
    },
  });

  const { mutate: mutateDeleteCampaign, isPending: isPendingDeleteCampaign } = useMutation({
    mutationFn: deleteCampaign,
    onSuccess: (data: any) => {
      if (!data?.data?.success) return;
      handleAlert({
        text: data?.data?.message || 'Campaign Deleted Successfully!',
        type: 'success',
      });
      setShowDeleteConfirmation(null);
      invalidateCampaigns();
    },
  });

  const { mutate: mutateCampaignAnalytics } = useMutation({
    mutationFn: campaignAnalytics,
    onSuccess: (response: any, variables: any) => {
      const analytics = response?.data?.data?.result;
      const campaignId = variables?.campaignId;
      if (!analytics || !campaignId) return;

      queryClient.setQueriesData({ queryKey: ['getCampaignListForPreview'] }, (oldData: any) => {
        const existing = oldData?.data?.data?.result;
        if (!existing) return oldData;
        const rows = Array.isArray(existing?.rows) ? existing.rows : [];
        return {
          ...oldData,
          data: {
            ...oldData.data,
            data: {
              ...oldData.data.data,
              result: {
                ...existing,
                rows: rows.map((c: any) =>
                  c?._id === campaignId ? { ...c, campaignAnalytics: analytics } : c,
                ),
              },
            },
          },
        };
      });
    },
    onSettled: (_data, _error, variables: any) => {
      const campaignId = variables?.campaignId;
      if (campaignId) setRefreshingCampaignIds((prev) => ({ ...prev, [campaignId]: false }));
    },
  });

  /* ── row actions ──────────────────────────────────────────────────── */
  const onPlayPause = (data: any) =>
    mutateStatus({
      campaignId: data?._id,
      campaignStatus: data?.campaignStatus === 'PROCESSING' ? 'PAUSE' : 'PROCESSING',
    });

  const onReSchedule = (data: any) =>
    mutateStatus({ campaignId: data?._id, campaignStatus: 'RESCHEDULED' });

  const handleNavigateToCallLogs = (type: string, data: any) =>
    navigate('/campaign/all-campaigns/compaign-call-logs', { state: { type, data } });

  const openMonitor = (data: any) =>
    navigate('/campaign/all-campaigns/compaign-record', {
      state: { campaignDetails: data, campaignId: data?._id },
    });

  /* ── columns ──────────────────────────────────────────────────────── */
  const columns: any = [
    {
      header: 'Campaign',
      accessorKey: 'name',
      cell: ({ row }: any) => {
        const data = row?.original || {};
        const mode = DIAL_METHOD_LABEL[data?.dialMethod];
        return (
          <div className="cid">
            <div style={{ minWidth: 0 }}>
              <div className="cname" title={capitalizeFirstLetter(data?.name)}>
                <span>{capitalizeFirstLetter(data?.name)}</span>
                {mode ? <span className="tag neu">{mode}</span> : null}
              </div>
              {data?.createdAt ? (
                <div className="cmeta">
                  <span>Created {convertDateFormateApis(data.createdAt, 'DD MMM YYYY')}</span>
                </div>
              ) : null}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Window',
      accessorKey: 'startDate',
      cell: ({ row }: any) => {
        const data = row?.original || {};
        if (!data?.startDate && !data?.endDate) {
          return <span style={{ color: 'var(--ink-4)' }}>—</span>;
        }
        return (
          <span className="win">
            <span className="num">
              {convertDateFormateApis(data?.startDate, 'DD MMM')} –{' '}
              {convertDateFormateApis(data?.endDate, 'DD MMM')}
            </span>
          </span>
        );
      },
    },
    {
      header: 'Leads',
      accessorKey: 'totalCount',
      cell: ({ row }: any) => {
        const count = num(row?.original?.campaignAnalytics?.assignedLeads);
        if (!count) return <span style={{ color: 'var(--ink-4)' }}>—</span>;
        return (
          <button
            type="button"
            className="lnk num"
            style={{ fontWeight: 800 }}
            onClick={(event) => {
              event.stopPropagation();
              handleNavigateToCallLogs('ALL', row?.original);
            }}
          >
            {fmt(count)}
          </button>
        );
      },
    },
    {
      header: 'Contact outcomes',
      accessorKey: 'campaignAnalytics',
      enableSorting: false,
      cell: ({ row }: any) => {
        const data = row?.original || {};
        const campaignId = data?._id;
        const isRefreshing = !!refreshingCampaignIds[campaignId];
        return (
          <div className="outcell">
            <div className="outcell-bar">
              <OutcomeBar analytics={data?.campaignAnalytics} />
            </div>
            <CustomTooltip text="Refresh analytics" side="top">
              <button
                type="button"
                className="mini ico"
                aria-label="Refresh analytics"
                disabled={isRefreshing || !campaignId}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!campaignId || isRefreshing) return;
                  setRefreshingCampaignIds((prev) => ({ ...prev, [campaignId]: true }));
                  mutateCampaignAnalytics({ campaignId });
                }}
              >
                <Ic n="refresh" size={12} className={isRefreshing ? 'pulsing' : ''} />
              </button>
            </CustomTooltip>
          </div>
        );
      },
    },
    {
      header: 'Answered',
      accessorKey: 'answeredPercentage',
      enableSorting: false,
      cell: ({ row }: any) => {
        const { answered, dialed } = readOutcomes(row?.original?.campaignAnalytics);
        if (!dialed) return <span style={{ color: 'var(--ink-4)' }}>—</span>;
        return (
          <button
            type="button"
            className="lnk num"
            style={{ fontWeight: 800, fontSize: 13 }}
            onClick={(event) => {
              event.stopPropagation();
              handleNavigateToCallLogs('COMPLETED', row?.original);
            }}
          >
            {pct(answered, dialed)}%
          </button>
        );
      },
    },
    {
      header: 'Agents',
      accessorKey: 'members',
      cell: ({ getValue }: any) => {
        let members: any[] = [];
        try {
          const raw = getValue();
          const parsed = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw;
          members = Array.isArray(parsed)
            ? Array.from(new Map(parsed.map((item: any) => [item?.user_uuid, item])).values())
            : [];
        } catch {
          members = [];
        }

        if (!members.length) return <span style={{ color: 'var(--ink-4)' }}>Unassigned</span>;

        return (
          <CustomTooltip
            side="top"
            className="max-w-xs"
            text={
              <div className="flex flex-col gap-1 max-w-xs">
                <div className="font-semibold text-sm mb-1">
                  {members.length} {members.length === 1 ? 'member' : 'members'}
                </div>
                <div className="text-xs max-h-40 overflow-y-auto">
                  {members.map((item: any, index: number) => (
                    <div key={index} className="py-1 border-b border-gray-300 last:border-0">
                      {item?.label ||
                        `${item?.first_name || ''} ${item?.last_name || ''}`.trim() ||
                        'Unknown'}
                    </div>
                  ))}
                </div>
              </div>
            }
          >
            <button
              type="button"
              className="lnk num"
              style={{ fontWeight: 800 }}
              onClick={(event) => {
                event.stopPropagation();
                setModalState({ open: true, type: 'members', data: members });
              }}
            >
              {members.length}
            </button>
          </CustomTooltip>
        );
      },
    },
    {
      header: 'Status',
      accessorKey: 'campaignStatus',
      cell: ({ row }: any) => <StatusPill status={row?.original?.campaignStatus} />,
    },
    {
      header: 'Actions',
      accessorKey: 'action',
      enableSorting: false,
      cell: ({ row }: any) => {
        const data = row?.original || {};
        const now = moment();
        const start = data?.startDate ? moment.utc(data.startDate).local() : null;
        const end = data?.endDate ? moment.utc(data.endDate).local() : null;
        const outOfWindow =
          data?.campaignStatus === 'COMPLETED' ||
          (!!start && now.isBefore(start, 'day')) ||
          (!!end && now.isAfter(end, 'day'));
        const isExpired = !!(end && now.isAfter(end, 'day'));
        const canReschedule = data?.campaignStatus !== 'COMPLETED' && isExpired;
        const isRunning = data?.campaignStatus === 'PROCESSING';
        const isPaused = data?.campaignStatus === 'PAUSE';

        /* The transport control is the one action a row is usually opened for,
           so it stays a labelled button; the other four move behind ⋯ rather
           than crowding five identical icon squares into the last column.
           The menu icons are lucide, not the page sprite: the menu renders
           through a portal, outside `.mcm-page`, where the sprite's stroke
           styling does not reach and its glyphs would fill solid black. */
        const menu = [
          campaignAccess?.summary && {
            key: 'monitor',
            Icon: Eye,
            label: 'Open live monitor',
            run: () => openMonitor(data),
          },
          campaignAccess?.pause && {
            key: 'reschedule',
            Icon: CalendarClock,
            label: 'Reschedule campaign',
            disabled: !canReschedule,
            run: () => onReSchedule(data),
          },
          campaignAccess?.edit && {
            key: 'edit',
            Icon: SlidersHorizontal,
            label: 'Edit campaign',
            disabled: isRunning || outOfWindow,
            run: () => setDrawerState({ selectedCampaign: data, isModalOpen: true }),
          },
          campaignAccess?.delete && {
            key: 'delete',
            Icon: Trash2,
            label: 'Delete campaign',
            disabled: isRunning,
            danger: true,
            run: () => setShowDeleteConfirmation(data),
          },
        ].filter(Boolean) as Array<{
          key: string;
          Icon: typeof Eye;
          label: string;
          disabled?: boolean;
          danger?: boolean;
          run: () => void;
        }>;

        return (
          <div className="rowacts" onClick={(event) => event.stopPropagation()}>
            {campaignAccess?.pause && (
              <button
                type="button"
                className="btn run"
                disabled={outOfWindow}
                onClick={() => !outOfWindow && onPlayPause(data)}
                aria-label={isRunning ? 'Pause campaign' : isPaused ? 'Resume campaign' : 'Start campaign'}
                title={isRunning ? 'Pause' : isPaused ? 'Resume' : 'Start'}
              >
                <Ic n={isRunning ? 'pause' : 'play'} />
              </button>
            )}
            {menu.length ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="mini dots" aria-label="More actions">
                    <Ic n="more" size={15} fill />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={6} className="cmp-menu w-52">
                  {menu.map((item) => (
                    <DropdownMenuItem
                      key={item.key}
                      disabled={item.disabled}
                      variant={item.danger ? 'destructive' : 'default'}
                      onSelect={item.run}
                    >
                      <item.Icon />
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        );
      },
    },
  ];

  const KPI_CARDS = [
    {
      key: 'live',
      icon: 'mega' as const,
      label: 'Live campaigns',
      value: (
        <>
          {kpis.running}
          <small> / {kpis.total}</small>
        </>
      ),
      sub: `${kpis.paused} paused · ${kpis.scheduled} scheduled`,
      tone: 'accentv' as const,
    },
    {
      key: 'leads',
      icon: 'users' as const,
      label: 'Leads assigned',
      value: fmt(kpis.assigned),
      sub: `${fmt(kpis.pending)} still callable`,
    },
    {
      key: 'dialed',
      icon: 'phone' as const,
      label: 'Dialled',
      value: fmt(kpis.dialed),
      sub: `${pct(kpis.dialed, kpis.assigned)}% of assigned`,
    },
    {
      key: 'answered',
      icon: 'check' as const,
      label: 'Answered',
      value: `${pct(kpis.answered, kpis.dialed)}%`,
      sub: `${fmt(kpis.answered)} connects`,
      tone: 'good' as const,
    },
    {
      key: 'noanswer',
      icon: 'miss' as const,
      label: 'No answer',
      value: `${pct(kpis.noAnswer, kpis.dialed)}%`,
      sub: fmt(kpis.noAnswer),
    },
    {
      key: 'dnc',
      icon: 'shield' as const,
      label: 'DNC / blocked',
      value: `${pct(kpis.dnc, kpis.dialed)}%`,
      sub: fmt(kpis.dnc),
      tone: kpis.dnc > 0 ? ('bad' as const) : undefined,
    },
  ];

  return (
    <div className={`mcm-page cmp${embedded ? ' embedded' : ''}`}>
      <McmIconSprite />
      <div className="page">
        {!embedded && (
          <div className="page-head">
            <div className="page-head-copy">
              <div className="eyebrow">Campaign</div>
              <div className="page-head-title-row">
                <h1>Campaigns</h1>
                <CustomTooltip
                  side="bottom"
                  className="bg-gray-200/70 text-black"
                  text="Every outbound campaign — contact outcomes and agent load in one line."
                >
                  <span className="head-info" aria-label="About this page">
                    <Ic n="info" />
                  </span>
                </CustomTooltip>
              </div>
            </div>
            {/* The pair is one flex item, so when the header runs out of room
                they wrap together onto a second row instead of being pushed
                past its edge. */}
            <div className="page-head-actions">
              <button
                className="btn ghost"
                type="button"
                onClick={() => navigate('/campaign/leads')}
              >
                <Ic n="users" />
                Lead groups
              </button>
              {campaignAccess?.add && (
                <button
                  className="btn primary"
                  type="button"
                  onClick={() => setDrawerState({ selectedCampaign: null, isModalOpen: true })}
                >
                  <Ic n="plus" />
                  New campaign
                </button>
              )}
            </div>
          </div>
        )}

        {!embedded && (
          <div className="kpis-panel">
            <div className="kpis-panel-head">
              <span>Overview</span>
              <span className="kpis-panel-line" />
            </div>
            <div className="kpis">
              {KPI_CARDS.map((kpi) => (
                <div className="kpi" key={kpi.key}>
                  <div className="k">
                    <span className="kico" aria-hidden="true">
                      <Ic n={kpi.icon} />
                    </span>
                    {kpi.label}
                  </div>
                  <div className={`v num${kpi.tone ? ` ${kpi.tone}` : ''}`}>
                    {isLoadingKpis ? (
                      <span className="skel" style={{ display: 'block', width: 62, height: 24 }} />
                    ) : (
                      kpi.value
                    )}
                  </div>
                  <div className="d">{kpi.sub}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="tbl-panel-head">
          <span>All campaigns</span>
          <span className="tbl-panel-line" />
          <span className="src live pc-right">
            <Ic n="spark" size={10} />
            live
          </span>
        </div>

        <div className="panel-card">
          <div className="pc-head">
            <div className="tbar">
              <div className="cmp-search">
                <span className="cmp-search-ico" aria-hidden="true">
                  <Ic n="search" />
                </span>
                <input
                  placeholder="Search campaigns"
                  aria-label="Search campaigns"
                  value={search}
                  maxLength={50}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value.startsWith(' ')) return;
                    setSearch(value);
                  }}
                />
              </div>

              <button
                type="button"
                className="mini ico tbar-refresh"
                aria-label="Refresh campaigns"
                onClick={() => campaignTableRef.current?.refetchTable()}
              >
                <RefreshCcw className="w-4 h-4" />
              </button>

              <div className="fchip-group">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="fchip modesel">
                      {statusFilter !== 'ALL'
                        ? STATUS_FILTERS.find(([value]) => value === statusFilter)?.[1]
                        : 'Status'}
                      {statusFilter !== 'ALL' && <span className="status-active-dot" />}
                      <ChevronDown size={14} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="bottom"
                    align="start"
                    sideOffset={6}
                    collisionPadding={12}
                    className="cmp-menu w-40"
                  >
                    {STATUS_FILTERS.map(([value, label]) => (
                      <DropdownMenuItem
                        key={value}
                        className={statusFilter === value ? 'is-selected' : undefined}
                        onSelect={() => setStatusFilter(value)}
                      >
                        <span className="menu-item-check">
                          {statusFilter === value && <Check size={14} />}
                        </span>
                        <span className="menu-item-dot">
                          {value === 'PROCESSING' && <span className="dot green" />}
                        </span>
                        {label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="fchip modesel">
                      {MODE_FILTERS.find(([value]) => value === modeFilter)?.[1] || 'All modes'}
                      <ChevronDown size={14} />
                    </button>
                  </DropdownMenuTrigger>
                  {/* Opens below the trigger and is kept on screen: collision
                      handling shifts it inward near a viewport edge, which is what
                      keeps it visible on narrow screens. The panel is four rows
                      tall, so on any realistic viewport there is room below and it
                      does not flip up over the stats. */}
                  <DropdownMenuContent
                    side="bottom"
                    align="start"
                    sideOffset={6}
                    collisionPadding={12}
                    className="cmp-menu w-44"
                  >
                    {MODE_FILTERS.map(([value, label]) => (
                      <DropdownMenuItem
                        key={value}
                        className={modeFilter === value ? 'is-selected' : undefined}
                        onSelect={() => setModeFilter(value)}
                      >
                        <span className="menu-item-check">
                          {modeFilter === value && <Check size={14} />}
                        </span>
                        {label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          <TableManager
            {...{
              tableRef: campaignTableRef,
              columns,
              fetcherKey: 'getCampaignListForPreview',
              fetcherFn: fetchDummyCampaigns,
              emptyTablePlaceholder: 'No campaigns found',
              descriptionEmptyTable: 'Create a campaign to start dialling',
              getRowClassName: () => 'rowlink',
              extraParams: {
                ...(debouncedSearch ? { search: debouncedSearch } : {}),
                filters: [
                  ...(modeFilter !== 'ALL' ? [{ key: 'dialMethod', value: modeFilter }] : []),
                  ...(statusFilter !== 'ALL'
                    ? [{ key: 'campaignStatus', value: statusFilter }]
                    : []),
                ],
                sort: { key: 'createdAt', desc: true },
              },
              customClass: 'w-full',
              pagerAccentClassName: 'bg-red-600 text-white border-red-600',
              hideFooterRefresh: true,
            }}
          />

          <div className="pc-foot">
            <OutcomeLegend />
            <span className="pc-right">
              Pacing metrics — abandon rate, idle agents, line allocation — need a live campaign
              stats endpoint that does not exist yet.
            </span>
          </div>
        </div>
      </div>

      {/* A centred modal rather than the full-height side panel this used to
          open in. The panel is what forced the form to fill the screen; the
          modal sizes to its content and caps at 90vh. */}
      <Dialog
        open={!!drawerState?.isModalOpen}
        onOpenChange={(open) => {
          if (!open) setDrawerState({ selectedCampaign: null, isModalOpen: false });
        }}
      >
        <DialogContent className="acp-modal" showCloseButton={false}>
          <AddEditCampaign
            drawerState={drawerState?.isModalOpen}
            setDrawerState={() => setDrawerState({ selectedCampaign: null, isModalOpen: false })}
            selectedCampaign={drawerState?.selectedCampaign}
          />
        </DialogContent>
      </Dialog>

      {modalState?.open && (
        <AgentDetailsModal modalState={modalState} setModalState={setModalState} />
      )}

      {!!showDeleteConfirmation && (
        <AlertConfirm
          {...{
            apiLoading: isPendingDeleteCampaign,
            onConfirm: () => mutateDeleteCampaign(showDeleteConfirmation?._id),
            open: !!showDeleteConfirmation,
            setOpen: () => setShowDeleteConfirmation(null),
          }}
        />
      )}
    </div>
  );
};

export default Campaign;
