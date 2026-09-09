import CustomAvatar from '@/components/custom/custom-avatar';
import CustomTooltip from '@/components/custom/custom-tooltip';
import NumberWithFlag from '@/components/custom/number-with-flag';
import TableManager from '@/components/custom/table-manager';
import { useGetExtensions } from '@/hooks/common';
import { useCompanyFeatures } from '@/hooks/rbac';
import { useUser } from '@/hooks/use-user';
import { convertDateFormateApis, getInitials } from '@/lib/utils';
import { getGroupContactsById } from '@/services/api';
import { ColumnDef } from '@tanstack/react-table';
import { FC, useRef, useState } from 'react';
import AgentDetailsModal from '@/pages/auto-dialer/campaign/modal/agent-details-modal';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Activity, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import './leads-table.css';

export interface ILead {
  _id: string;
  uuid: string;
  groupId: string[];
  firstName: string;
  middleName: string;
  lastName: string;
  phone: string;
  email: string;
  company: string;
  createdAt: string;
  payloadExtraParams?: object;
  groupDetail: any[];
  contactPic?: string;
}
/* TEMP: sample rows for reviewing the table with the account empty.
   Mimics the real API's response shape (rather than TableManager's
   `staticData` escape hatch) so the footer's record count and
   page-number pager still work correctly. Remove this function and go
   back to `fetcherFn: getGroupContactsById` once real data exists. */
const fetchDummyLeads = () =>
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
              name: { first: 'Test', last: 'Sharma' },
              contact: { email: 'test.sharma@example.com', phone: '+14422129610' },
              meta: { updatedBy: [] },
              groupMeta: [{ _id: 'g1', groupName: 'VIP' }],
            },
            {
              _id: 'dummy-2',
              createdAt: '2026-09-03T10:00:00.000Z',
              name: { first: 'Aakash', last: 'Rao' },
              contact: { email: 'aakash.rao@example.com', phone: '+19578642210' },
              meta: { updatedBy: [] },
              groupMeta: [{ _id: 'g2', groupName: 'New Leads' }],
            },
            {
              _id: 'dummy-3',
              createdAt: '2026-09-01T10:00:00.000Z',
              name: { first: 'Priya', last: 'Nair' },
              contact: { email: 'priya.nair@example.com', phone: '+16008314958' },
              meta: { updatedBy: [] },
              groupMeta: [],
            },
          ],
        },
      },
    },
  });

const extractUpdatedByName = (
  updatedByIds: string | string[] | undefined,
  userId: string,
  extensionList: any[],
) => {
  const ids = Array.isArray(updatedByIds)
    ? updatedByIds.filter(Boolean)
    : updatedByIds
      ? [updatedByIds]
      : [];

  if (!ids.length) return <div className="font-medium text-gray-900">---</div>;

  const idsToShow = [ids[ids.length - 1]];
  const usersToShow = idsToShow
    .map((id: string) => {
      const extension = extensionList?.find((item: any) => item?.uuid === id);
      if (!extension) return null;
      const name = `${extension?.first_name || ''} ${extension?.last_name || ''}`.trim();
      return {
        name,
        amI: extension?.uuid === userId,
      };
    })
    .filter(Boolean);

  if (!usersToShow.length) return <div className="font-medium text-gray-900">---</div>;

  return (
    <div className="font-medium text-gray-900">
      {usersToShow.map((item: any, index: number) => (
        <span key={`${item?.name}-${index}`}>
          {index > 0 ? ', ' : ''}
          {item?.name}
          {item?.amI ? <span className="text-ucass-active"> (You)</span> : null}
        </span>
      ))}
    </div>
  );
};
const AllLeadsList: FC<any> = ({
  setDrawerState,
  setShowDeleteConfirmation,
  setSelectedLeads,
  payloadExtraParams,
  actionMode = 'full',
}) => {
  // ✅ track selected leads
  const tableRef = useRef<any>(null);
  const navigate = useNavigate();
  const { features } = useCompanyFeatures();
  const { user } = useUser();
  const { data: extensionList = [] } = useGetExtensions({
    page: 1,
    limit: 1000,
    filters: [],
    search: '',
  });
  const currentUserUuid = user?.uuid || user?.user_info?.uuid || '';
  const leadsAccess = features?.plan_features?.campaign?.action || {};
  const isEditDeleteOnly = actionMode === 'edit-delete';

  const [modalState, setModalState] = useState<any>({
    open: false,
    type: null,
    data: [],
  });
  const onCheckUncheckLead = (checked: boolean, lead: ILead) => {
    if (checked) {
      setSelectedLeads((prev: any) => [...prev, lead._id]);
    } else {
      setSelectedLeads((prev: any) => prev.filter((id: any) => id !== lead._id));
    }
  };

  // ✅ toggle select all
  const onSelectAll = (checked: boolean) => {
    const tableData = tableRef?.current?.getTableData();
    if (checked) {
      setSelectedLeads(tableData.map((lead: any) => lead._id));
    } else {
      setSelectedLeads([]);
    }
  };

  console.log(onSelectAll, onCheckUncheckLead);

  const columns: ColumnDef<ILead>[] = [
    {
      header: 'Created Date',
      accessorKey: 'createdAt',
      cell: ({ row }) => (
        <div>{convertDateFormateApis(row?.original?.createdAt, 'MMM D, YYYY')}</div>
      ),
    },
    {
      header: 'Name',
      accessorKey: 'firstName',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2">
          <CustomAvatar
            name={`${row.original.name?.first || ''} ${row.original.name?.last || ''}`}
            type="contact"
            image={row.original?.profile?.contactPic}
          />
          <div>
            <span className="font-medium text-gray-900">
              {row.original.name?.first || ''} {row.original.name?.last || ''}
            </span>
            <div className="text-ucass-active">{row?.original?.contact?.email || '---'}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Phone',
      accessorKey: 'contact',
      cell: ({ row }: any) => {
        return (
          <div className="flex items-center">
            <div className="relative inline-flex w-fit pr-7 text-xs">
              <NumberWithFlag number={row?.original?.contact?.phone || '+12568081344'} />
            </div>
          </div>
        );
      },
    },

    {
      header: 'Updated By',
      accessorKey: 'updatedBy',
      cell: ({ row }: any) => {
        return extractUpdatedByName(row?.original?.meta?.updatedBy, currentUserUuid, extensionList);
      },
    },
    {
      header: 'Groups',
      accessorKey: 'groupMeta',
      cell: ({ getValue }: any) => {
        let members = [];
        try {
          const parsed = getValue();
          members = Array.isArray(parsed)
            ? Array.from(
                new Map(parsed.map((item: any) => [item._id || item.id?._id, item])).values(),
              )
            : [];
        } catch (error) {
          console.error('Error parsing members:', error);
        }
        return Array.isArray(members) && members.length > 0 ? (
          <div className="flex -space-x-2">
            {members.slice(0, 5).map((item: any, index: number) => {
              const username = item?.groupName || item?.id?.groupName || 'Unknown';
              return (
                <CustomTooltip key={index} text={username} side="top">
                  <div className="w-9 h-9 flex items-center justify-center border border-white rounded-full bg-gray-200 dark:border-gray-800 capitalizes cursor-pointer">
                    <div className="w-full h-full flex items-center justify-center rounded-full border border-gray-400 bg-gray-100 text-gray-600 text-xs capitalize">
                      {getInitials(username)}
                    </div>
                  </div>
                </CustomTooltip>
              );
            })}
            {members?.length > 5 && (
              <div
                onClick={() => {
                  const transformedData = members.map((m: any) => ({
                    label: m.groupName || m.id?.groupName || 'Unknown',
                    value: m._id || m.id?._id || '',
                    role: 'Group',
                  }));
                  setModalState({ open: true, data: transformedData, type: 'Total Groups' });
                }}
                className="w-9 h-9 flex items-center justify-center border border-gray-500 !space-x-10 rounded-full bg-gray-500 text-white font-medium cursor-pointer"
              >
                +{members?.length - 5}
              </div>
            )}
          </div>
        ) : (
          <div>---</div>
        );
      },
    },
    // {
    //   header: 'Groups',
    //   accessorKey: 'groupDetail',
    //   cell: ({ row }) => {
    //     const groups = row?.original?.groupDetail || [];
    //     return Array.isArray(groups) ? (
    //       <div className="flex -space-x-2">
    //         {groups.slice(0, 5).map((item: any, index: number) => {
    //           const username = item?.name || 'Unknown';

    //           const initials = username
    //             .split(' ')
    //             .filter(Boolean)
    //             .slice(0, 2)
    //             .map((word: string) => word?.charAt(0).toUpperCase())
    //             .join('');

    //           return (
    //             <CustomTooltip key={index} text={username} side="top">
    //               <div className="w-10 h-10 flex items-center justify-center border-2 border-white rounded-full bg-gray-200 dark:border-gray-800">
    //                 <div className="w-full h-full flex items-center justify-center rounded-full border-2 border-gray-400 bg-gray-100 text-gray-600 font-medium">
    //                   {initials}
    //                 </div>
    //               </div>
    //             </CustomTooltip>
    //           );
    //         })}

    //         {groups.length > 5 && (
    //           <CustomTooltip
    //             text={
    //               <div className="flex flex-col gap-1">
    //                 {groups?.slice(5)?.map((user, i) => (
    //                   <span key={i} className="whitespace-nowrap">
    //                     {user.name}
    //                   </span>
    //                 ))}
    //               </div>
    //             }
    //             side="top"
    //           >
    //             <div className="w-10 h-10 flex items-center justify-center border-2 border-white rounded-full bg-gray-300 text-gray-700 font-semibold">
    //               +{groups.length - 5}
    //             </div>
    //           </CustomTooltip>
    //         )}
    //       </div>
    //     ) : (
    //       <div>No members</div>
    //     );
    //   },
    // },
    {
      header: 'Action',
      accessorKey: 'action',
      cell: ({ row }) => {
        /* The three actions moved behind one ⋯ menu. Each keeps the exact
           handler and permission gate it had as a standalone button, and the
           menu is only rendered when at least one of them is allowed. */
        const actions = [
          !isEditDeleteOnly && {
            key: 'activity',
            Icon: Activity,
            label: 'View activity',
            run: () =>
              navigate(`/contact-activity?contactId=${row?.original?._id}&isLeadList=true`),
          },
          leadsAccess?.edit && {
            key: 'edit',
            Icon: Pencil,
            label: 'Edit',
            run: () =>
              setDrawerState({
                addContact: true,
                updateContacts: false,
                selectedContact: row.original,
                leadsActivity: false,
              }),
          },
          leadsAccess?.delete && {
            key: 'delete',
            Icon: Trash2,
            label: 'Delete',
            danger: true,
            run: () => setShowDeleteConfirmation(row.original),
          },
        ].filter(Boolean) as Array<{
          key: string;
          Icon: typeof Pencil;
          label: string;
          danger?: boolean;
          run: () => void;
        }>;

        if (!actions.length) return null;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="leads-dots" aria-label="Row actions">
                <MoreHorizontal size={17} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="bottom"
              sideOffset={6}
              collisionPadding={12}
              className="leads-menu w-44"
            >
              {actions.map((item) => (
                <DropdownMenuItem
                  key={item.key}
                  variant={item.danger ? 'destructive' : 'default'}
                  onSelect={item.run}
                >
                  <item.Icon size={16} />
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="leads-table w-full p-3 flex flex-col gap-2">
      <TableManager
        {...{
          tableRef,
          columns,
          fetcherKey: 'getGroupContactsById',
          fetcherFn: fetchDummyLeads,
          extraParams: {
            // groupId: '',
            ...payloadExtraParams,
          },
          emptyTablePlaceholder: payloadExtraParams?.search
            ? 'No leads match your search.'
            : 'No leads found',
          descriptionEmptyTable: payloadExtraParams?.search
            ? ''
            : 'Add or import leads to begin campaign calling.',
          pagerAccentClassName: 'bg-red-600 text-white border-red-600',
          hideFooterRefresh: true,
        }}
      />
      {modalState?.open && (
        <AgentDetailsModal modalState={modalState} setModalState={setModalState} />
      )}
    </div>
  );
};

export default AllLeadsList;
