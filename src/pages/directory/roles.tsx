import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteCustomRole, userRolesList } from '@/services/api';
import { handleAlert } from '@/lib/utils';
import { useUser } from '@/hooks/use-user';
import { Ic } from '@/components/mcm/icons';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import AlertConfirm from '@/components/custom/alert-confirm';
import AddNewRole from '@/pages/admin-settings/roles/add-new-role';
import AssignUsersModal from '@/pages/admin-settings/roles/assign-users-modal';
import { DirectoryPage, EmptyRow, SearchChip, TableFooter } from './page-shell';
import { InfoIcon, MoreVertical } from 'lucide-react';
import CustomTooltip from '@/components/custom/custom-tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import './roles-theme.css';

/**
 * Directory ▸ Roles — what people are allowed to do.
 *
 * The console version of the Admin roles list, reading the same
 * `userRolesList` and reusing the platform's own create/edit and assign-users
 * flows. Admin ▸ Users ▸ Role renders this too, so there is one screen rather
 * than two that drift apart.
 */

type Role = {
  uuid?: string;
  role_uuid?: string;
  name?: string;
  description?: string;
  company_uuid?: string;
  user_count?: number;
  users_count?: number;
  total_users?: number;
  usersCount?: number;
  users?: unknown[];
};

/** The count arrives under one of several keys depending on the endpoint. */
const usersOn = (role: Role) =>
  role?.user_count ??
  role?.users_count ??
  role?.total_users ??
  role?.usersCount ??
  (Array.isArray(role?.users) ? role.users.length : 0) ??
  0;

/** A predefined role belongs to the platform and cannot be edited or removed. */
const isSystemRole = (role: Role) => role?.company_uuid === 'PREDEFINED';

const Roles = () => {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const isAdmin = user?.user_info?.role === 'ADMIN';

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Role | null>(null);
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);

  const { data: roles = [], isPending, refetch } = useQuery({
    queryKey: ['rolesList', 'directoryRoles'],
    queryFn: () => userRolesList({ page: 1, limit: 200 }),
    select: (res: any) => res?.data?.data?.result?.rows || [],
  });

  const { mutate: removeRole, isPending: isDeleting } = useMutation({
    mutationFn: deleteCustomRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rolesList'] });
      handleAlert({ text: 'Role deleted', type: 'success' });
      setDeleting(null);
    },
  });

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return roles;
    return roles.filter((role: Role) =>
      [role?.name, role?.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [roles, search]);

  const closeForm = () => {
    setCreating(false);
    setEditing(null);
    queryClient.invalidateQueries({ queryKey: ['rolesList'] });
  };

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const pageCount = Math.max(1, Math.ceil(visible.length / perPage));
  const pagedRows = visible.slice((page - 1) * perPage, page * perPage);
  if (page > pageCount) setPage(pageCount);

  return (
    <div className="rol-theme">
      <DirectoryPage
        footer={
          <TableFooter
            page={page}
            perPage={perPage}
            total={visible.length}
            onPageChange={setPage}
            onPerPageChange={setPerPage}
          />
        }
        titleClassName="dir-serif-heading"
        title={
          <span className="flex items-center gap-2">
            Roles
            <CustomTooltip
              text={
                <>
                  What each person sees in this app —
                  <br />
                  and how many people hold each role.
                </>
              }
              side="right"
              className="whitespace-normal text-left"
            >
              <InfoIcon className="w-4 h-4 text-gray-500 cursor-pointer" />
            </CustomTooltip>
          </span>
        }
        actions={
          isAdmin ? (
            <button type="button" className="btn primary" onClick={() => setCreating(true)}>
              <Ic n="plus" />
              New role
            </button>
          ) : null
        }
        filters={
          <>
            <SearchChip value={search} onChange={setSearch} placeholder="Search roles" />
            <button
              type="button"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100"
              title="Refresh"
              aria-label="Refresh roles"
              onClick={() => refetch()}
            >
              <Ic n="refresh" size={15} />
            </button>
            <span className="fchip live" style={{ marginLeft: 'auto' }}>
              {visible.length} of {roles.length}
            </span>
          </>
        }
      >
        <table className="tbl">
          <thead>
            <tr className="tbl__head-row">
              <th className="tbl__th tbl__th--left">Role</th>
              <th className="tbl__th tbl__th--left">Type</th>
              <th className="tbl__th tbl__th--left">People</th>
              <th className="tbl__th tbl__th--left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              <EmptyRow span={4} message="Loading roles…" />
            ) : pagedRows.length ? (
              pagedRows.map((role: Role) => {
                const system = isSystemRole(role);
                return (
                  <tr key={role?.uuid || role?.role_uuid || role?.name} className="tbl__row">
                    <td className="tbl__td tbl__td--left">
                      <div className="tbl__name">{role?.name || '—'}</div>
                      <div className="tbl__subtitle">{role?.description || 'No description'}</div>
                    </td>
                    <td className="tbl__td tbl__td--left">
                      <span className={system ? 'tag neu' : 'tag acc'}>
                        {system ? 'System' : 'Custom'}
                      </span>
                    </td>
                    <td className="tbl__td tbl__td--left num tbl__value">{usersOn(role)}</td>
                    <td className="tbl__td tbl__td--left" onClick={(event) => event.stopPropagation()}>
                      {isAdmin ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="mini"
                              title={`Actions for ${role?.name}`}
                              aria-label={`Actions for ${role?.name}`}
                            >
                              <MoreVertical size={14} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="border-transparent">
                            <DropdownMenuItem
                              className="ppl-row-menu-item"
                              onSelect={() => setAssigning(role)}
                            >
                              <Ic n="users" size={14} />
                              Assign people
                            </DropdownMenuItem>
                            {/* Predefined roles belong to the platform — the
                                platform's own screen refuses these too. */}
                            {!system ? (
                              <DropdownMenuItem
                                className="ppl-row-menu-item"
                                onSelect={() => setEditing(role)}
                              >
                                <Ic n="sliders" size={14} />
                                Edit
                              </DropdownMenuItem>
                            ) : null}
                            {!system ? (
                              <DropdownMenuItem
                                variant="destructive"
                                className="ppl-row-menu-item"
                                onSelect={() => setDeleting(role)}
                              >
                                <Ic n="trash" size={14} />
                                Delete
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <EmptyRow
                span={4}
                message={roles.length ? 'No roles match that search.' : 'No roles yet.'}
              />
            )}
          </tbody>
        </table>
      </DirectoryPage>

      {(creating || editing) && (
        <Dialog open={creating || Boolean(editing)} onOpenChange={(val) => !val && closeForm()}>
          <DialogContent className="rol-modal-theme flex w-[92vw] max-w-[760px] max-h-[85vh] flex-col gap-0 overflow-hidden bg-white p-0">
            <DialogTitle className="dir-serif-heading flex items-center gap-2 px-5 py-4 text-gray-900">
              {editing ? `Update role (${editing?.name || ''})` : 'New role'}
              <CustomTooltip
                text={
                  <>
                    A role decides what somebody can see and
                    <br />
                    change. Name it, describe it, then start from
                    <br />
                    an existing role or build the permissions below.
                  </>
                }
                side="right"
                className="whitespace-normal text-left"
              >
                <InfoIcon className="w-4 h-4 shrink-0 text-gray-500 cursor-pointer" />
              </CustomTooltip>
            </DialogTitle>
            <div className="min-h-0 flex-1 overflow-auto px-4 pb-5 lg:px-5">
              <AddNewRole
                drawerState={creating || Boolean(editing)}
                roleData={editing || null}
                setDrawerState={closeForm}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {assigning ? (
        <AssignUsersModal
          open={Boolean(assigning)}
          setOpen={(value: boolean) => !value && setAssigning(null)}
          roleData={assigning}
        />
      ) : null}

      <AlertConfirm
        {...{
          apiLoading: isDeleting,
          open: Boolean(deleting),
          setOpen: (value: boolean) => !value && setDeleting(null),
          onConfirm: () => {
            const id = deleting?.uuid || deleting?.role_uuid;
            if (!id) {
              handleAlert({ text: 'This role has no id to delete.', type: 'error' });
              setDeleting(null);
              return;
            }
            removeRole(id);
          },
          onCancel: () => setDeleting(null),
          onClose: () => setDeleting(null),
          confirmBtnText: 'Delete',
          closeBtnText: 'Cancel',
          descriptionTextComp: (
            <div className="text-md">
              Delete <strong>{deleting?.name}</strong>? People holding it will need another role.
            </div>
          ),
        }}
      />
    </div>
  );
};

export default Roles;
