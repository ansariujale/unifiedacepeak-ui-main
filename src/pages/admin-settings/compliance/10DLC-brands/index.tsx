import TableManager from '@/components/custom/table-manager';
import TableSearchHeader from '@/components/custom/table-search-header';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { Icon, IconName } from '@/assets/icons/icon';
import CustomTooltip from '@/components/custom/custom-tooltip';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import Create10DLCBrand from './create-10DLC-brand';
import { brandDelete, getBrandList } from '@/services/api';
import AlertConfirm from '@/components/custom/alert-confirm';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { convertDateFormateApis, handleAlert } from '@/lib/utils';
import { DEMO_BRANDS } from './demo-brands';

/* SCREAMING_SNAKE the way the create-brand form stores its own option
   values (constant.ts entityTypes) — readable once split on the underscore
   and title-cased, the same treatment Manage Webhook gives its type column. */
const prettyEnum = (value: unknown) =>
  String(value || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

/* Identity Status and TCR Status are two different vocabularies from two
   different systems (the brand's own self-attestation vs what carriers
   decided), so they each get their own tone map rather than one shared
   guess. */
const IDENTITY_STATUS_TONE: Record<string, string> = {
  VERIFIED: 'connected',
  VETTED_VERIFIED: 'connected',
  SELF_DECLARED: 'setup',
};
const TCR_STATUS_TONE: Record<string, string> = {
  REGISTERED: 'connected',
  PENDING: 'setup',
  FAILED: 'danger',
};

const StatusPill = ({ value, toneMap }: { value: unknown; toneMap: Record<string, string> }) => {
  const raw = String(value || '');
  if (!raw) return <span className="text-gray-400">--</span>;
  const tone = toneMap[raw] || '';
  return (
    <span className={`mcm-intstatus ${tone}`}>
      <i />
      {prettyEnum(raw)}
    </span>
  );
};

const DLCBrands = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'REGISTERED' | 'PENDING' | 'FAILED'>(
    'all',
  );
  const [drawerState, setDrawerState] = useState({
    create10DLCBrand: false,
  });
  const [open, setOpen] = useState(false);
  const [rowData, setRowData] = useState<any>({});

  /* TCR Status, not Identity Status: it is what decides whether a brand can
     actually send yet, the same "is this thing working" question the
     Active/Inactive filter on Manage Webhook answers. */
  const countBy = (key: string) => DEMO_BRANDS.filter((b) => b.status === key).length;
  const filterTabs = [
    { key: 'all' as const, label: 'All', count: DEMO_BRANDS.length },
    { key: 'REGISTERED' as const, label: 'Registered', count: countBy('REGISTERED') },
    { key: 'PENDING' as const, label: 'Pending', count: countBy('PENDING') },
    { key: 'FAILED' as const, label: 'Failed', count: countBy('FAILED') },
  ];
  const visibleBrands =
    statusFilter === 'all' ? DEMO_BRANDS : DEMO_BRANDS.filter((b) => b.status === statusFilter);

  const { mutate: mutateBrandDelete, isPending } = useMutation({
    mutationKey: ['brandDelete'],
    mutationFn: brandDelete,
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['getBrandList'] });
      handleAlert({
        text: data?.data?.message,
        type: 'success',
      });
      setOpen(false);
    },
  });

  const columns = [
    {
      header: 'Brand Name',
      accessorKey: 'displayName',
      cell: ({ getValue }: any) => (
        <span className="font-semibold text-gray-900">{String(getValue() || '--')}</span>
      ),
    },
    {
      header: 'Brand ID',
      accessorKey: 'brandId',
      cell: ({ getValue }: any) => (
        <span className="font-mono text-[12.5px] text-gray-500">{String(getValue() || '--')}</span>
      ),
    },
    {
      header: 'Registration On',
      accessorKey: 'createdAt',
      cell: ({ row }: any) => {
        const data = row?.original;
        return (
          <span className="whitespace-nowrap">
            {convertDateFormateApis(data?.createdAt, 'MMM D, YYYY')}
          </span>
        );
      },
    },
    {
      header: 'Entity Type',
      accessorKey: 'entityType',
      cell: ({ getValue }: any) => {
        const value = getValue();
        if (!value) return <span className="text-gray-400">--</span>;
        return <span className="mcm-wh-type">{prettyEnum(value)}</span>;
      },
    },
    {
      header: 'Country',
      accessorKey: 'country',
      cell: ({ getValue }: any) => (
        <span className="text-gray-600">{String(getValue() || '--')}</span>
      ),
    },
    {
      header: 'Identity Status',
      accessorKey: 'identityStatus',
      cell: ({ getValue }: any) => <StatusPill value={getValue()} toneMap={IDENTITY_STATUS_TONE} />,
    },
    {
      header: 'TCR Status',
      accessorKey: 'status',
      cell: ({ getValue }: any) => <StatusPill value={getValue()} toneMap={TCR_STATUS_TONE} />,
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
                aria-label="Delete brand"
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
          {/* Title and the primary action only. Search and the status filter
              live in the table's own card (see customHeader below), as on AI
              Receptionists -- they act on the list, so they sit on it. */}
          {/* Title over column 1, filter centred on column 2, actions over
              column 3 -- the same three-column head every other list page
              uses. Only the search moved into the table card. */}
          <div className="mcm-intpage-headrow">
            <div className="mcm-intpage-headleft">
              <div className="flex min-w-0 items-center gap-2">
                <h1>Brands</h1>
                <CustomTooltip
                  side="bottom"
                  sideOffset={10}
                  className="mcm-tooltip-info"
                  text="The business identities you register with carriers before sending A2P text messages in the US."
                >
                  <Info className="mcm-intpage-info" />
                </CustomTooltip>
              </div>

              <div className="mcm-segmented" role="group" aria-label="Filter brands by TCR status">
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
              {/* Secondary, beside the primary: a brand exists to hang campaigns
                  on, and that page is the next stop after registering one. */}
              <Link to="/admin-settings/compliance/brands/campaigns" className="btn">
                <Icon name="DepartmentIcon" className="h-3.5 w-3.5" />
                SMS Campaigns
              </Link>
              <button
                type="button"
                className="btn primary"
                onClick={() => setDrawerState((prev) => ({ ...prev, create10DLCBrand: true }))}
              >
                <Icon name="PlusIcon" className="w-3 h-3" />
                Create brand
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
            recordNoun="brand"
            {...{
              customHeader: (
                <TableSearchHeader
                  value={search}
                  onChange={setSearch}
                  onRefresh={() => queryClient.invalidateQueries({ queryKey: ['getBrandList'] })}
                  placeholder="Search brands"
                />
              ),
              /* Refresh lives in the toolbar on this pattern, not the pager. */
              hideFooterRefresh: true,
              fetcherKey: 'getBrandList',
              fetcherFn: getBrandList,
              columns,
              search,
              clientSideSearch: true,
              isHeightSet: false,
              emptyTablePlaceholder: 'No brands found',
              descriptionEmptyTable: 'Create a 10DLC brand to begin compliance registration.',
              /* This workspace has no brands registered yet -- design
                 preview only, remove once there is real data to look at. */
              staticData: visibleBrands,
            }}
          />
          </div>
        </div>
      </div>

      {/* A centred dialog, the same shell as Manage Webhook's New webhook
          modal, rather than a side panel sliding in from the right. Padding
          is zero: the form inside paints its own head/body/foot bands. */}
      <Dialog
        open={drawerState?.create10DLCBrand}
        onOpenChange={(open) => setDrawerState((prev) => ({ ...prev, create10DLCBrand: open }))}
      >
        <DialogContent className="w-[calc(100vw_-_2rem)] max-w-4xl p-0" showCloseButton={false}>
          {drawerState?.create10DLCBrand && (
            <Create10DLCBrand
              drawerState={drawerState?.create10DLCBrand}
              setDrawerState={() =>
                setDrawerState((prev) => ({ ...prev, create10DLCBrand: false }))
              }
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertConfirm
        {...{
          apiLoading: isPending,
          onConfirm: () => {
            mutateBrandDelete({
              brandId: rowData?.brandId,
            });
          },
          open,
          setOpen,
        }}
      />
    </>
  );
};

export default DLCBrands;
