import { Icon, IconName } from '@/assets/icons/icon';
import CustomTooltip from '@/components/custom/custom-tooltip';
import TableManager from '@/components/custom/table-manager';
import TableSearchHeader from '@/components/custom/table-search-header';
import { useState } from 'react';
import { Info } from 'lucide-react';
import CreateReseller from './create-reseller';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getResellerList, resellerDelete } from '@/services/api';
import { handleAlert } from '@/lib/utils';
import AlertConfirm from '@/components/custom/alert-confirm';
import { DEMO_RESELLERS } from './demo-resellers';

const Reseller = () => {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [rowData, setRowData] = useState<any>({});

  const { mutate: mutateResellerDelete, isPending } = useMutation({
    mutationKey: ['resellerDelete'],
    mutationFn: resellerDelete,
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['getResellerList'] });
      handleAlert({
        text: data?.data?.message,
        type: 'success',
      });
      setOpen(false);
    },
  });

  const columns = [
    {
      header: 'Legal Company Name',
      accessorKey: 'companyName',
      cell: ({ getValue }: any) => (
        <span className="font-semibold text-gray-900">{String(getValue() || '--')}</span>
      ),
    },
    {
      header: 'Reseller ID',
      accessorKey: 'resellerId',
      cell: ({ getValue }: any) => (
        <span className="font-mono text-[12.5px] text-gray-500">{String(getValue() || '--')}</span>
      ),
    },
    {
      header: 'Email Address',
      accessorKey: 'email',
      cell: ({ getValue }: any) => {
        const value = String(getValue() || '');
        if (!value) return <span className="text-gray-400">--</span>;
        return (
          <a href={`mailto:${value}`} className="text-gray-700 hover:text-[#dc2626]">
            {value}
          </a>
        );
      },
    },
    {
      header: 'Phone Number',
      accessorKey: 'phone',
      cell: ({ getValue }: any) => (
        <span className="whitespace-nowrap tabular-nums text-gray-700">
          {String(getValue() || '--')}
        </span>
      ),
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
                aria-label="Delete reseller"
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
          {/* Title and the primary action. Nothing to filter on here (a
              reseller has no status), so no segmented control; the search
              lives in the table card below, as on the other list pages. */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex min-w-0 items-center gap-2">
              <h1>Reseller</h1>
              <CustomTooltip
                side="bottom"
                sideOffset={10}
                className="mcm-tooltip-info"
                text="Reseller records used when you register brands and campaigns on behalf of your own customers."
              >
                <Info className="mcm-intpage-info" />
              </CustomTooltip>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="btn primary" onClick={() => setModalOpen(true)}>
                <Icon name="PlusIcon" className="w-3 h-3" />
                Create reseller
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
              recordNoun="reseller"
              {...{
                customHeader: (
                  <TableSearchHeader
                    value={search}
                    onChange={setSearch}
                    onRefresh={() =>
                      queryClient.invalidateQueries({ queryKey: ['getResellerList'] })
                    }
                    placeholder="Search resellers"
                  />
                ),
                hideFooterRefresh: true,
                fetcherKey: 'getResellerList',
                fetcherFn: getResellerList,
                columns,
                search,
                clientSideSearch: true,
                isHeightSet: false,
                emptyTablePlaceholder: 'No resellers yet',
                descriptionEmptyTable:
                  'Add a reseller to register brands and campaigns for your own customers.',
                /* This workspace has no resellers yet -- design preview only,
                   remove once there is real data to look at. */
                staticData: DEMO_RESELLERS,
              }}
            />
          </div>
        </div>
      </div>

      {modalOpen && (
        <CreateReseller
          handleClose={() => setModalOpen(false)}
          modalOpen={modalOpen}
          setModalOpen={setModalOpen}
        />
      )}

      <AlertConfirm
        {...{
          apiLoading: isPending,
          onConfirm: () => {
            mutateResellerDelete({
              resellerId: rowData?.resellerId,
            });
          },
          open,
          setOpen,
        }}
      />
    </>
  );
};

export default Reseller;
