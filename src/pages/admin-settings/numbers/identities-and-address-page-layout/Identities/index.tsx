import { Icon, IconName } from '@/assets/icons/icon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X, Trash2 } from 'lucide-react';
import TableManager from '@/components/custom/table-manager';
import TableSearchHeader from '@/components/custom/table-search-header';
import {
  deleteIdentity,
  getIdentityList,
  updateIdentity,
  uploadIdentityProof,
  uploadIdentitySupportingDocuments,
} from '@/services/api';
import { useRef, useState } from 'react';
import CreateIdentity from '../../all-numbers/add-number-2/create-identity';
import { yupResolver } from '@hookform/resolvers/yup';
import { identitiesUpdateSchema, initialState } from '../../all-numbers/constants';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { parsePhoneNumber } from 'libphonenumber-js/max';
import { darkenColor, lightenColorWithAlpha, stringToColour } from '@/lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Loader from '@/components/custom/loader';
import { handleAlert } from '@/lib/utils';
import AlertConfirm from '@/components/custom/alert-confirm';
import Flag from '@/components/flag';

export const DUMMY_IDENTITIES = [
  {
    identity_id: 'dummy-identity-1',
    identity: { firstname: 'John', lastname: 'Doe', prefix: '+1', phone: '2025551234' },
    identity_type: 'Individual',
    address_count: 1,
    proof_count: 2,
  },
  {
    identity_id: 'dummy-identity-2',
    identity: { firstname: 'Acme', lastname: 'Corp', prefix: '+44', phone: '2079460958' },
    identity_type: 'Business',
    address_count: 2,
    proof_count: 3,
  },
  {
    identity_id: 'dummy-identity-3',
    identity: { firstname: 'Maria', lastname: 'Garcia', prefix: '+34', phone: '600123456' },
    identity_type: 'Individual',
    address_count: 1,
    proof_count: 1,
  },
];

const Identities = ({
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
  const [drawerState, setDrawerState] = useState({
    editIdentity: false,
  });
  const [modalState, setModalState] = useState({
    deleteIdentity: false,
  });
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
  const formInstance = useForm<any>({
    defaultValues: initialState,
    resolver: yupResolver(identitiesUpdateSchema),
    // context: { schemaContext },
    mode: 'onChange',
  });
  const handleDrawerClose = () => {
    setDrawerState((prev) => ({ ...prev, editIdentity: false }));
    setRowData(null);
  };
  const handleModalClose = () => {
    setModalState((prev) => ({ ...prev, deleteIdentity: false }));
    setRowData(null);
  };

  const { handleSubmit, getValues } = formInstance;
  // const proofs = useWatch({ name: 'proofs', control }) || [];
  const queryClient: any = useQueryClient();

  const { mutateAsync: mutateUploadProofs, isPending: isUploadProofPending } = useMutation({
    mutationKey: ['uploadIdentityProof'],
    mutationFn: uploadIdentityProof,
  });

  const { mutateAsync: mutateUploadSupportingDocs, isPending: isUploadSupportingDocuments } =
    useMutation({
      mutationKey: ['uploadIdentitySupportingDocuments'],
      mutationFn: uploadIdentitySupportingDocuments,
    });

  const { mutate: mutateUpdateIdentity, isPending: isUpdateIdentityPending } = useMutation({
    mutationKey: ['updateIdentity'],
    mutationFn: updateIdentity,

    onSuccess: async (data) => {
      const identityId = rowData?.formData?.identity_id || '';

      const files = getValues('proofs') || [];
      const supportingDocs = getValues('supporting_documents') || [];

      const proofFiles = files.filter((item: any) => item?.file instanceof File);
      const supportingDocFiles = supportingDocs.filter((item: any) => item?.file instanceof File);

      const uploadTasks: Promise<any>[] = [];
      if (proofFiles.length > 0) {
        const formData = new FormData();

        proofFiles.forEach((item: any) => {
          formData.append('identity_proof', item.file);
          formData.append('proof_type_id[]', item.proof_type_id?.value);
        });

        formData.append('identity_id', identityId);
        formData.append('type', 'identity');
        uploadTasks.push(mutateUploadProofs(formData));
      }
      if (supportingDocFiles.length > 0) {
        const formData = new FormData();
        supportingDocFiles.forEach((item: any) => {
          formData.append('identity_supporting_document', item.file);
          formData.append(
            'supporting_document_template_id[]',
            item.supporting_document_template_id?.value,
          );
        });

        formData.append('identity_id', identityId);
        formData.append('type', 'supporting_document');
        uploadTasks.push(mutateUploadSupportingDocs(formData));
      }

      try {
        if (uploadTasks.length > 0) {
          await Promise.all(uploadTasks);
        }
        handleAlert({
          text: data?.data?.data?.message || 'Identity updated successfully!',
          type: 'success',
        });
        queryClient.invalidateQueries({
          queryKey: ['getIdentityList'],
        });
        setDrawerState((prev) => ({ ...prev, editIdentity: false }));
      } catch (err) {
        console.log(err);
      }
    },
  });

  const { mutateAsync: mutateDeleteIdentity, isPending: isDeleteIdentityPending } = useMutation({
    mutationKey: ['deleteIdentity'],
    mutationFn: deleteIdentity,
    onSuccess: () => {
      handleModalClose();
      queryClient.invalidateQueries({
        queryKey: ['getIdentityList'],
      });
    },
  });

  const isLoading = [
    isUpdateIdentityPending,
    isUploadProofPending,
    isUploadSupportingDocuments,
  ].some((v) => v);

  const columns = [
    {
      /* Indented by the avatar's own width (w-8 = 32px) plus the gap next
         to it (gap-2.5 = 10px) so "Name" sits directly above the actual
         name text below it, not above the avatar circle that precedes it. */
      header: () => <span className="pl-[42px]">Name</span>,
      accessorKey: 'identity',
      cell: ({ row }: any) => {
        const data = row?.original || {};
        const firstname = data?.identity?.firstname || '';
        const lastname = data?.identity?.lastname || '';
        const name = `${firstname} ${lastname}`.trim();
        const initials = `${firstname.charAt(0)}${lastname.charAt(0)}`.toUpperCase() || '?';
        const nameColour = stringToColour(name || '?') || '#dc2626';
        const textColour = darkenColor(nameColour, 90);
        const bgColour = lightenColorWithAlpha(nameColour, 5, 0.15);
        return (
          <div className="flex items-center gap-2.5">
            <div
              style={{ color: textColour, background: bgColour }}
              className="flex items-center justify-center w-8 h-8 min-w-8 rounded-full text-xs font-semibold"
            >
              {initials}
            </div>
            <span>{name}</span>
          </div>
        );
      },
    },
    {
      header: 'Type',
      accessorKey: 'identity_type',
      cell: ({ row }: any) => (
        <span className="ident-type-badge">{row?.original?.identity_type}</span>
      ),
    },
    {
      /* No longer indented to clear the flag icon — that offset was for
         when this header sat left-aligned over a left-aligned value. Both
         are centered now (see the column's own centering below), so the
         plain header text and the value's own centered content line up
         without it. */
      header: 'Phone Number',
      accessorKey: 'exp_year',
      cell: ({ row }: any) => {
        const data = row?.original || {};
        const prefix = data?.identity?.prefix || '';
        const rawNumber = data?.identity?.phone || '';
        const phone = `${prefix}${rawNumber}`;
        let formatted = `${prefix} ${rawNumber}`;
        try {
          formatted = parsePhoneNumber(phone)?.formatInternational() || formatted;
        } catch {
          // Keep the plain prefix + digits fallback above.
        }
        return (
          /* inline-flex, not flex: a block-level flex span ignores the
             td's text-align: center entirely (block boxes don't respond
             to an ancestor's text-align for their own position), which is
             why this value stayed pinned left while the now-centered
             header floated off to the right of it. */
          <span className="inline-flex items-center gap-1.5 text-[var(--ink)]">
            <Flag phoneNumber={phone} svg />
            {formatted}
          </span>
        );
      },
    },
    {
      header: () => <span className="flex w-full justify-center">Address</span>,
      accessorKey: 'address_count',
      meta: { textAlign: 'center' },
      cell: ({ row }: any) => (
        <div className="flex w-full items-center justify-center">
          <span className="ident-count-chip">{row?.original?.address_count}</span>
        </div>
      ),
    },
    {
      header: () => <span className="flex w-full justify-center">Proofs</span>,
      accessorKey: 'proof_count',
      meta: { textAlign: 'center' },
      cell: ({ row }: any) => (
        <div className="flex w-full items-center justify-center">
          <span className="ident-count-chip">{row?.original?.proof_count}</span>
        </div>
      ),
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
              setDrawerState((prev) => ({ ...prev, editIdentity: true }));
            },
            className: 'bg-transparent! text-gray-900/80! hover:bg-gray-100! hover:text-gray-900!',
            tooltipText: 'Edit',
          },
          {
            icon: 'TrashBin',
            onClick: () => {
              setRowData({ isEdit: true, formData: data });
              setModalState((prev) => ({ ...prev, deleteIdentity: true }));
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

  const onSubmit = (values: any) => {
    const {
      type,
      company_name,
      company_registration_number,
      vat_number,
      website,
      firstname,
      lastname,
      email,
      phone,
      tax_id,
      id_number,
      country,
      birth_place,
      day,
      month,
      year,
      description,
      requirements_type,
      requirements_country,
      number_type,
    } = values || {};
    const identityId = rowData?.formData?.identity_id || '';
    const parsedNumber = parsePhoneNumber(phone.startsWith('+') ? phone : `+${phone}`);
    const paddedDay = String(day).padStart(2, '0');
    const isBirthDateValid = year && month && paddedDay && ![year, month, paddedDay].includes('--');
    const payload = {
      type: type?.value,
      company_name,
      company_registration_number,
      vat_number,
      website,
      firstname,
      lastname,
      email,
      prefix: `+${parsedNumber?.countryCallingCode}`,
      phone: parsedNumber?.nationalNumber,
      tax_id,
      id_number,
      country: country?.value,
      birth_place: birth_place?.value,
      birth_date: isBirthDateValid ? `${year}-${month?.value}-${paddedDay}` : '',
      description,
      requirements_type: requirements_type?.value,
      requirements_country,
      number_type,
      uuid: identityId,
    };
    mutateUpdateIdentity(payload);
  };

  return (
    <div>
      <div className="ident-table-card ident-table-card--plain ident-table--identities w-full flex flex-col">
        <TableManager
          {...{
            columns,
            search: debouncedSearch,
            tableRef,
            hideFooterRefresh: true,
            pagerAccentClassName: 'border-red-600 bg-red-600 text-white',
            customHeader: (
              <TableSearchHeader
                value={liveSearch}
                onChange={setSearch}
                onRefresh={handleRefreshTable}
                refreshing={isTableRefreshing}
                placeholder="Search identities"
                rightSlot={
                  <div className="ml-auto flex h-9 shrink-0 items-center gap-3 rounded-full border border-neutral-200 bg-white px-3.5 text-sm">
                    <span className="font-semibold text-gray-900">All {DUMMY_IDENTITIES.length}</span>
                    <span className="h-4 w-px bg-neutral-200" />
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
                      Business{' '}
                      {DUMMY_IDENTITIES.filter((row) => row.identity_type === 'Business').length}
                    </span>
                  </div>
                }
              />
            ),
            fetcherKey: 'getIdentityList',
            fetcherFn: getIdentityList,
            staticData: DUMMY_IDENTITIES,
            clientSideSearch: true,
            perPageMenuPortalTarget: menuPortalTarget,
            hideFooterDivider: true,
            fitHeightToContent: true,
            /* A fixed height rather than isHeightSet:false — that let the
               card grow and shrink with the row count, which as you typed
               into search (clientSideSearch filters rows live) made the
               whole tabs+table card visibly jump up and down. A stable
               height tall enough for this page's small dummy dataset gives
               both: no internal scrollbar, and no reflow while filtering. */
            tableMaxHeight: '320px',
            emptyTablePlaceholder: 'No identities yet',
            descriptionEmptyTable:
              'Identities are created while buying a number that requires verification. Any you register during that flow appear here.',
          }}
        />
      </div>
      {drawerState.editIdentity && (
        <Dialog open={drawerState.editIdentity} onOpenChange={(open) => !open && handleDrawerClose()}>
          <DialogContent
            showCloseButton={false}
            onPointerDownOutside={(e) => e.preventDefault()}
            className="ident-form-popup flex max-h-[88vh] w-full flex-col gap-4 overflow-hidden p-6 sm:max-w-2xl lg:max-w-3xl"
          >
            <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0">
              <DialogTitle className="popup-title">Edit Identity</DialogTitle>
              <button
                type="button"
                onClick={handleDrawerClose}
                aria-label="Close"
                className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full text-gray-500 hover:bg-red-50 hover:text-black"
              >
                <X className="h-3 w-4" />
              </button>
            </DialogHeader>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
            >
              <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
                <CreateIdentity
                  rowData={rowData}
                  className="h-full"
                  handleClose={handleDrawerClose}
                  formInstance={formInstance}
                />
              </div>
              <div className="flex flex-none items-center justify-end gap-2 border-t border-gray-200 pt-3">
                <Button
                  type="button"
                  onClick={handleDrawerClose}
                  variant={'outline'}
                  className="flex items-center gap-1.5 rounded-full border-gray-300 bg-white text-black hover:bg-gray-100 hover:text-black"
                >
                  Cancel
                </Button>
                <Button
                  disabled={isLoading}
                  variant={'outline'}
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
      {modalState?.deleteIdentity && (
        <AlertConfirm
          {...{
            apiLoading: isDeleteIdentityPending,
            onConfirm: () => {
              mutateDeleteIdentity({ identity_id: rowData?.formData?.identity_id });
            },
            open: modalState?.deleteIdentity,
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

export default Identities;
