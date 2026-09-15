import { Icon } from '@/assets/icons/icon';
import CustomAvatar from '@/components/custom/custom-avatar';
import CustomSelect from '@/components/custom/custom-select';
import NumberWithFlag from '@/components/custom/number-with-flag';
import TableManager from '@/components/custom/table-manager';
import TableSearchHeader from '@/components/custom/table-search-header';
import { invalidateNumberLists } from '@/lib/number-list-cache';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ISELECTVALUE } from '@/interfaces/api-interfaces';
import { ModalProps } from '@/interfaces/common-interface';
import { handleAlert } from '@/lib/utils';
import { allNumbersList, assignDIDNumber, getUserList } from '@/services/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { FC, useRef, useState } from 'react';

interface IAssignDID {
  uuid: string;
  role_data: { name: string };
  did_number: any;
  phone: string;
  caller_id: string;
}

interface IDID {
  did_number: string;
  uuid: string;
}

interface IAsiignDIDProps extends ModalProps {
  selectedDidNumber: any;
}

/* The "You have selected this DID" picker showed each option as the raw
   did_number string — no flag, no spacing — while the table right next to
   it renders the same numbers through NumberWithFlag. Reusing that here
   keeps the two reading as one consistent number format instead of one
   looking unfinished next to the other. */
const DidNumberOptionView = ({ option }: { option?: ISELECTVALUE }) => (
  <NumberWithFlag number={option?.value} />
);

const AssignDIDNumber: FC<IAsiignDIDProps> = ({ modalState, setModalState, selectedDidNumber }) => {
  const [search, setSearch] = useState<string>('');
  const [selected, setSelected] = useState<IAssignDID | null>(null);
  const [didNumber, setDIDNumber] = useState<ISELECTVALUE | null>({
    label: selectedDidNumber?.did_number || '',
    value: selectedDidNumber?.did_number || '',
  });
  const [isTableRefreshing, setIsTableRefreshing] = useState(false);
  const tableRef = useRef<any>(null);
  /* The per-page picker's dropdown menu renders into document.body by
     default, escaping the .ident-form-popup scope below (which lives on
     the portaled DialogContent itself) — same fix as Identities &
     addresses' own menuPortalTarget. */
  const [menuPortalTarget, setMenuPortalTarget] = useState<HTMLDivElement | null>(null);
  const handleRefreshTable = async () => {
    setIsTableRefreshing(true);
    try {
      await tableRef.current?.refetchTable();
    } finally {
      setIsTableRefreshing(false);
    }
  };
  const queryClient: any = useQueryClient();

  const { data: DIDUnassignList = [] } = useQuery({
    queryKey: ['numbersInventoryTable'],
    queryFn: () => allNumbersList({ type: 'inventory' }),
    select: (data) => data?.data?.data?.result?.rows || [],
  });

  const { mutate: mutateAssignNumber, isPending: isPendingAssignNumber } = useMutation({
    mutationFn: assignDIDNumber,
    onSuccess: (data: any) => {
      invalidateNumberLists(queryClient);
      handleAlert({
        text: data?.data?.data?.message || 'DID Assigned Successfully.',
        type: 'success',
      });
      setModalState(false);
    },
  });

  const columns: ColumnDef<IAssignDID>[] = [
    {
      header: 'Select',
      accessorKey: 'created_at',
      cell: ({ row }) => {
        return (
          <div className="flex justify-center cursor-pointer">
            <RadioGroup value={selected?.uuid} onValueChange={() => setSelected(row?.original)}>
              <div className="flex items-center gap-3">
                <RadioGroupItem value={row?.original?.uuid} id="yes" />
              </div>
            </RadioGroup>
          </div>
        );
      },
    },

    {
      header: 'User Details',
      accessorKey: 'first_name',
      cell: ({ row }: any) => {
        const data = row?.original;
        const fullName = `${data?.first_name}${data?.last_name ? ` ${data?.last_name}` : ''}`;
        return (
          <div className="flex items-center gap-2 w-full">
            <div className="flex ">
              <CustomAvatar
                name={fullName}
                showPresence
                extension={data?.extension}
                image={data?.profile}
              />
            </div>
            <div className="flex flex-col w-full">
              <div className="flex items-center justify-between  gap-2">
                <div className="flex flex-col items-start ">
                  <p className="capitalize">{fullName}</p>
                  <small className="text-primary text-[10px]">
                    {data?.custom_role_data?.name || data?.role_data?.name || data?.role}
                  </small>
                </div>
                <div className="flex items-center gap-1 text-gray-500">
                  <Icon name="Grid" className="w-4 h-4 " />
                  <div>{data?.extension}</div>
                </div>
              </div>
              <p className="text-gray-500 flex justify-between">
                <div>{data?.email}</div>
              </p>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Phone',
      accessorKey: 'phone',
      cell: ({ getValue }) => <NumberWithFlag number={getValue()} />,
    },
    {
      header: 'Caller Id',
      accessorKey: 'caller_id',
      cell: ({ getValue, row }) => {
        const data: any = row?.original || {};
        if (data?.assigned_did && data?.assigned_did?.length > 1) {
          return (
            <CustomSelect
              className="max-w-40"
              options={data?.assigned_did?.map((v: any) => ({
                label: v?.did_number,
                value: v?.did_number,
              }))}
              value={{ value: getValue(), label: getValue() }}
            />
          );
        } else {
          return <NumberWithFlag number={getValue()} />;
        }
      },
    },
    {
      header: 'Site',
      accessorKey: 'site',
      cell: ({ row }: any) => row?.original?.site?.name || '---',
    },
  ];
  const handleSubmit = () => {
    if (selected?.uuid) {
      mutateAssignNumber({ uuid: selected?.uuid, did_number: didNumber?.value });
    }
  };
  return (
    <Dialog open={modalState} onOpenChange={(val) => setModalState(val)}>
      <DialogContent
        ref={setMenuPortalTarget}
        className="ident-form-popup min-w-3/5 w-fit p-3"
        showCloseButton={false}
      >
        <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <DialogTitle className="popup-title">Assign Number</DialogTitle>
          <button
            type="button"
            onClick={() => setModalState(false)}
            aria-label="Close"
            className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full text-gray-500 hover:bg-red-50 hover:text-black"
          >
            <Icon name="CloseIcon" className="h-3 w-4" />
          </button>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          <div className="flex justify-between  gap-2 items-end">
            <div className="flex flex-col  gap-1">
              <Label className="mb-1">You have selected this DID:</Label>
              <div>
                <CustomSelect
                  options={
                    DIDUnassignList?.length > 0 &&
                    DIDUnassignList?.map((item: IDID) => ({
                      id: item?.uuid,
                      label: item?.did_number,
                      value: item?.did_number,
                    }))
                  }
                  handleChange={(e: ISELECTVALUE | null) => {
                    setDIDNumber(e);
                  }}
                  value={didNumber}
                  FormatOptionLabel={DidNumberOptionView}
                />
              </div>
            </div>
            <TableSearchHeader
              value={search}
              onChange={setSearch}
              onRefresh={handleRefreshTable}
              refreshing={isTableRefreshing}
              placeholder="Search"
            />
          </div>
          <div className="ident-table-card flex h-[calc(100vh_-_19rem)] flex-col overflow-auto rounded-t-xl rounded-b-none border-x border-t border-gray-200 bg-white">
            <TableManager
              {...{
                emptyTablePlaceholder: 'No spare numbers',
                descriptionEmptyTable:
                  'Every number you own is already assigned. Buy another, or free one up first.',
                columns,
                fetcherKey: 'getUserListQueryFn',
                fetcherFn: getUserList,
                showPagination: true,
                pagerAccentClassName: 'border-red-600 bg-red-600 text-white',
                perPageMenuPortalTarget: menuPortalTarget,
                hideFooterDivider: true,
                hideFooterRefresh: true,
                fitHeightToContent: true,
                tableRef,
                search,
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <div className="justify-end flex gap-2">
            <Button
              type="button"
              variant={'transparent'}
              className="rounded-full border border-gray-300! bg-white! text-gray-700! hover:bg-gray-50! hover:text-gray-700! focus-visible:ring-0! shadow-none!"
              onClick={() => setModalState(false)}
            >
              Cancel
            </Button>
            <Button
              variant={'outline'}
              type="button"
              disabled={!selected?.uuid}
              onClick={() => handleSubmit()}
              className="rounded-full border-black bg-black px-5 text-white hover:bg-gray-800 hover:text-white disabled:border-gray-300 disabled:bg-gray-300 disabled:text-gray-500"
            >
              {isPendingAssignNumber ? 'Submiting...' : 'Submit'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignDIDNumber;
