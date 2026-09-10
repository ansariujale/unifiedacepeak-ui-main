import TableManager from '@/components/custom/table-manager';
import TableSearchHeader from '@/components/custom/table-search-header';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { Icon, IconName } from '@/assets/icons/icon';
import CustomTooltip from '@/components/custom/custom-tooltip';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import Create10DLCCampaign from './create-10DLC-campaign';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { campaign10DLCList, campaignDelete } from '@/services/api';
import { convertDateFormateApis, handleAlert } from '@/lib/utils';
import AlertConfirm from '@/components/custom/alert-confirm';
import { DEMO_CAMPAIGNS } from './demo-campaigns';

/* TCR's use-case codes are SCREAMING_SNAKE (ACCOUNT_NOTIFICATION). Split
   and title-case them, keeping the acronyms that are acronyms. */
const prettyEnum = (value: unknown) =>
  String(value || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\b(2fa|Sms|Mms|Otp|Ucaas|Uc)\b/gi, (m) => m.toUpperCase());

const TCR_STATUS_TONE: Record<string, string> = {
  ACTIVE: 'connected',
  PENDING: 'setup',
  REJECTED: 'danger',
};

const StatusPill = ({ value }: { value: unknown }) => {
  const raw = String(value || '');
  if (!raw) return <span className="text-gray-400">--</span>;
  return (
    <span className={`mcm-intstatus ${TCR_STATUS_TONE[raw] || ''}`}>
      <i />
      {prettyEnum(raw)}
    </span>
  );
};

const DLCCampaigns = () => {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ACTIVE' | 'PENDING' | 'EXPIRED'>(
    'all',
  );
  const [drawerState, setDrawerState] = useState({
    create10DLCCamapign: false,
  });

  const [open, setOpen] = useState(false);
  const [rowData, setRowData] = useState<any>({});

  const { mutate: mutateCampaignDelete, isPending } = useMutation({
    mutationKey: ['campaignDelete'],
    mutationFn: campaignDelete,
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['campaign10DLCList'] });
      handleAlert({
        text: data?.data?.message,
        type: 'success',
      });
      setOpen(false);
    },
  });

  /* Filter on TCR status -- whether the campaign can send yet -- the same
     question the Brands page filter answers. */
  const countBy = (key: string) => DEMO_CAMPAIGNS.filter((c) => c.tcrStatus === key).length;
  const filterTabs = [
    { key: 'all' as const, label: 'All', count: DEMO_CAMPAIGNS.length },
    { key: 'ACTIVE' as const, label: 'Active', count: countBy('ACTIVE') },
    { key: 'PENDING' as const, label: 'Pending', count: countBy('PENDING') },
    { key: 'EXPIRED' as const, label: 'Expired', count: countBy('EXPIRED') },
  ];
  const visibleCampaigns =
    statusFilter === 'all'
      ? DEMO_CAMPAIGNS
      : DEMO_CAMPAIGNS.filter((c) => c.tcrStatus === statusFilter);

  const columns = [
    {
      header: 'Campaign ID',
      accessorKey: 'campaignId',
      cell: ({ getValue }: any) => (
        <span className="font-mono text-[12.5px] text-gray-900">{String(getValue() || '--')}</span>
      ),
    },
    {
      header: 'Brand',
      accessorKey: 'brandName',
      cell: ({ row }: any) => {
        const data = row?.original;
        if (!data?.brandName && !data?.brandId) return <span className="text-gray-400">--</span>;
        /* Name and ID together: the ID alone meant a trip to the Brands page
           to learn which brand a campaign belonged to. */
        return (
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-gray-900">{data?.brandName || '--'}</span>
            <span className="font-mono text-[11.5px] text-gray-500">{data?.brandId || ''}</span>
          </div>
        );
      },
    },
    {
      header: 'Use case',
      accessorKey: 'usecase',
      cell: ({ getValue }: any) => {
        const value = getValue();
        if (!value) return <span className="text-gray-400">--</span>;
        return <span className="mcm-wh-type">{prettyEnum(value)}</span>;
      },
    },
    {
      header: 'Registered on',
      accessorKey: 'createdAt',
      cell: ({ row }: any) => (
        <span className="whitespace-nowrap">
          {convertDateFormateApis(row?.original?.createdAt, 'MMM D, YYYY')}
        </span>
      ),
    },
    {
      header: 'Upstream CNP',
      accessorKey: 'upstreamCnpName',
      cell: ({ getValue }: any) => (
        <span className="text-gray-700">{String(getValue() || '--')}</span>
      ),
    },
    {
      header: 'Reseller',
      accessorKey: 'resellerName',
      cell: ({ getValue }: any) => {
        const value = getValue();
        return value ? (
          <span className="text-gray-700">{String(value)}</span>
        ) : (
          <span className="text-gray-400">--</span>
        );
      },
    },
    {
      header: 'TCR status',
      accessorKey: 'tcrStatus',
      cell: ({ getValue }: any) => <StatusPill value={getValue()} />,
    },
    {
      header: 'Action',
      accessorKey: 'action',
      cell: (props: any) => {
        const data = props?.row?.original;
        const isDefault = data?.is_default === '1';
        return (
          <div className="mcm-wh-actions">
            <CustomTooltip text="Delete" side="top">
              <button
                type="button"
                disabled={isDefault}
                aria-label="Delete campaign"
                onClick={() => {
                  setOpen(true);
                  setRowData(data);
                }}
              >
                <Icon name={'TrashBin' as IconName} className="h-4 w-4" />
              </button>
            </CustomTooltip>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <div className="mcm-intpage w-full min-w-0 bg-gray-200/15 flex flex-col overflow-hidden">
        <div className="mcm-intpage-head">
          <div className="mcm-intpage-eyebrow">10DLC Compliance</div>
          {/* Title over column 1, filter centred on column 2, actions over
              column 3 -- the same three-column head as Brands. The search
              lives in the table card below. */}
          <div className="mcm-intpage-headrow">
            <div className="mcm-intpage-headleft">
              <div className="flex min-w-0 items-center gap-2">
                <h1>SMS Campaigns</h1>
                <CustomTooltip
                  side="bottom"
                  sideOffset={10}
                  className="mcm-tooltip-info"
                  text="What each registered brand is allowed to text about, and the numbers attached to it."
                >
                  <Info className="mcm-intpage-info" />
                </CustomTooltip>
              </div>

              <div
                className="mcm-segmented"
                role="group"
                aria-label="Filter campaigns by TCR status"
              >
                {filterTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    aria-pressed={statusFilter === tab.key}
                    className={statusFilter === tab.key ? 'is-active' : ''}
                    onClick={() => setStatusFilter(tab.key)}
                  >
                    {tab.label}
                    <em>{tab.count}</em>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 justify-self-end">
              {/* A campaign hangs off a brand; that page is the other half
                  of this one. */}
              <Link to="/admin-settings/compliance/brands" className="btn">
                <Icon name="BoxBrandsIcon" className="h-3.5 w-3.5" />
                Brands
              </Link>
              <button
                type="button"
                className="btn primary"
                onClick={() => setDrawerState((prev) => ({ ...prev, create10DLCCamapign: true }))}
              >
                <Icon name="PlusIcon" className="w-3 h-3" />
                Create campaign
              </button>
            </div>
          </div>
        </div>

        <div className="mcm-intbody w-full p-3 flex flex-col gap-2 overflow-y-auto">
          {/* One card around toolbar, table and pager -- TableManager renders
              them as three bordered siblings otherwise. */}
          <div className="mcm-tablecard mcm-tablecard--tm">
            <TableManager
              perPageSelectClass="mcm-select"
              recordNoun="campaign"
              {...{
                customHeader: (
                  <TableSearchHeader
                    value={search}
                    onChange={setSearch}
                    onRefresh={() =>
                      queryClient.invalidateQueries({ queryKey: ['campaign10DLCList'] })
                    }
                    placeholder="Search campaigns"
                  />
                ),
                hideFooterRefresh: true,
                fetcherKey: 'campaign10DLCList',
                fetcherFn: campaign10DLCList,
                columns,
                search,
                clientSideSearch: true,
                isHeightSet: false,
                emptyTablePlaceholder: 'No campaigns yet',
                descriptionEmptyTable:
                  'Register a campaign against a brand to start sending A2P messages.',
                /* This workspace has no campaigns yet -- design preview only,
                   remove once there is real data to look at. */
                staticData: visibleCampaigns,
              }}
            />
          </div>
        </div>
      </div>

      {/* A centred dialog, the same shell as the Create brand wizard, rather
          than a full-height panel sliding in from the right. Padding is zero:
          the form inside paints its own head/body/foot bands. */}
      <Dialog
        open={drawerState?.create10DLCCamapign}
        onOpenChange={(open) =>
          setDrawerState((prev) => ({ ...prev, create10DLCCamapign: open }))
        }
      >
        <DialogContent className="w-[calc(100vw_-_2rem)] max-w-5xl p-0" showCloseButton={false}>
          {drawerState?.create10DLCCamapign && (
            <Create10DLCCampaign
              drawerState={drawerState?.create10DLCCamapign}
              setDrawerState={() =>
                setDrawerState((prev) => ({ ...prev, create10DLCCamapign: false }))
              }
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertConfirm
        {...{
          apiLoading: isPending,
          onConfirm: () => {
            mutateCampaignDelete({
              campaignId: rowData?.campaignId || '',
            });
          },
          open,
          setOpen,
        }}
      />
    </>
  );
};

export default DLCCampaigns;
