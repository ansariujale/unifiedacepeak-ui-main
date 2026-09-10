import { Icon, IconName } from '@/assets/icons/icon';
import AlertConfirm from '@/components/custom/alert-confirm';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trash2 } from 'lucide-react';
import TableManager from '@/components/custom/table-manager';
import TableSearchHeader from '@/components/custom/table-search-header';
import { getVerificationList } from '@/services/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

export const DUMMY_VERIFICATIONS = [
  {
    verification_id: 'dummy-verification-1',
    did_number: '+1 202 555 0123',
    address: { country: 'United States', state: 'Los Angeles' },
    country: 'United States / Los Angeles',
    awaiting_registration: 'Pending',
    expires_at: '5 days',
  },
  {
    verification_id: 'dummy-verification-2',
    did_number: '+44 20 7946 0958',
    address: { country: 'United Kingdom', state: 'London' },
    country: 'United Kingdom / London',
    awaiting_registration: 'Approved',
    expires_at: '—',
  },
  {
    verification_id: 'dummy-verification-3',
    did_number: '+34 91 123 4567',
    address: { country: 'Spain', state: 'Madrid' },
    country: 'Spain / Madrid',
    awaiting_registration: 'Rejected',
    expires_at: '2 days',
  },
];

const Verification = ({
  search: debouncedSearch,
  liveSearch,
  setSearch,
  menuPortalTarget,
}: {
  /** Debounced value TableManager actually filters on. */
  search: string;
  /** Immediate value the search box itself displays. */
  liveSearch: string;
  setSearch: (value: string) => void;
  menuPortalTarget?: HTMLElement | null;
}) => {
  const [rowData, setRowData] = useState<any>(null);
  const [isTableRefreshing, setIsTableRefreshing] = useState(false);
  const tableRef = useRef<any>(null);
  const handleRefreshTable = async () => {
    setIsTableRefreshing(true);
    try {
      await tableRef.current?.refetchTable();
    } finally {
      setIsTableRefreshing(false);
    }
  };
  console.log('🚀 ~ Verification ~ rowData:', rowData);
  //   const [drawerState, setDrawerState] = useState({
  //     editAddress: false,
  //   });
  const [modalState, setModalState] = useState({
    deleteAddress: false,
    viewVerification: false,
  });
  const queryClient: any = useQueryClient();
  //   const handleDrawerClose = () => {
  //     setDrawerState((prev) => ({ ...prev, editAddress: false }));
  //     setRowData(null);
  //   };
  const handleModalClose = () => {
    setModalState((prev) => ({ ...prev, deleteAddress: false, viewVerification: false }));
    setRowData(null);
  };

  const { mutateAsync: mutateDeleteAddress, isPending: isDeleteAddressPending } = useMutation({
    mutationKey: ['deleteAddress'],
    // mutationFn: deleteAddress,
    onSuccess: () => {
      handleModalClose();
      queryClient.invalidateQueries({
        queryKey: ['getAddressesList'],
      });
    },
  });
  const columns = [
    {
      header: 'DID Number',
      accessorKey: 'did_number',
      cell: ({ row }: any) => {
        const { country = '', state = '' } = row?.original?.address || {};
        const name = `${country}/${state}`;
        return name;
      },
    },
    {
      header: 'Country/City',
      accessorKey: 'country',
    },
    {
      header: 'Status',
      accessorKey: 'awaiting_registration',
      cell: ({ row }: any) => {
        const status = row?.original?.awaiting_registration || '';
        const statusColour: Record<string, string> = {
          Pending: '#d97706',
          Approved: '#16a34a',
          Rejected: '#dc2626',
        };
        return (
          <span style={{ color: statusColour[status] || '#334155' }} className="font-medium">
            {status}
          </span>
        );
      },
    },
    {
      header: 'Time Left',
      accessorKey: 'expires_at',
    },
    {
      header: 'Action',
      accessorKey: 'action',
      cell: (props: any) => {
        const data = props?.row?.original;
        if (data?.is_primary) return;
        const actions = [
          {
            icon: 'Eye',
            onClick: () => {
              setRowData({ isEdit: true, formData: data });
              setModalState((prev) => ({ ...prev, viewVerification: true }));
            },
            className: 'bg-transparent! text-gray-900/80! hover:bg-gray-100! hover:text-gray-900!',
            tooltipText: 'View Verification',
          },
          {
            icon: 'TrashBin',
            onClick: () => {
              setRowData({ isEdit: true, formData: data });
              setModalState((prev) => ({ ...prev, deleteAddress: true }));
            },
            className: 'bg-transparent! text-gray-900/80! hover:bg-gray-100! hover:text-gray-900!',
            tooltipText: 'Delete',
          },
        ];

        return (
          <div className="flex items-center justify-center w-full">
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
                {actions?.map((action, index) => (
                  <DropdownMenuItem key={index} onClick={action.onClick} className={action.className}>
                    <Icon name={action.icon as IconName} className="w-4 h-4 text-current" />
                    {action.tooltipText}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <div className="ident-table-card ident-table-card--plain ident-table--verifications w-full flex flex-col">
        <TableManager
          {...{
            columns,
            search: debouncedSearch,
            tableRef,
            hideFooterRefresh: true,
            pagerAccentClassName: 'border-red-600 bg-red-600 text-white',
            perPageMenuPortalTarget: menuPortalTarget,
            hideFooterDivider: true,
            fitHeightToContent: true,
            customHeader: (
              <TableSearchHeader
                value={liveSearch}
                onChange={setSearch}
                onRefresh={handleRefreshTable}
                refreshing={isTableRefreshing}
                placeholder="Search verifications"
              />
            ),
            fetcherKey: 'getVerificationList',
            fetcherFn: getVerificationList,
            staticData: DUMMY_VERIFICATIONS,
            clientSideSearch: true,
            tableMaxHeight: '320px',
            emptyTablePlaceholder: 'No verifications found',
          }}
        />
      </div>

      {modalState?.viewVerification && rowData?.formData && (
        <Dialog open={modalState.viewVerification} onOpenChange={(open) => !open && handleModalClose()}>
          <DialogContent
            showCloseButton={false}
            className="ident-form-popup flex w-full flex-col gap-4 overflow-hidden p-6 sm:max-w-md"
          >
            <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0">
              <DialogTitle className="popup-title">Verification</DialogTitle>
              <button
                type="button"
                onClick={handleModalClose}
                aria-label="Close"
                className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full text-gray-500 hover:bg-red-50 hover:text-black"
              >
                <Icon name="CloseIcon" className="h-3 w-4" />
              </button>
            </DialogHeader>
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-500">DID Number</span>
                <span className="font-medium text-gray-900">
                  {rowData.formData?.did_number || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-500">Country/City</span>
                <span className="font-medium text-gray-900">{rowData.formData?.country || '—'}</span>
              </div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-500">Status</span>
                <span className="font-medium text-gray-900">
                  {rowData.formData?.awaiting_registration || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Time Left</span>
                <span className="font-medium text-gray-900">
                  {rowData.formData?.expires_at || '—'}
                </span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {modalState?.deleteAddress && (
        <AlertConfirm
          {...{
            apiLoading: isDeleteAddressPending,
            onConfirm: () => {
              return;
              mutateDeleteAddress();
            },
            open: modalState?.deleteAddress,
            setOpen: () => handleModalClose(),
            icon: <Trash2 className="h-7 w-7" />,
            iconTone: 'danger',
            headerClassName: 'ident-confirm-title',
            confirmBtnClassName: 'rounded-full bg-red-600 hover:bg-red-700 text-white border-red-600',
            closeBtnClassName:
              'rounded-full border border-gray-200 text-gray-700! hover:bg-gray-50! hover:text-gray-700! focus-visible:ring-0! shadow-none!',
            className: 'sm:w-1/2 md:w-1/2 lg:w-2/5 bg-white!',
          }}
        />
      )}
    </div>
  );
};

export default Verification;
