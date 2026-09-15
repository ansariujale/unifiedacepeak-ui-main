import { Icon } from '@/assets/icons/icon';
import TableManager from '@/components/custom/table-manager';
import { Button } from '@/components/ui/button';
import { convertDateFormateApis, handleAlert } from '@/lib/utils';
import { deleteReposition } from '@/services/api';
import { useRef, useState } from 'react';
import DispositionModal from './add-edit-dispositions';
import AlertConfirm from '@/components/custom/alert-confirm';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompanyFeatures } from '@/hooks/rbac';
import { Plus, RefreshCcw, Search } from 'lucide-react';
import './dispositions.css';
import './dispositions-table.css';

/* TEMP: sample rows for reviewing the table's visual redesign while the
   account has no real disposition logs. Mimics the real API's response
   shape (rather than TableManager's `staticData` escape hatch) so the
   footer's record count and page-number pager still work correctly.
   Remove this function and go back to `fetcherFn: getDispositions` once
   real data is available. */
const fetchDummyDispositions = () =>
  Promise.resolve({
    data: {
      data: {
        result: {
          totalItems: 3,
          totalPages: 1,
          rows: [
            {
              _id: 'dummy-1',
              createdAt: '2026-09-05T10:00:00.000Z',
              dispositionType: 'CUSTOM',
              disposition: { name: 'Interested', description: 'Lead wants a follow-up call.' },
            },
            {
              _id: 'dummy-2',
              createdAt: '2026-09-03T10:00:00.000Z',
              dispositionType: 'CUSTOM',
              disposition: { name: 'Not Interested', description: 'Declined the offer.' },
            },
            {
              _id: 'dummy-3',
              createdAt: '2026-09-01T10:00:00.000Z',
              dispositionType: 'SYSTEM',
              disposition: { name: 'No Answer', description: 'Call went unanswered.' },
            },
          ],
        },
      },
    },
  });

const DispositionsList = () => {
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState<any>(null);
  const [search, setSearch] = useState('');
  const dispositionTableRef = useRef<any>(null);
  const queryClient: any = useQueryClient();
  const { features } = useCompanyFeatures();
  const dispositionAccess = features?.plan_features?.campaign?.action;
  const [modalState, setModalState] = useState<{ isModalOpen: boolean; selectedCampaign: any }>({
    isModalOpen: false,
    selectedCampaign: null,
  });

  const { mutate: mutateDeleteDisposition, isPending: isPendingDeleteCampaign } = useMutation({
    mutationFn: deleteReposition,
    onSuccess: (data) => {
      if (data?.data?.success) {
        handleAlert({
          text: data?.data?.message || 'Disposition deleted successfully!',
          type: 'success',
        });
        setShowDeleteConfirmation(null);
        queryClient.invalidateQueries(['getDispositionsList']);
      }
    },
  });

  const columns: any = [
    {
      header: 'Date',
      accessorKey: 'createdAt',
      cell: ({ row }: any) => {
        const data = row?.original;
        return <div>{convertDateFormateApis(data?.createdAt, 'MMM D, YYYY')}</div>;
      },
    },
    {
      header: 'Name',
      accessorKey: 'name',
      cell: ({ row }: any) => {
        const data = row?.original;
        return <div>{data?.disposition?.name}</div>;
      },
    },

    {
      header: 'Description',
      accessorKey: 'description',
      cell: ({ row }: any) => {
        const data = row?.original;
        return <div>{data?.disposition?.description}</div>;
      },
    },
    {
      header: 'Action',
      accessorKey: 'action',
      cell: ({ row }: any) => {
        // const companyId = row?.original?.companyId;
        const campaign = row?.original;

        // if (!companyId) return null;

        const hasAccess = campaign?.dispositionType !== 'SYSTEM';

        return (
          <span className="flex gap-2 items-center">
            <span
              className={`flex items-center justify-center rounded-full w-8 h-8 ${
                hasAccess
                  ? 'cursor-pointer bg-gray-100 text-gray-900/80 hover:bg-primary hover:text-white'
                  : 'cursor-not-allowed bg-gray-100 text-gray-400 opacity-50'
              }`}
              onClick={() => {
                if (campaign?.dispositionType === 'SYSTEM') return;
                setModalState((prev) => ({
                  ...prev,
                  selectedCampaign: campaign,
                  isModalOpen: true,
                }));
              }}
            >
              <Icon
                name="EditStrokIcon"
                className={`w-5 h-5 ${
                  campaign?.campaignStatus === 'PROCESSING' ? 'text-gray-400' : ''
                }`}
              />
            </span>

            <span
              className={`flex items-center justify-center rounded-full w-8 h-8 ${
                hasAccess
                  ? 'cursor-pointer bg-red-100 text-red-500 hover:bg-red-500 hover:text-white'
                  : 'cursor-not-allowed bg-red-100 text-red-300 opacity-50'
              }`}
              onClick={() => {
                if (campaign?.dispositionType === 'SYSTEM') return;
                setShowDeleteConfirmation(campaign);
              }}
            >
              <Icon name="TrashBin" className="w-5 h-5" />
            </span>
          </span>
        );
      },
    },
  ];
  return (
    <>
      <section className="w-full bg-[#e3e3e3] flex flex-col overflow-x-auto overflow-y-hidden  h-full">
        <div className="flex items-center justify-between px-[26px] pt-5 pb-1 border-b border-gray-200 bg-white">
          <div>
            <div className="disp-eyebrow">Activity</div>
            <p className="disp-title">Disposition</p>
          </div>
          {dispositionAccess?.add && (
            <div className="flex gap-2 filters">
              <Button
                variant="dark"
                onClick={() => setModalState((prev) => ({ ...prev, isModalOpen: true }))}
                className="min-h-9 rounded-full gap-1.5"
                style={{ backgroundColor: '#171717', borderColor: '#171717', color: '#ffffff' }}
              >
                <Plus className="w-4 h-4" style={{ color: '#ffffff' }} />
                Disposition
              </Button>
            </div>
          )}
        </div>
        <div className="flex flex-col disp-card">
          <div className="disp-toolbar">
            <div className="disp-search">
              <span className="disp-search-ico" aria-hidden="true">
                <Search />
              </span>
              <input
                placeholder="Search dispositions"
                aria-label="Search dispositions"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <button
              type="button"
              className="disp-refresh"
              aria-label="Refresh dispositions"
              onClick={() => dispositionTableRef.current?.refetchTable()}
            >
              <RefreshCcw className="w-4 h-4" />
            </button>
          </div>
          <TableManager
            {...{
              tableRef: dispositionTableRef,
              columns,
              fetcherKey: 'getDispositionsList',
              fetcherFn: fetchDummyDispositions,
              select: (data: any) => data?.data?.data?.result?.rows,
              search,
              clientSideSearch: true,
              emptyTablePlaceholder: 'No disposition logs found',
              descriptionEmptyTable:
                'Disposition details will be available after calls are completed.',
              hideFooterRefresh: true,
              pagerAccentClassName: 'bg-red-600 text-white border-red-600',
            }}
          />
        </div>
      </section>
      {modalState?.isModalOpen && (
        <DispositionModal
          modalState={modalState?.isModalOpen}
          setModalState={() => setModalState({ isModalOpen: false, selectedCampaign: null })}
          editdata={modalState?.selectedCampaign}
        />
      )}

      {!!showDeleteConfirmation && (
        <AlertConfirm
          {...{
            apiLoading: isPendingDeleteCampaign,
            onConfirm: () => {
              mutateDeleteDisposition({ uuid: showDeleteConfirmation?._id });
            },
            open: !!showDeleteConfirmation,
            setOpen: () => {
              setShowDeleteConfirmation(null);
            },
          }}
        />
      )}
    </>
  );
};

export default DispositionsList;
