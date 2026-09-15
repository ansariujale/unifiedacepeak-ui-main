import NumberWithFlag from '@/components/custom/number-with-flag';
import { parseForwardActions } from '@/lib/call-standard';
import TableManager from '@/components/custom/table-manager';
import TableSearchHeader from '@/components/custom/table-search-header';
import { useSlidingTabIndicator } from '@/components/custom/use-sliding-tab-indicator';
import { AdminPage } from '@/pages/admin-settings/page-shell';
import { useUser } from '@/hooks/use-user';
import { capitalizeFirstLetter, handleAlert } from '@/lib/utils';
import {
  allNumbersList,
  releasedNumbersList,
  releaseDidToCarrier,
  removeAssignNumber,
  removeForwarding,
} from '@/services/api';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from '@/assets/icons';
import UpsertCallForwarding from '../set-number-forwarding';
import AssignDIDNumber from '../assign-did';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AlertConfirm from '@/components/custom/alert-confirm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CustomTooltip from '@/components/custom/custom-tooltip';
import {
  Info,
  Hash,
  GitBranch,
  CheckCircle2,
  CircleSlash,
  Archive,
  Trash2,
  Phone,
  type LucideIcon,
} from 'lucide-react';
import { Icon, IconName } from '@/assets/icons/icon';
import { useCompanyFeatures } from '@/hooks/rbac';
import AddNumber from '../all-numbers/add-number-new';
import {
  FORWARD_TYPES_WITH_EXTENSION,
  FORWARD_TYPES_WITH_NAME,
  FORWARD_TYPES_WITH_PHONE,
  getDidTypeLabel,
} from '../utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { invalidateNumberLists } from '@/lib/number-list-cache';
import { featuresLookUp, featuresObj } from '../all-numbers/constants';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { canEditLabel, labelOf } from '@/lib/number-labels';
import EditNumberLabel from '../edit-label';
import NumbersByLine from '../by-line';

/* One screen, three views.

   "All numbers", "Numbers in use" and "Unused numbers" were three separate
   pages running the same query against the same endpoint, with the same
   columns, the same four actions and the same three confirmation dialogs —
   about 1,600 lines that differed by one request parameter and whether the
   Features column was shown. They drifted, as duplicated screens do: one of
   them shipped a column headed "Number/Name1", and only one carried the
   defensive parse that stops a single malformed row blanking the table.

   They are one component now, and the view is read from the URL the way the
   Identities / Addresses / Verifications tabs already work here. Each view
   keeps its own address so it can still be linked to and bookmarked. */

type ViewKey = 'all' | 'in-use' | 'inventory' | 'released' | 'by-line';

interface NumberView {
  key: ViewKey;
  tab: string;
  /* Leading icon on the view's tab pill, matching the Identities/Addresses/
     Verifications tab strip these views already borrow their look from. */
  icon: LucideIcon;
  path: string;
  title: string;
  description: string;
  fetcherKey: string;
  extraParams?: Record<string, string>;
  /* Only the unfiltered view shows Features; the other two were built without
     it and adding it there would be a change of behaviour, not a merge. */
  showFeatures: boolean;
  /* Unused numbers are, by definition, not ones you buy more of from here. */
  showAddNumber: boolean;
  emptyDescription?: string;
  /* Released numbers are an archive, not live inventory: they come from a
     different table, have no owner to act on, and carry no row actions. */
  isArchive?: boolean;
  /* Not a filter of the same table but a different shape entirely: the numbers
     gathered under the shared line each one rings. */
  isGrouped?: boolean;
}

const VIEWS: Record<ViewKey, NumberView> = {
  all: {
    key: 'all',
    tab: 'All numbers',
    icon: Hash,
    path: '/admin-settings/numbers/all',
    title: 'All numbers',
    description: 'Every number on the account, whether it is assigned, routed or sitting unused.',
    fetcherKey: 'allNumbersList',
    showFeatures: false,
    showAddNumber: true,
  },
  'by-line': {
    key: 'by-line',
    tab: 'By line',
    icon: GitBranch,
    path: '/admin-settings/numbers/by-line',
    title: 'Numbers by line',
    description:
      'The numbers that ring each department, queue and menu, with what each one is called.',
    fetcherKey: 'numbersByLine',
    showFeatures: false,
    showAddNumber: false,
    isGrouped: true,
  },
  'in-use': {
    key: 'in-use',
    tab: 'In use',
    icon: CheckCircle2,
    path: '/admin-settings/numbers/in-use',
    title: 'Numbers in use',
    description:
      'Numbers assigned to a person, a group or a call flow — and what each one routes to.',
    fetcherKey: 'usedNumbersList',
    extraParams: { type: 'in_use' },
    showFeatures: false,
    showAddNumber: true,
    emptyDescription: 'Numbers assigned to users, departments, or call flows will appear here.',
  },
  inventory: {
    key: 'inventory',
    tab: 'Unused',
    icon: CircleSlash,
    path: '/admin-settings/numbers/inventory',
    title: 'Unused numbers',
    description: 'Numbers you own that are not assigned to anyone and have no call forwarding set.',
    fetcherKey: 'inventoryNumbersList',
    extraParams: { type: 'inventory' },
    showFeatures: false,
    showAddNumber: false,
    emptyDescription: 'Numbers you own but have not assigned or forwarded will appear here.',
  },
  released: {
    key: 'released',
    tab: 'Released',
    icon: Archive,
    path: '/admin-settings/numbers/released',
    title: 'Released numbers',
    description:
      'Numbers that have left the account, and who held them last — so a number that went with someone who left can still be traced.',
    fetcherKey: 'releasedNumbersList',
    showFeatures: false,
    showAddNumber: false,
    isArchive: true,
    emptyDescription: 'Numbers released from this account will appear here.',
  },
};

/* Same placeholder-data pattern as Identities & Addresses' own DUMMY_
   arrays — this backend has no configured API base URL yet, so the real
   fetcherFn never returns rows and every view shows its empty state. These
   stand in until a real endpoint is wired up. */
export const DUMMY_NUMBERS = [
  {
    uuid: 'dummy-number-1',
    did_number: '+12025551234',
    did_name: 'Support Line',
    did_type: 'L',
    is_fax_enabled: false,
    forward_call_actions: null,
    User: null,
    Site: { name: 'HQ' },
    features: [],
  },
  {
    uuid: 'dummy-number-2',
    did_number: '+14155550198',
    did_name: '',
    did_type: 'T',
    is_fax_enabled: false,
    forward_call_actions: null,
    User: { first_name: 'Kiran', last_name: 'Yadav' },
    Site: { name: 'Remote' },
    features: [],
  },
  {
    uuid: 'dummy-number-3',
    did_number: '+12125550172',
    did_name: 'Fax Line',
    did_type: 'L',
    is_fax_enabled: true,
    forward_call_actions: null,
    User: null,
    Site: null,
    features: [],
  },
];

/* Same placeholder-data pattern as DUMMY_NUMBERS above, for the archive
   (Released numbers) view — its own separate column set and endpoint, so
   it needs its own stand-in rows. */
export const DUMMY_RELEASED_NUMBERS = [
  {
    uuid: 'dummy-released-1',
    did_number: '+13105550111',
    did_name: 'Old Support Line',
    did_type: 'L',
    user_details: { first_name: 'Priya', last_name: 'Nair' },
    site_data: { name: 'HQ' },
    buy_date: '2024-02-14',
  },
  {
    uuid: 'dummy-released-2',
    did_number: '+18005550122',
    did_name: '',
    did_type: 'T',
    user_details: null,
    site_data: { name: 'Remote' },
    buy_date: '2023-11-02',
  },
  {
    uuid: 'dummy-released-3',
    did_number: '+12065550133',
    did_name: 'Marketing DID',
    did_type: 'L',
    user_details: { first_name: 'Diego', last_name: 'Ramirez' },
    site_data: null,
    buy_date: '2024-06-30',
  },
];

const viewFromPath = (pathname: string): ViewKey => {
  const last = pathname.replace(/\/+$/, '').split('/').pop() || '';
  if (last === 'in-use') return 'in-use';
  if (last === 'inventory') return 'inventory';
  if (last === 'released') return 'released';
  if (last === 'by-line') return 'by-line';
  return 'all';
};

interface INumberListState {
  updateForwarding: boolean;
  assignDID: boolean;
  selectedDID: any;
  deleteConfirmationAlert: boolean;
  removeConfirmationAlert: boolean;
  releaseConfirmationAlert: boolean;
  editLabel: boolean;
}

const NumberList = () => {
  const { pathname } = useLocation();
  const view = VIEWS[viewFromPath(pathname)];
  const { navRef: tabsNavRef, indicatorStyle: tabsIndicatorStyle } = useSlidingTabIndicator(view.key);

  const [search, setSearch] = useState<string>('');
  const [openDrawer, setOpenDrawer] = useState(false);
  const [isTableRefreshing, setIsTableRefreshing] = useState(false);
  const tableRef = useRef<any>(null);
  /* Every dropdown menu inside this page (react-select's own portal, plus
     the pagination footer's per-page picker) renders into document.body by
     default, escaping the .ident-coral-theme scope below and falling back
     to react-select's plain default colors instead of this page's red
     theme — same fix as Identities & addresses' own menuPortalTarget. */
  const [menuPortalTarget, setMenuPortalTarget] = useState<HTMLDivElement | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useUser();
  /* `companyInfo` does not exist on the user object — the field is `company_info`
     everywhere else in the codebase. Read wrongly, this was always undefined and
     a customer with an expired subscription could still open the buy flow. */
  const isPlanExpired = user?.company_info?.plan_status === 'EXPIRED';
  const isTrial = user?.company_info?.is_trial === 'Y';
  /* Required by the released-numbers endpoint, which rejects a company_uuid
     that is not the caller's own. */
  const companyUuid = user?.company_info?.uuid;
  const [numberState, setNumberState] = useState<INumberListState>({
    updateForwarding: false,
    assignDID: false,
    selectedDID: null,
    deleteConfirmationAlert: false,
    removeConfirmationAlert: false,
    releaseConfirmationAlert: false,
    editLabel: false,
  });
  const queryClient: any = useQueryClient();
  const { features } = useCompanyFeatures();
  /* With no backend configured, `features` never resolves and every row
     action (Set Forwarding, Assign Number, the "..." menu) stayed hidden
     behind a permission object that was always empty — not because access
     was denied, but because there was nothing to say otherwise. Falling
     back to "everything allowed" only when the plan data is genuinely
     absent (rather than present but denying) keeps this table demoable
     with DUMMY_NUMBERS; a real, loaded permission object still governs
     normally once the API is wired up. */
  const virtualNumberAccess = features?.plan_features?.virtual_numbers || {
    action: {
      assign_number: true,
      set_forwarding: true,
      update_forwarding: true,
      remove_forwarding: true,
      release: true,
      buy: true,
    },
  };

  /* A quick census above the table, matching the Identities & addresses
     page's own stat row — each card is a real count from the same list
     endpoints the tabs already use, not placeholder data. limit:1 keeps
     these cheap: only the total is read off the response, never the rows. */
  const countOf = (data: any) => data?.data?.data?.result?.totalItems ?? data?.data?.data?.result?.total ?? 0;
  const { data: totalAllCount = 0 } = useQuery({
    queryKey: ['numbersStatsCount', 'all'],
    queryFn: () => allNumbersList({ limit: 1, page: 1 }),
    select: countOf,
  });
  const { data: totalInUseCount = 0 } = useQuery({
    queryKey: ['numbersStatsCount', 'in_use'],
    queryFn: () => allNumbersList({ limit: 1, page: 1, type: 'in_use' }),
    select: countOf,
  });
  const { data: totalUnusedCount = 0 } = useQuery({
    queryKey: ['numbersStatsCount', 'inventory'],
    queryFn: () => allNumbersList({ limit: 1, page: 1, type: 'inventory' }),
    select: countOf,
  });
  const { data: totalReleasedCount = 0 } = useQuery({
    queryKey: ['numbersStatsCount', 'released', companyUuid],
    queryFn: () => releasedNumbersList({ limit: 1, page: 1, company_uuid: companyUuid }),
    select: countOf,
    enabled: Boolean(companyUuid),
  });

  const handleRefreshTable = async () => {
    setIsTableRefreshing(true);
    try {
      await tableRef.current?.refetchTable();
    } finally {
      setIsTableRefreshing(false);
    }
  };

  const handleAddNumber = () => {
    if (isTrial) return;

    if (isPlanExpired) {
      handleAlert({
        text: 'You cannot add numbers until your subscription is renewed.',
        type: 'error',
      });
      return;
    }
    setOpenDrawer(true);
  };

  /* Linked to from the setup guide, which sends people straight into the buy
     flow. Consumed once so a refresh does not reopen the drawer. */
  useEffect(() => {
    const shouldOpenAddNumber = searchParams.get('openAddNumber') === '1';
    if (!shouldOpenAddNumber || isTrial || !view.showAddNumber) return;

    setOpenDrawer(true);
    const params = new URLSearchParams(searchParams);
    params.delete('openAddNumber');
    setSearchParams(params, { replace: true });
  }, [isTrial, searchParams, setSearchParams, view.showAddNumber]);

  /* Search is per-view: carrying a filter across tabs makes an empty table look
     like missing data. */
  useEffect(() => {
    setSearch('');
  }, [view.key]);

  const handleNumberState = (data: any, key: string) => {
    setNumberState((prev) => ({ ...prev, [key]: true, selectedDID: data }));
  };

  const closeAlert = (key: keyof INumberListState) =>
    setNumberState((prev) => ({ ...prev, [key]: false, selectedDID: null }));

  const { mutate: mutateRemoveAssignDID, isPending: isPendingRemoveAssignDID } = useMutation({
    mutationFn: removeAssignNumber,
    onSuccess: (data: any) => {
      invalidateNumberLists(queryClient);
      handleAlert({
        text: data?.data?.data?.message || 'Assigned DID Removed Successfully.',
        type: 'success',
      });
      closeAlert('deleteConfirmationAlert');
    },
  });

  const { mutate: mutateRemoveForwarding, isPending: isPendingRemovingForwarding } = useMutation({
    mutationFn: removeForwarding,
    onSuccess: (data: any) => {
      invalidateNumberLists(queryClient);
      handleAlert({
        text: data?.data?.data?.message || 'Forwarding removed. You still have this number.',
        type: 'success',
      });
      closeAlert('removeConfirmationAlert');
    },
  });

  /* "Release Number" gives the number back to the carrier.

     It called releaseForwarding, which only unwires forwarding in our own
     database and never contacts the carrier. So the number vanished from these
     screens and stopped taking calls, while still being billed - and the dialog
     told the admin the action could not be undone. Every number released that
     way is still live at the carrier and should be checked against the invoice.

     releaseDidToCarrier sends the termination first and only then marks it
     deleted here. */
  const { mutate: mutateReleaseForwarding, isPending: isPendingReleaseForwarding } = useMutation({
    mutationFn: releaseDidToCarrier,
    onSuccess: (data: any) => {
      invalidateNumberLists(queryClient);
      handleAlert({
        text:
          data?.data?.data?.message ||
          'Number released. It has been given back and will not be billed again.',
        type: 'success',
      });
      closeAlert('releaseConfirmationAlert');
    },
    /* A failed carrier call must not read as success - the number would carry on
       being billed while the admin believes it is gone. */
    onError: (error: any) => {
      handleAlert({
        text:
          error?.response?.data?.message ||
          'The number could not be released with the carrier. It has NOT been given back - please try again.',
        type: 'error',
      });
    },
  });

  const archiveColumns = useMemo(
    () => [
      {
        header: 'Number',
        accessorKey: 'did_number',
        cell: ({ row }: any) => <NumberWithFlag number={row?.original?.did_number} />,
      },
      {
        header: 'Label',
        accessorKey: 'did_name',
        cell: ({ row }: any) => labelOf(row?.original) || <span className="text-gray-500">--</span>,
      },
      {
        header: 'Last assigned to',
        accessorKey: 'user_details',
        cell: ({ row }: any) => {
          const held = row?.original?.user_details;
          const name = [held?.first_name, held?.last_name].filter(Boolean).join(' ').trim();
          /* A number can be released without ever having had an owner, so this
             says so rather than showing an empty cell that reads as missing data. */
          return name || <span className="text-gray-500">Never assigned</span>;
        },
      },
      {
        header: 'Type',
        accessorKey: 'did_type',
        cell: ({ row: { original: _val } }: any) => getDidTypeLabel(_val?.did_type),
      },
      {
        header: 'Site',
        accessorKey: 'site_data',
        cell: ({ row }: any) => row?.original?.site_data?.name ?? '--',
      },
      {
        header: 'Held from',
        accessorKey: 'buy_date',
        cell: ({ row }: any) => {
          const bought = row?.original?.buy_date;
          if (!bought) return '--';
          const parsed = new Date(bought);
          return Number.isNaN(parsed.getTime()) ? '--' : parsed.toLocaleDateString();
        },
      },
    ],
    [],
  );

  const columns = useMemo(() => {
    const base: any[] = [
      {
        header: 'Number',
        accessorKey: 'did_number',
        cell: ({ row }: any) => {
          const data = row?.original || {};
          return (
            /* The FAX badge used to sit beside the number (inline, then
               absolute-positioned over it) — either way it fought the
               number for the same horizontal space, cramping or clipping
               the digits on a narrow column. Stacking the badge under the
               number instead gives each its own row, so neither has to
               shrink to fit the other. */
            <div className="flex w-full flex-col items-center justify-center gap-0.5">
              <NumberWithFlag number={data?.did_number} />
              {data?.is_fax_enabled && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  FAX
                </span>
              )}
            </div>
          );
        },
      },
      /* The name a number was bought with used to sit as small print under the
         number, where it read as decoration. It is the only thing that tells
         three numbers on the same line apart, so it gets a column of its own -
         and, for the first time, a way to change it. */
      {
        header: 'Label',
        accessorKey: 'did_name',
        cell: ({ row }: any) => {
          const data = row?.original || {};
          const label = labelOf(data);
          if (label) return label;
          return canEditLabel(data).ok && virtualNumberAccess?.action?.update_forwarding ? (
            <span
              className="text-primary cursor-pointer"
              onClick={() => handleNumberState(data, 'editLabel')}
            >
              Add label
            </span>
          ) : (
            <span className="text-gray-500">--</span>
          );
        },
      },
      {
        header: 'Assigned to',
        accessorKey: 'uuid',
        cell: ({ row }: any) => {
          const data = row?.original?.User || {};
          if (data?.first_name) {
            return `${data?.first_name}${data?.last_name ? ` ${data?.last_name}` : ''}`;
          }
          const canAssign =
            !row?.original?.forward_call_actions && virtualNumberAccess?.action?.set_forwarding;
          return canAssign ? (
            <button
              type="button"
              className="cursor-pointer"
              onClick={() => handleNumberState(row?.original, 'assignDID')}
            >
              {/* mcm-page.css resets `button { color: inherit; border: 0;
                  background: none }` globally and, being unlayered, beats
                  these Tailwind utilities regardless of specificity — so the
                  pill styling has to live on a span, not the button itself. */}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                <Icon name="AssignNumberIcon" className="h-3 w-3" />
                Assign to extension
              </span>
            </button>
          ) : (
            <p className="text-grey cursor-not-allowed">Assign to extension</p>
          );
        },
      },
      {
        header: 'Forwarded to',
        accessorKey: 'uuid',
        cell: ({ row }: any) => {
          const data = row?.original || {};

          if (data?.is_fax_enabled) return '--';

          /* Parsed defensively: an unguarded JSON.parse here throws during
             render, and one malformed forward_call_actions row would blank the
             entire table rather than that single cell. */
          const parsedForwardTo = parseForwardActions(data?.forward_call_actions);
          const forwardedValue = parsedForwardTo?.call_handling?.business_hours || '';
          return (
            <div>
              {FORWARD_TYPES_WITH_EXTENSION.includes(forwardedValue?.type) ? (
                <div className="flex">
                  <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-2.5 py-1 w-auto">
                    <div className="w-7 h-7 rounded-lg border border-primary/30 bg-white flex items-center justify-center text-primary text-base font-semibold leading-none">
                      #
                    </div>
                    <div className="flex flex-col gap-1 leading-tight">
                      <div className="text-[9px] font-semibold tracking-[0.08em] text-gray-500 uppercase">
                        {capitalizeFirstLetter(forwardedValue?.type)}
                      </div>
                      <small className="text-gray-900 text-xs font-semibold leading-none">
                        {forwardedValue?.name}
                        {forwardedValue?.value ? ` (${forwardedValue.value})` : ''}
                      </small>
                    </div>
                  </div>
                </div>
              ) : FORWARD_TYPES_WITH_NAME.includes(forwardedValue?.type) ? (
                <div className="flex flex-col items-start">
                  {capitalizeFirstLetter(forwardedValue?.type)}
                  <small>{forwardedValue?.name}</small>
                </div>
              ) : FORWARD_TYPES_WITH_PHONE.includes(forwardedValue?.type) ? (
                <div className="flex flex-col items-start">
                  {capitalizeFirstLetter(forwardedValue?.type)}
                  <small>
                    <NumberWithFlag number={`+${forwardedValue?.name}`} />
                  </small>
                </div>
              ) : data?.User || !virtualNumberAccess?.action?.set_forwarding ? (
                <p className="text-grey cursor-not-allowed">Set Forwarding</p>
              ) : (
                <button
                  type="button"
                  className="cursor-pointer"
                  onClick={() => handleNumberState(data, 'updateForwarding')}
                >
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
                    <Phone className="h-3 w-3" />
                    Set Forwarding
                  </span>
                </button>
              )}
            </div>
          );
        },
      },
      {
        header: 'Type',
        accessorKey: 'did_type',
        cell: ({ row: { original: _val } }: any) => getDidTypeLabel(_val?.did_type),
      },
    ];

    if (view.showFeatures) {
      base.push({
        header: 'Features',
        accessorKey: 'features',
        cell: ({ getValue }: any) => {
          const rowFeatures = getValue();
          return (
            <div className="flex justify-center items-center gap-2 px-4">
              {rowFeatures?.map((v: any) => {
                if (!featuresLookUp[v]) return null;
                return (
                  <CustomTooltip key={v} text={featuresObj[v]} side="top">
                    <img src={featuresLookUp[v]} alt={featuresObj[v]} width={24} height={24} />
                  </CustomTooltip>
                );
              })}
            </div>
          );
        },
        meta: { textAlign: 'center' },
      });
    }

    base.push({
      header: 'Site',
      accessorKey: 'type',
      cell: ({ row: { original: _val } }: any) => _val?.Site?.name ?? '--',
    });

    base.push({
      header: 'Action',
      accessorKey: 'action',
      cell: (props: any) => {
        const data = props?.row?.original;
        const createAction = (
          id: number,
          tooltip: string,
          icon: string,
          iconClass: string,
          className: string,
          stateAction: string,
        ) => ({
          id,
          tooltipText: tooltip,
          icon,
          iconClass,
          className,
          cb: () => handleNumberState(data, stateAction),
        });

        const neutral = 'bg-gray-100 text-gray-900/80 hover:bg-primary hover:text-white';

        const assignNumberAction =
          !data?.User && virtualNumberAccess?.action?.assign_number
            ? [
                createAction(
                  2,
                  'Assign Number',
                  'AssignNumberIcon',
                  'w-5 h-5',
                  neutral,
                  'assignDID',
                ),
              ]
            : [];

        const setForwardingActions =
          !data?.forward_call_actions && !data?.User
            ? [
                virtualNumberAccess?.action?.set_forwarding &&
                  createAction(
                    1,
                    'Set Forwarding',
                    'CallForward',
                    'w-5.5 h-5.5',
                    neutral,
                    'updateForwarding',
                  ),
                ...assignNumberAction,
              ].filter(Boolean)
            : [];

        const updateForwardingActions =
          !data?.User && data?.forward_call_actions
            ? [
                virtualNumberAccess?.action?.update_forwarding &&
                  createAction(
                    1,
                    'Update Forwarding',
                    'EditStrokIcon',
                    'w-5 h-5',
                    neutral,
                    'updateForwarding',
                  ),
                virtualNumberAccess?.action?.remove_forwarding &&
                  createAction(
                    3,
                    'Remove Forwarding',
                    'CallCancel',
                    'w-5.5 h-5.5',
                    neutral,
                    'removeConfirmationAlert',
                  ),
              ].filter(Boolean)
            : [];

        const removeAssignmentAction =
          data?.User && virtualNumberAccess?.action?.assign_number
            ? [
                createAction(
                  2,
                  'Remove Assignment',
                  'RemoveAssignmentLine',
                  'w-5 h-5 ',
                  neutral,
                  'deleteConfirmationAlert',
                ),
              ]
            : [];

        /* Offered wherever a label can actually be kept, assigned or not. The
           permission is the forwarding one because that is literally the write
           this makes - there is no endpoint that changes a number's name on its
           own. */
        const editLabelAction =
          canEditLabel(data).ok && virtualNumberAccess?.action?.update_forwarding
            ? [createAction(5, 'Edit Label', 'EditStrokIcon', 'w-5 h-5', neutral, 'editLabel')]
            : [];

        const releaseNumberAction = virtualNumberAccess?.action?.release
          ? [
              createAction(
                4,
                'Release Number',
                'ReleaseNumber',
                'w-5 h-5',
                'text-red-500',
                'releaseConfirmationAlert',
              ),
            ]
          : [];

        /* Every row action — Set Forwarding/Assign Number included — now
           lives behind the single "..." menu instead of also getting its
           own standalone icon next to it, so each row shows one consistent
           button regardless of which actions happen to apply to it. */
        const leadingActions = data?.is_fax_enabled
          ? data?.User
            ? []
            : assignNumberAction
          : setForwardingActions;

        const menuActions = data?.is_fax_enabled
          ? [...(data?.User ? removeAssignmentAction : []), ...leadingActions, ...editLabelAction]
          : [
              ...leadingActions,
              ...removeAssignmentAction,
              ...updateForwardingActions,
              ...releaseNumberAction,
              ...editLabelAction,
            ];

        if (!menuActions.length) return '---';

        return (
          <div className="flex items-center justify-center w-full gap-2">
            {menuActions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div
                    className="cursor-pointer flex items-center justify-center rounded-full w-8 h-8 bg-red-100 text-red-500 hover:bg-red-500 hover:text-white"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Icon name="MenuDots" className="w-5 h-5" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="border-neutral-200! bg-white! text-black!">
                  {menuActions.map((action: any) => (
                    <DropdownMenuItem key={action.id} onClick={action.cb}>
                      <Icon name={action.icon as IconName} className="w-4 h-4" />
                      {action.tooltipText}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        );
      },
    });

    return base;
  }, [view.showFeatures, virtualNumberAccess]);

  const selected = numberState.selectedDID;
  const releaseBlocked = Boolean(selected?.User) || Boolean(selected?.forward_call_actions);

  return (
    <div ref={setMenuPortalTarget} className="ident-coral-theme flex min-h-0 w-full flex-1 flex-col">
      <AdminPage
        section="Numbers"
        title={view.title}
        titleSuffix={
          <CustomTooltip
            text={view.description}
            side="right"
            /* `w-fit` sizes this to its widest wrapped LINE, but that
               measurement happens before text-balance (in the base
               TooltipContent's own classes) redistributes the line
               breaks — so the box ends up sized for one wrapping and
               filled with another, leaving empty space on shorter lines.
               `[text-wrap:wrap]!` cancels the base class's balance so
               fit-content's own natural wrapping is what actually renders,
               which is what fit-content sized the box for in the first
               place. */
            className="w-fit max-w-[280px] whitespace-normal [text-wrap:wrap]! border-0 bg-[#fdf7f5] text-black shadow-[0_6px_20px_rgba(17,17,17,0.18)] [&_svg]:fill-[#fdf7f5]"
          >
            <Info className="h-4 w-4 text-gray-500! transition-colors hover:text-red-600! active:text-red-600! data-[state=delayed-open]:text-red-600! data-[state=instant-open]:text-red-600!" />
          </CustomTooltip>
        }
        headerTabs={
          <nav
            ref={tabsNavRef}
            className="mcm-segmented"
            role="group"
            aria-label="Number views"
          >
            <span className="ident-segmented-indicator" style={tabsIndicatorStyle} aria-hidden="true" />
            {Object.values(VIEWS).map((item) => {
              const isActive = item.key === view.key;
              return (
                <Link
                  key={item.key}
                  to={item.path}
                  aria-current={isActive ? 'page' : undefined}
                  className={isActive ? 'is-active' : ''}
                >
                  {item.tab}
                </Link>
              );
            })}
          </nav>
        }
        actions={
          /* Same far-right spot as Identities & addresses' own "Add
             identity" button — not grouped with the tabs. Gated the same
             way Add identity/Add address are (trial + which view), not
             also behind the buy permission check that used to sit here,
             which a sub-admin role without an explicit
             `virtual_numbers.action.buy` grant failed even though
             Identities/Addresses' own Add buttons never checked it. The
             actual purchase call still enforces that server-side; this
             only controls whether the button shows. */
          !isTrial && view.showAddNumber ? (
            <button type="button" className="ident-pill-btn black" onClick={handleAddNumber}>
              <Plus className="w-3 h-4 text-white" />
              Add number
            </button>
          ) : null
        }
        beforeTable={
          <>
            {/* Stats render as their own card below the head bar, matching
                Identities & addresses' KPI row. */}
            <div className="ident-stats-row">
              <div className="ident-stat-card">
                <div className="ident-stat-label">Total Numbers</div>
                <div className="ident-stat-value">{totalAllCount}</div>
                <div className="ident-stat-caption">Every number on this account</div>
              </div>
              <div className="ident-stat-card">
                <div className="ident-stat-label">In Use</div>
                <div className="ident-stat-value">{totalInUseCount}</div>
                <div className="ident-stat-caption">Currently assigned or routed</div>
              </div>
              <div className="ident-stat-card">
                <div className="ident-stat-label">Unused</div>
                <div className="ident-stat-value">{totalUnusedCount}</div>
                <div className="ident-stat-caption">Owned but not yet assigned</div>
              </div>
              <div className="ident-stat-card">
                <div className="ident-stat-label">Released</div>
                <div className="ident-stat-value">{totalReleasedCount}</div>
                <div className="ident-stat-caption">Returned from this account</div>
              </div>
            </div>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {/* The view-switch tabs live in the sticky head bar (see
              `headerTabs`); search now sits inside the table's own card,
              above its column headers (see `customHeader` below) — matching
              the AI Receptionist list's table header format. */}
          {/* border/radius/spacing come from the scoped .panel-card > .tbl-wrap
              > div > p:first-child rule in mcm-page.css, not from classes here —
              that selector is unlayered and was silently overriding whatever
              Tailwind classes this element carried, so keeping them here too
              just invited them to drift out of sync with what actually renders. */}
          {view.key === 'all' && (
            <p className="flex items-center gap-2">
              <Info className="h-3.5 w-3.5 flex-none text-[var(--accent)]" />
              <span>
                Adding a number to an existing user/plan only charges for the number itself — no
                new subscription is created. Your monthly total updates with quantity.
              </span>
            </p>
          )}

          {view.isGrouped ? (
            <NumbersByLine
              search={search}
              setSearch={setSearch}
              canLabel={Boolean(virtualNumberAccess?.action?.update_forwarding)}
              onEditLabel={(did) => handleNumberState(did, 'editLabel')}
              menuPortalTarget={menuPortalTarget}
            />
          ) : (
            <div
              className={`ident-table-card ident-table-card--plain w-full flex flex-col ${
                view.key === 'all' ? '-mt-2 ident-table--all-numbers' : ''
              } ${
                view.key === 'in-use' || view.key === 'inventory' ? 'ident-table--numbers-list' : ''
              } ${view.isArchive ? 'ident-table--released' : ''}`}
            >
              <TableManager
                {...{
                  fetcherKey: view.fetcherKey,
                  fetcherFn: view.isArchive ? releasedNumbersList : allNumbersList,
                  columns: view.isArchive ? archiveColumns : columns,
                  search,
                  tableRef,
                  hideFooterRefresh: true,
                  pagerAccentClassName: 'border-red-600 bg-red-600 text-white',
                  perPageMenuPortalTarget: menuPortalTarget,
                  hideFooterDivider: true,
                  fitHeightToContent: true,
                  customHeader: (
                    <TableSearchHeader
                      value={search}
                      onChange={setSearch}
                      onRefresh={handleRefreshTable}
                      refreshing={isTableRefreshing}
                      placeholder="Search numbers"
                      rightSlot={
                        <div className="ml-auto flex h-9 shrink-0 items-center gap-3 rounded-full border border-neutral-200 bg-white px-3.5 text-sm">
                          <span className="font-semibold text-gray-900">All {totalAllCount}</span>
                          <span className="h-4 w-px bg-neutral-200" />
                          <span className="flex items-center gap-1.5 text-gray-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
                            Assigned {totalInUseCount}
                          </span>
                        </div>
                      }
                    />
                  ),
                  ...(view.isArchive
                    ? {
                        extraParams: { company_uuid: companyUuid },
                        staticData: DUMMY_RELEASED_NUMBERS,
                        clientSideSearch: true,
                      }
                    : { staticData: DUMMY_NUMBERS, clientSideSearch: true }),
                  ...(view.extraParams ? { extraParams: view.extraParams } : {}),
                  emptyTablePlaceholder: 'No numbers available',
                  ...(view.emptyDescription
                    ? { descriptionEmptyTable: view.emptyDescription }
                    : {}),
                }}
              />
            </div>
          )}

          {openDrawer && (
            <Dialog open={openDrawer} onOpenChange={(open) => !open && setOpenDrawer(false)}>
              <DialogContent
                showCloseButton={false}
                /* Selects in the form below (Location, Number Type) render their
                   dropdown menu into a portal in document.body, outside this
                   Dialog's own DOM subtree. Radix treats a click landing outside
                   Content as a "close" request, so without this, picking an
                   option from either dropdown closed the whole modal instead of
                   selecting it — which was why Next never actually got reached. */
                onPointerDownOutside={(e) => e.preventDefault()}
                /* Matches the width of the platform's own "Invite people"
                   popup, so the two read as the same size/family of modal
                   rather than one being noticeably narrower. */
                className="ident-form-popup flex max-h-[88vh] w-full flex-col gap-4 overflow-hidden p-6 sm:max-w-2xl lg:max-w-3xl"
              >
                <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0">
                  <DialogTitle className="popup-title">Add Number</DialogTitle>
                  <button
                    type="button"
                    onClick={() => setOpenDrawer(false)}
                    aria-label="Close"
                    className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full text-gray-500 hover:bg-red-50 hover:text-black"
                  >
                    <Icon name="CloseIcon" className="h-3 w-4" />
                  </button>
                </DialogHeader>
                {/* Must itself be a flex column, not just a sized box: AddNumber's
                    root uses `flex-1` (not `h-full`) to fill this, and a
                    percentage height on a plain block parent whose own size
                    comes from flex-grow doesn't reliably resolve — that was
                    letting the form grow to its natural content height and
                    push the Back/Next footer past the dialog's clipped
                    max-height instead of scrolling internally. */}
                <div className="flex min-h-0 flex-1 flex-col">
                  <AddNumber handleClose={() => setOpenDrawer(false)} />
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </AdminPage>

      {numberState.updateForwarding && (
        <Dialog
          open={numberState.updateForwarding}
          onOpenChange={(open) => !open && closeAlert('updateForwarding')}
        >
          <DialogContent
            showCloseButton={false}
            onPointerDownOutside={(e) => e.preventDefault()}
            className="ident-form-popup flex max-h-[88vh] w-full flex-col gap-4 overflow-hidden p-6 sm:max-w-2xl lg:max-w-3xl"
          >
            <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0">
              <DialogTitle className="popup-title">Update Forwarding</DialogTitle>
              <button
                type="button"
                onClick={() => closeAlert('updateForwarding')}
                aria-label="Close"
                className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full text-gray-500 hover:bg-red-50 hover:text-black"
              >
                <Icon name="CloseIcon" className="h-3 w-4" />
              </button>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <UpsertCallForwarding
                drawerState={numberState.updateForwarding}
                setDrawerState={(val: boolean) =>
                  setNumberState((prev) => ({
                    ...prev,
                    updateForwarding: val,
                    selectedDID: null,
                  }))
                }
                initialType={'SELECT_TEMPLATE'}
                isUser={false}
                initialData={selected}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {numberState.editLabel && selected && (
        <EditNumberLabel
          did={selected}
          open={numberState.editLabel}
          onClose={() => closeAlert('editLabel')}
        />
      )}

      {numberState.assignDID && (
        <AssignDIDNumber
          modalState={numberState.assignDID}
          setModalState={(val: boolean) =>
            setNumberState((prev) => ({ ...prev, assignDID: val, selectedDID: null }))
          }
          selectedDidNumber={selected}
        />
      )}

      {numberState.deleteConfirmationAlert && (
        <AlertConfirm
          {...{
            apiLoading: isPendingRemoveAssignDID,
            onConfirm: () => mutateRemoveAssignDID({ did_number: selected?.did_number }),
            open: numberState.deleteConfirmationAlert,
            setOpen: () => closeAlert('deleteConfirmationAlert'),
            descriptionTextComp:
              'Are you sure you want to remove the assignment of this DID number? ',
            icon: <Trash2 className="h-7 w-7" />,
            iconTone: 'danger',
            iconLabel: 'Remove',
            confirmBtnClassName: 'rounded-full bg-red-600 hover:bg-red-700 text-white border-red-600',
            headerClassName: 'ident-confirm-title',
            closeBtnClassName:
              'rounded-full border border-gray-200 text-gray-700! hover:bg-gray-50! hover:text-gray-700! focus-visible:ring-0! shadow-none!',
            className: 'sm:w-1/2 md:w-1/2 lg:w-2/5 bg-white!',
          }}
          headerText="Remove DID Assignment"
        />
      )}

      {numberState.releaseConfirmationAlert && (
        <AlertConfirm
          {...{
            apiLoading: isPendingReleaseForwarding,
            onConfirm: () => mutateReleaseForwarding(selected?.did_number),
            open: numberState.releaseConfirmationAlert,
            setOpen: () => closeAlert('releaseConfirmationAlert'),
            descriptionTextComp: releaseBlocked
              ? ' You must remove the assignment or forwarding before releasing this number.'
              : 'Give this number back to the carrier? Billing for it stops and it will no longer reach you. It may then be issued to somebody else, so you cannot get it back. To stop it taking calls but keep the number, use Remove forwarding instead.',
            confirmBtnDisabled: releaseBlocked,
            icon: <Trash2 className="h-7 w-7" />,
            iconTone: 'danger',
            iconLabel: 'Release',
            confirmBtnClassName: 'rounded-full bg-red-600 hover:bg-red-700 text-white border-red-600',
            headerClassName: 'ident-confirm-title',
            closeBtnClassName:
              'rounded-full border border-gray-200 text-gray-700! hover:bg-gray-50! hover:text-gray-700! focus-visible:ring-0! shadow-none!',
            className: 'sm:w-1/2 md:w-1/2 lg:w-2/5 bg-white!',
          }}
        />
      )}

      {numberState.removeConfirmationAlert && (
        <AlertConfirm
          {...{
            apiLoading: isPendingRemovingForwarding,
            onConfirm: () => mutateRemoveForwarding({ uuid: selected?.uuid }),
            open: numberState.removeConfirmationAlert,
            setOpen: () => closeAlert('removeConfirmationAlert'),
            descriptionTextComp:
              'Are you sure you want to remove the forwarding of this DID number? This action cannot be undone.',
            icon: <Trash2 className="h-7 w-7" />,
            iconTone: 'danger',
            iconLabel: 'Remove',
            confirmBtnClassName: 'rounded-full bg-red-600 hover:bg-red-700 text-white border-red-600',
            headerClassName: 'ident-confirm-title',
            closeBtnClassName:
              'rounded-full border border-gray-200 text-gray-700! hover:bg-gray-50! hover:text-gray-700! focus-visible:ring-0! shadow-none!',
            className: 'sm:w-1/2 md:w-1/2 lg:w-2/5 bg-white!',
          }}
        />
      )}
    </div>
  );
};

export default NumberList;
