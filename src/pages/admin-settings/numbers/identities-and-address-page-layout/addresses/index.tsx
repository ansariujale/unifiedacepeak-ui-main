import { Icon, IconName } from '@/assets/icons/icon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import TableManager from '@/components/custom/table-manager';
import TableSearchHeader from '@/components/custom/table-search-header';
import { deleteAddress, getAddressesList, updateAddress, uploadAddressProof } from '@/services/api';
import { useRef, useState } from 'react';
import CreateNewAddress from './create-new-address';
import AlertConfirm from '@/components/custom/alert-confirm';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Loader from '@/components/custom/loader';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addressUpdateSchema, initialState } from '../../all-numbers/constants';
import { yupResolver } from '@hookform/resolvers/yup';

export const DUMMY_ADDRESSES = [
  {
    address_id: 'dummy-address-1',
    identity_id: 'dummy-identity-1',
    address: {
      country: 'United States',
      state: 'California',
      city: 'Los Angeles',
      zipcode: '90001',
      address: '123 Sunset Blvd',
      description: 'Head office',
    },
    address_proof: [{ id: 1 }, { id: 2 }],
  },
  {
    address_id: 'dummy-address-2',
    identity_id: 'dummy-identity-2',
    address: {
      country: 'United Kingdom',
      state: 'England',
      city: 'London',
      zipcode: 'EC1A 1BB',
      address: '221B Baker Street',
      description: 'UK branch office',
    },
    address_proof: [{ id: 1 }],
  },
  {
    address_id: 'dummy-address-3',
    identity_id: 'dummy-identity-3',
    address: {
      country: 'Spain',
      state: 'Madrid',
      city: 'Madrid',
      zipcode: '28001',
      address: 'Calle Gran Via 1',
      description: 'EU support office',
    },
    address_proof: [{ id: 1 }, { id: 2 }, { id: 3 }],
  },
];

const Addresses = ({
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
  const [drawerState, setDrawerState] = useState({
    editAddress: false,
  });
  const [modalState, setModalState] = useState({
    deleteAddress: false,
  });
  const queryClient: any = useQueryClient();
  const handleDrawerClose = () => {
    setDrawerState((prev) => ({ ...prev, editAddress: false }));
    setRowData(null);
  };
  const handleModalClose = () => {
    setModalState((prev) => ({ ...prev, deleteAddress: false }));
    setRowData(null);
  };
  const formInstance = useForm<any>({
    // defaultValues: initialAddressState,
    defaultValues: initialState,
    resolver: yupResolver(addressUpdateSchema),
    mode: 'onChange',
  });
  const { handleSubmit, getValues } = formInstance;
  const { mutate: mutateUpload, isPending: isUploadProofPending } = useMutation({
    mutationKey: ['uploadAddressProof'],
    mutationFn: uploadAddressProof,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['getAddressesList'],
      });
    },
  });
  const { mutate: mutateUpdateAddress, isPending: isUpdateAddressPending } = useMutation({
    mutationKey: ['updateAddress'],
    mutationFn: updateAddress,
    onSuccess: () => {
      const addressId = rowData?.formData?.address_id;
      const identityId = rowData?.formData?.identity_id;
      const files = getValues('addressProofs') || [];

      const proofFiles = files?.filter((item: any) => item?.file instanceof File);
      if (proofFiles?.length > 0) {
        const formData = new FormData();
        proofFiles?.forEach((item: any) => {
          formData.append('identity_address_proof', item?.file);
          formData.append('proof_type_id[]', item?.proof_type_id?.value);
        });
        formData.append('type', 'address');
        formData.append('address_id', addressId);
        formData.append('identity_id', identityId);
        mutateUpload(formData);
      }
      queryClient.invalidateQueries({
        queryKey: ['getAddressesList'],
      });
      handleDrawerClose();
    },
  });

  const isLoading = [isUpdateAddressPending, isUploadProofPending].some((v) => v);
  const { mutateAsync: mutateDeleteAddress, isPending: isDeleteAddressPending } = useMutation({
    mutationKey: ['deleteAddress'],
    mutationFn: deleteAddress,
    onSuccess: () => {
      handleModalClose();
      queryClient.invalidateQueries({
        queryKey: ['getAddressesList'],
      });
    },
  });

  const columns = [
    {
      header: 'Country',
      accessorKey: 'address.country',
    },
    {
      header: 'Region',
      accessorKey: 'address.state',
    },
    {
      header: 'City',
      accessorKey: 'address.city',
    },
    {
      header: 'Postal Code',
      accessorKey: 'address.zipcode',
    },
    {
      header: 'Address',
      accessorKey: 'address.address',
    },
    {
      header: () => <span className="flex w-full justify-center">Proofs</span>,
      accessorKey: 'address_proof',
      meta: { textAlign: 'center' },
      cell: ({ row }: any) => {
        const proofsArr = row?.original?.address_proof || [];
        return (
          <div className="flex w-full items-center justify-center">{proofsArr?.length || 0}</div>
        );
      },
    },
    {
      header: 'Description',
      accessorKey: 'address.description',
    },
    {
      header: 'Action',
      accessorKey: 'action',
      cell: (props: any) => {
        const data = props?.row?.original;
        if (data?.is_primary) return;
        const actions = [
          {
            icon: 'EditStrokIcon',
            onClick: () => {
              setRowData({ isEdit: true, formData: data });
              setDrawerState((prev) => ({ ...prev, editAddress: true }));
            },
            className: 'bg-transparent! text-gray-900/80! hover:bg-gray-100! hover:text-gray-900!',
            tooltipText: 'Edit',
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

  const onSubmit = ({
    // requirements_type,
    // requirements_country,
    // number_type,
    address_state,
    addressDescription,
    country,
    addressProofs,
    ...rest
  }: {
    requirements_type?: string;
    requirements_country?: string;
    number_type?: string;
    country?: any;
    address_state?: string;
    addressDescription?: string;
    addressProofs?: any;
    rest?: object;
  }) => {
    // console.log(requirements_country, requirements_type, number_type);
    const payload = {
      ...rest,
      identity_id: rowData?.isEdit ? rowData?.formData?.identity_id : rowData?.formData?.id,
      address_id: rowData?.isEdit ? rowData?.formData?.address_id : rowData?.formData?.id,
      country: country?.value,
      state: address_state,
      description: addressDescription,
      proofs: addressProofs,
      ...(rowData?.isEdit && { uuid: rowData?.id }),
    };
    mutateUpdateAddress(payload);
  };
  return (
    <div>
      <div className="ident-table-card ident-table-card--plain ident-table--addresses w-full flex flex-col">
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
                placeholder="Search addresses"
                rightSlot={
                  <div className="ml-auto flex h-9 shrink-0 items-center gap-3 rounded-full border border-neutral-200 bg-white px-3.5 text-sm">
                    <span className="font-semibold text-gray-900">All {DUMMY_ADDRESSES.length}</span>
                    <span className="h-4 w-px bg-neutral-200" />
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
                      Countries{' '}
                      {new Set(DUMMY_ADDRESSES.map((row) => row.address.country)).size}
                    </span>
                  </div>
                }
              />
            ),
            fetcherKey: 'getAddressesList',
            fetcherFn: getAddressesList,
            staticData: DUMMY_ADDRESSES,
            clientSideSearch: true,
            tableMaxHeight: '320px',
            emptyTablePlaceholder: 'No addresses yet',
            descriptionEmptyTable:
              'Service addresses are created while buying a number that requires one. Any you add during that flow appear here.',
          }}
        />
      </div>
      {drawerState.editAddress && (
        <Dialog open={drawerState.editAddress} onOpenChange={(open) => !open && handleDrawerClose()}>
          <DialogContent
            showCloseButton={false}
            onPointerDownOutside={(e) => e.preventDefault()}
            className="ident-form-popup flex max-h-[88vh] w-full flex-col gap-4 overflow-hidden p-6 sm:max-w-2xl lg:max-w-3xl"
          >
            <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0">
              <DialogTitle className="popup-title">Edit Address</DialogTitle>
              <button
                type="button"
                onClick={handleDrawerClose}
                aria-label="Close"
                className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full text-gray-500 hover:bg-red-50 hover:text-black"
              >
                <Icon name="CloseIcon" className="h-3 w-4" />
              </button>
            </DialogHeader>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
            >
              <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
                <CreateNewAddress rowData={rowData} formInstance={formInstance} />
              </div>
              <div className="flex flex-none items-center justify-end gap-2 border-t border-gray-200 pt-3">
                <Button
                  type="button"
                  onClick={handleDrawerClose}
                  variant="outline"
                  className="rounded-full border-gray-300 bg-white text-black hover:bg-gray-100 hover:text-black"
                >
                  Cancel
                </Button>
                <Button
                  disabled={isLoading}
                  variant="outline"
                  type="submit"
                  className="min-w-32 rounded-full border-black bg-black text-white hover:bg-gray-800 hover:text-white"
                >
                  {isLoading && <Loader variant="blue" />}Update
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
      {modalState?.deleteAddress && (
        <AlertConfirm
          {...{
            apiLoading: isDeleteAddressPending,
            onConfirm: () => {
              mutateDeleteAddress({ address_id: rowData?.formData?.address_id });
            },
            open: modalState?.deleteAddress,
            setOpen: () => handleModalClose(),
            icon: <Trash2 className="h-7 w-7" />,
            iconTone: 'danger',
            headerClassName: 'ident-confirm-title',
            confirmBtnClassName: 'rounded-full bg-red-600 hover:bg-red-700 text-white border-red-600',
            closeBtnClassName:
              'rounded-full border border-gray-200 text-gray-700! hover:bg-gray-50! hover:text-gray-700! focus-visible:ring-0! shadow-none!',
            className: 'sm:w-2/5 md:w-1/3 lg:w-[30%] bg-white!',
          }}
        />
      )}
    </div>
  );
};

export default Addresses;
