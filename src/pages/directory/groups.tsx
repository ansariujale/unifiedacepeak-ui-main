import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getDepartmentList } from '@/services/api';
import CustomAvatar from '@/components/custom/custom-avatar';
import { Ic } from '@/components/mcm/icons';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import NewDepartment from '@/pages/admin-settings/phone-systems/departments/new-department';
import { DirectoryPage, EmptyRow, SearchChip, TableFooter } from './page-shell';
import { InfoIcon, UsersRound } from 'lucide-react';
import CustomTooltip from '@/components/custom/custom-tooltip';
import { useUser } from '@/hooks/use-user';
import '@/components/mcm/wizard-shell.css';
import './groups-theme.css';

/**
 * Directory ▸ Groups — the departments people belong to.
 *
 * The console's Groups view; the platform calls the same records Departments.
 * Reads the existing `getDepartmentList`, so the data and permissions are
 * unchanged — only the presentation is the console's.
 */

const parseMembers = (members: unknown): any[] => {
  try {
    const parsed = typeof members === 'string' ? JSON.parse((members as string) || '[]') : members;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const managerName = (manager: unknown) => {
  try {
    const parsed = typeof manager === 'string' ? JSON.parse((manager as string) || '{}') : manager;
    const value = parsed as any;
    const name = `${value?.first_name || ''} ${value?.last_name || ''}`.trim();
    return name || value?.name || '';
  } catch {
    return '';
  }
};

/* Sample groups so the page has enough rows to look populated. Ids are
   prefixed 'dummy-' and never sent to the API — remove this block once real
   departments fill the list out. */
const DUMMY_GROUP_ROWS = [
  { uuid: 'dummy-group-1', name: 'Sales', manager: 'Priya Nair', members: 8, extension: '4001' },
  { uuid: 'dummy-group-2', name: 'Support', manager: 'James Carter', members: 12, extension: '4002' },
  { uuid: 'dummy-group-3', name: 'Engineering', manager: 'Daniel Wu', members: 15, extension: '4003' },
  { uuid: 'dummy-group-4', name: 'Marketing', manager: 'Olivia Brown', members: 6, extension: '4004' },
  { uuid: 'dummy-group-5', name: 'Billing', manager: 'Sophia Martinez', members: 4, extension: '4005' },
  { uuid: 'dummy-group-6', name: 'Onboarding', manager: 'Ethan Rodriguez', members: 5, extension: '4006' },
].map((seed) => ({
  uuid: seed.uuid,
  name: seed.name,
  manager: JSON.stringify({ first_name: seed.manager.split(' ')[0], last_name: seed.manager.split(' ')[1] }),
  members: JSON.stringify(Array.from({ length: seed.members }, (_, i) => ({ uuid: `${seed.uuid}-member-${i}` }))),
  extension: seed.extension,
}));

const Groups = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const { data: apiRows = [], isPending, refetch } = useQuery({
    /* The platform's department writes invalidate ['getDepartmentList']; keying
       this list anything else meant a newly created group never appeared. */
    queryKey: ['getDepartmentList', 'directoryGroups'],
    queryFn: () => getDepartmentList({ page: 1, limit: 200 }),
    select: (res: any) => res?.data?.data?.result?.rows || [],
  });
  const rows = useMemo(() => [...apiRows, ...DUMMY_GROUP_ROWS], [apiRows]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row: any) =>
      [row?.name, row?.extension, managerName(row?.manager)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [rows, search]);

  /* Exports what the search is showing, not "every group" — the same rule
     People's own export uses, so a filtered list can't quietly be handed
     over labelled as the whole company. */
  const exportGroups = () => {
    const header = ['Group', 'Manager', 'Members', 'Extension'];
    const lines = visible.map((row: any) => {
      const members = parseMembers(row?.members).length;
      const cells = [row?.name || '', managerName(row?.manager), String(members), row?.extension || ''];
      return cells.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',');
    });
    const csv = [header.join(','), ...lines].join('\r\n');
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `groups-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const pageCount = Math.max(1, Math.ceil(visible.length / perPage));
  const pagedRows = visible.slice((page - 1) * perPage, page * perPage);
  if (page > pageCount) setPage(pageCount);

  return (
    <div className="grp-theme">
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
          Groups
          <CustomTooltip
            text={
              <>
                Teams across the organisation —
                <br />
                the same records Admin calls Departments.
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
        <>
          <button
            type="button"
            className="btn ghost"
            disabled={!visible.length}
            title={
              visible.length === rows.length
                ? 'Download every group as a spreadsheet'
                : 'Downloads the groups this search is showing, not all of them'
            }
            onClick={exportGroups}
          >
            <Ic n="dl" />
            Export {visible.length}
          </button>
          <button type="button" className="btn primary" onClick={() => setCreating(true)}>
            <Ic n="plus" />
            Create group
          </button>
        </>
      }
      filters={
        <>
          <SearchChip value={search} onChange={setSearch} placeholder="Search groups" />
          <button
            type="button"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100"
            title="Refresh"
            aria-label="Refresh groups"
            onClick={() => refetch()}
          >
            <Ic n="refresh" size={15} />
          </button>
          <span className="fchip live" style={{ marginLeft: 'auto' }}>
            <span className="num">{rows.length}</span> groups
          </span>
        </>
      }
    >
      <table className="tbl">
        <thead>
          <tr className="tbl__head-row">
            <th className="tbl__th tbl__th--left">Group</th>
            <th className="tbl__th tbl__th--left">Manager</th>
            <th className="tbl__th tbl__th--left">Members</th>
            <th className="tbl__th tbl__th--left">Extension</th>
            <th className="tbl__th tbl__th--left">Open</th>
          </tr>
        </thead>
        <tbody>
          {isPending ? (
            <EmptyRow span={5} message="Loading groups…" />
          ) : pagedRows.length ? (
            pagedRows.map((row: any) => {
              const members = parseMembers(row?.members);
              const manager = managerName(row?.manager);
              return (
                <tr key={row?.uuid} className="tbl__row">
                  <td className="tbl__td tbl__td--left">
                    <span className="tbl__agent">
                      <CustomAvatar name={row?.name || 'Group'} size="30" />
                      <span className="tbl__name">{row?.name || '—'}</span>
                    </span>
                  </td>
                  <td className="tbl__td tbl__td--left tbl__value--muted">
                    {manager || <span style={{ color: 'var(--ink-4)' }}>—</span>}
                  </td>
                  <td className="tbl__td tbl__td--left">
                    <span className="tag acc num">{members.length}</span>
                  </td>
                  <td className="tbl__td tbl__td--left num tbl__value">
                    {row?.extension || '—'}
                  </td>
                  <td className="tbl__td tbl__td--left">
                    <button
                      type="button"
                      className="mini"
                      onClick={() => navigate(`/department/organization/${row?.uuid}`)}
                    >
                      <Ic n="chev" size={12} />
                      Open
                    </button>
                  </td>
                </tr>
              );
            })
          ) : (
            <EmptyRow
              span={5}
              message={rows.length ? 'No groups match that search.' : 'No groups yet.'}
            />
          )}
        </tbody>
      </table>

      {/* The platform's own department form, opened in place. `rowData` empty
          means create rather than edit. */}
      {creating && (
        <Dialog open={creating} onOpenChange={(val) => !val && setCreating(false)}>
          <DialogContent className="grp-create-dialog mcm-group-modal flex flex-col gap-0 overflow-hidden p-0">
            {/* The mark, the name and which company's departments these are —
                the same header the Invite people wizard opens with. */}
            <header className="wz-head">
              <span className="wz-head-mark" aria-hidden="true">
                <UsersRound />
              </span>
              <div className="min-w-0">
                <DialogTitle className="wz-head-title">Create group</DialogTitle>
                <p className="wz-head-sub">
                  {[user?.company_info?.name, 'Departments'].filter(Boolean).join(' · ')}
                </p>
              </div>
            </header>
            <div className="grp-create-theme min-h-0 flex-1 overflow-hidden">
              <NewDepartment rowData={{}} setDrawerState={setCreating} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </DirectoryPage>
    </div>
  );
};

export default Groups;
