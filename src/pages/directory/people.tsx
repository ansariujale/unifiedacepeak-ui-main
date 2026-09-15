import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ic } from '@/components/mcm/icons';
import SideDrawer from '@/components/custom/side-drawer';
import UpdateForwarding from '@/pages/admin-settings/people/update-forwarding';
import { DirectoryDrawer, DirectoryPage, EmptyRow, Kpi, SearchChip, TableFooter } from './page-shell';
import CustomAvatar from '@/components/custom/custom-avatar';
import { useConsoleDialer } from '@/pages/phone/console/dial-number';
import { useInstantMeeting } from '@/hooks/use-instant-meeting';
import { usePeopleRows, type PersonRow, type PresenceTone } from './people-rows';
import { useDirectoryFavourites } from './use-directory-favourites';
import { useUser } from '@/hooks/use-user';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteMember, removeAssignNumber } from '@/services/api';
import { handleAlert } from '@/lib/utils';
import { invalidateGlobalUsersDirectory } from '@/lib/invalidate-global-users-directory';
import AlertConfirm from '@/components/custom/alert-confirm';
import RemovalWarning, { useRemovalImpact } from '@/components/mcm/removal-warning';
import SetupGuide from '@/components/mcm/setup-guide';
import {
  PRESENCE_OPTIONS,
  presenceValueOf,
  useMyPresenceControl,
} from '@/hooks/use-presence-control';
import { useCompanyFeatures } from '@/hooks/rbac';
import RoleChangeModal from '@/pages/admin-settings/people/role-change-modal';
import AssignCallerIdModal from '@/pages/admin-settings/people/add-users/assign-caller-id-modal';
import AddUsers from '@/pages/admin-settings/people/add-users';
import { invalidateNumberLists } from '@/lib/number-list-cache';
import { buildRosterCsv, rosterFileName, toExportRow } from '@/lib/user-roster-export';
import {
  Check,
  ChevronDown,
  Filter as FilterIcon,
  InfoIcon,
  MoreVertical,
} from 'lucide-react';
import CustomTooltip from '@/components/custom/custom-tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import MultipleAssignNumber from '@/pages/admin-settings/people/add-users/multiple-assign-number';
import './people-theme.css';

/**
 * Directory ▸ People — the organisation roster.
 *
 * Everyone in the org with their role, department, extension, the queues they
 * take (the platform's nearest thing to an ACD skill), live presence, and one
 * click to call, message or start video.
 *
 * Row actions mirror the platform's own Extension page rather than inventing a
 * second vocabulary: on this platform "Edit" for a user means Update Forwarding,
 * and it is gated on the same admin + plan permissions, so People cannot offer
 * an action the Extension page would refuse.
 */

const TONE_CLASS: Record<string, string> = {
  good: 'tag pos',
  busy: 'tag neg',
  warn: 'tag warn',
  idle: 'tag neu',
};

/* Same tones, mapped onto the .tbl__pill-- variants used by the roster table. */
const TONE_PILL_CLASS: Record<string, string> = {
  good: 'tbl__pill--live',
  busy: 'tbl__pill--busy',
  warn: 'tbl__pill--draft',
  idle: 'tbl__pill--paused',
};

/* Sample roster so the page has enough rows to demonstrate scrolling. Ids are
   prefixed 'dummy-' and never sent to the API — remove this block once real
   accounts fill the list out. */
const DUMMY_PRESENCE_TONE: Record<string, PresenceTone> = {
  Available: 'good',
  'On Call': 'busy',
  Busy: 'busy',
  Offline: 'idle',
};
const DUMMY_PEOPLE_SEED = [
  { name: 'Sara Mitchell', role: 'Agent', department: 'Sales', location: 'New York HQ', city: 'New York, USA', presence: 'Available', extension: '2001', skills: ['Billing'] },
  { name: 'James Carter', role: 'Agent', department: 'Support', location: 'London Office', city: 'London, UK', presence: 'Offline', extension: '2002', skills: [] },
  { name: 'Priya Nair', role: 'Manager', department: 'Sales', location: 'Mumbai Office', city: 'Mumbai, India', presence: 'On Call', extension: '2003', skills: ['VIP Support'] },
  { name: 'Daniel Wu', role: 'Agent', department: 'Engineering', location: 'New York HQ', city: 'New York, USA', presence: 'Available', extension: '2004', skills: [] },
  { name: 'Emma Davis', role: 'Support Rep', department: 'Support', location: 'London Office', city: 'London, UK', presence: 'Busy', extension: '2005', skills: ['Technical'] },
  { name: 'Michael Chen', role: 'Agent', department: 'Marketing', location: 'Toronto Office', city: 'Toronto, Canada', presence: 'Offline', extension: '2006', skills: [] },
  { name: 'Olivia Brown', role: 'Manager', department: 'Marketing', location: 'Toronto Office', city: 'Toronto, Canada', presence: 'Available', extension: '2007', skills: ['Campaigns'] },
  { name: 'Liam Wilson', role: 'Agent', department: 'Engineering', location: 'Mumbai Office', city: 'Mumbai, India', presence: 'Offline', extension: '2008', skills: [] },
  { name: 'Sophia Martinez', role: 'Support Rep', department: 'Support', location: 'New York HQ', city: 'New York, USA', presence: 'Available', extension: '2009', skills: ['Billing', 'Technical'] },
  { name: 'Noah Anderson', role: 'Agent', department: 'Sales', location: 'London Office', city: 'London, UK', presence: 'On Call', extension: '2010', skills: [] },
  { name: 'Ava Thompson', role: 'Agent', department: 'Engineering', location: 'Toronto Office', city: 'Toronto, Canada', presence: 'Available', extension: '2011', skills: [] },
  { name: 'Ethan Rodriguez', role: 'Manager', department: 'Support', location: 'Mumbai Office', city: 'Mumbai, India', presence: 'Busy', extension: '2012', skills: ['VIP Support'] },
] as const;
const DUMMY_PEOPLE_ROWS: PersonRow[] = DUMMY_PEOPLE_SEED.map((seed, index) => ({
  uuid: `dummy-${index + 1}`,
  name: seed.name,
  initials: seed.name.split(' ').map((part) => part[0]).join(''),
  email: `${seed.name.toLowerCase().replace(/\s+/g, '.')}@mcmbpo.com`,
  role: seed.role,
  department: seed.department,
  extension: seed.extension,
  location: seed.location,
  locationPlace: seed.city,
  jobTitle: seed.role,
  phone: '',
  callerId: '',
  skills: [...seed.skills],
  presence: seed.presence,
  availability: seed.presence === 'Available' ? 'online' : 'offline',
  tone: DUMMY_PRESENCE_TONE[seed.presence] || 'idle',
  raw: { uuid: `dummy-${index + 1}`, first_name: seed.name, is_dummy: true },
}));

const People = () => {
  const navigate = useNavigate();
  const { dial } = useConsoleDialer();
  const { startVideoCall, isStarting } = useInstantMeeting();
  const { rows: apiRows, isLoading, refetch: refetchRoster } = usePeopleRows();
  const rows = useMemo(() => [...apiRows, ...DUMMY_PEOPLE_ROWS], [apiRows]);

  const { user } = useUser();
  const { setMyPresence, isPending: isSettingPresence, myUuid } = useMyPresenceControl();
  const { features } = useCompanyFeatures();

  /* Same source the Extension page reads, so the two pages can't disagree about
     who may edit a user. */
  const userAccess = features?.plan_features?.account_setting?.access?.USER?.action;
  const isAdmin = user?.user_info?.role === 'ADMIN';
  const canEdit = Boolean(isAdmin && userAccess?.edit);
  const canAssignCallerId = Boolean(
    features?.plan_features?.virtual_numbers?.action?.assign_number,
  );

  /* Same gate the Extension page puts on Add Users: trial accounts and users
     without the add permission don't get an invite button that would fail. */
  const canInvite = Boolean(userAccess?.add) && user?.company_info?.is_trial !== 'Y';
  const canDelete = Boolean(userAccess?.delete);

  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState<PersonRow | null>(null);

  /* Before anybody is removed, find what still points at them — a queue they
     are the last agent on, a menu key, a number forwarded to their extension.
     The roster is already on screen, so it is handed over rather than fetched
     a second time. */
  const roster = useMemo(() => rows.map((row: any) => row.raw), [rows]);
  const removal = useRemovalImpact((deleting?.raw ?? null) as any, Boolean(deleting), roster);
  const [unassigning, setUnassigning] = useState<PersonRow | null>(null);

  const { mutate: removePerson, isPending: isDeletingPerson } = useMutation({
    mutationKey: ['deleteMember'],
    mutationFn: deleteMember,
    onSuccess: ({ data }: any) => {
      queryClient.invalidateQueries({ queryKey: ['fetchUsersList'] });
      queryClient.invalidateQueries({ queryKey: ['directoryPeople'] });
      invalidateGlobalUsersDirectory(queryClient);
      handleAlert({ text: data?.data?.message || 'Person removed', type: 'success' });
      setDeleting(null);
    },
  });

  const { mutate: removeCallerId, isPending: isUnassigning } = useMutation({
    mutationFn: removeAssignNumber,
    onSuccess: (data: any) => {
      invalidateNumberLists(queryClient);
      queryClient.invalidateQueries({ queryKey: ['directoryPeople'] });
      handleAlert({
        text: data?.data?.data?.message || 'Caller ID removed',
        type: 'success',
      });
      setUnassigning(null);
    },
  });

  /* Admins may change anyone's role except another admin's — the same rule the
     Extension page applies to its inline role control. */
  const canChangeRoleOf = (row: PersonRow) =>
    isAdmin && String(row.role || '').toUpperCase() !== 'ADMIN';

  const [changingRole, setChangingRole] = useState<PersonRow | null>(null);
  const [assigningCallerId, setAssigningCallerId] = useState<PersonRow | null>(null);
  /* Assign Caller ID can hand off into a bulk "assign multiple numbers" step
     of its own (see assign-caller-id-modal.tsx's onOpenMultipleAssignModal) —
     this is that step's own dialog. */
  const [showMultipleAssignModal, setShowMultipleAssignModal] = useState(false);
  const [multipleAssignUsers, setMultipleAssignUsers] = useState<any[]>([]);
  const [inviting, setInviting] = useState(false);
  /* Bumping this remounts <AddUsers> from scratch — the simplest reliable way
     to reset its internal form/stepper state without reaching into a
     component shared with License Management's own Add Users flow. */
  const [inviteFormKey, setInviteFormKey] = useState(0);

  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('All');
  const { isFavourite, toggleFavourite } = useDirectoryFavourites();
  const [presence, setPresence] = useState('Any');
  const [location, setLocation] = useState('All');
  const [open, setOpen] = useState<PersonRow | null>(null);
  const [editing, setEditing] = useState<PersonRow | null>(null);

  const departments = useMemo(() => {
    const found = new Set<string>();
    rows.forEach((row) => row.department !== '—' && found.add(row.department));
    return ['All', ...Array.from(found).sort()];
  }, [rows]);

  const locations = useMemo(() => {
    const found = new Set<string>();
    rows.forEach((row) => row.location !== '—' && found.add(row.location));
    return ['All', ...Array.from(found).sort()];
  }, [rows]);

  const presences = useMemo(() => {
    const found = new Set<string>();
    rows.forEach((row) => found.add(row.presence));
    return ['Any', ...Array.from(found).sort()];
  }, [rows]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (department !== 'All' && row.department !== department) return false;
      if (location !== 'All' && row.location !== location) return false;
      if (presence !== 'Any' && row.presence !== presence) return false;
      if (!needle) return true;
      return [
        row.name,
        row.role,
        row.department,
        row.location,
        row.extension,
        row.email,
        ...row.skills,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [rows, search, department, presence, location]);

  const onQueue = rows.filter((row) => row.tone === 'good').length;
  const activeFilterCount = [department !== 'All', location !== 'All', presence !== 'Any'].filter(
    Boolean,
  ).length;

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const pageCount = Math.max(1, Math.ceil(visible.length / perPage));
  const pagedRows = visible.slice((page - 1) * perPage, page * perPage);
  if (page > pageCount) setPage(pageCount);

  /* Take the roster away as a spreadsheet.
   *
   * The platform has no export of any kind for people, so this is built here
   * out of the list already on screen. That is why it exports what the filters
   * are showing rather than "everybody": the rows are what this page fetched,
   * and pretending otherwise would quietly hand somebody a partial file
   * labelled as the whole company. The button says how many are in it.
   *
   * The file starts with a byte-order mark because otherwise a spreadsheet
   * opening it on Windows reads the accents in people's names as rubbish. */
  const exportRoster = () => {
    const csv = buildRosterCsv(
      visible.map((row) =>
        toExportRow(
          row.raw,
          row.department && row.department !== '—' ? row.department.split(', ') : [],
        ),
      ),
    );
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = rosterFileName(
      user?.company_info?.company_name || user?.user_info?.company_name,
      new Date().toISOString(),
    );
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="ppl-red-theme">
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
        title={
          <span className="flex items-center gap-2">
            People
            <CustomTooltip
              text={
                <>
                  Everyone in the organisation, with live presence,
                  <br />
                  skills and one-click contact.
                </>
              }
              side="right"
            >
              <InfoIcon className="w-4 h-4 text-gray-500 cursor-pointer" />
            </CustomTooltip>
          </span>
        }
        stats={
          <>
            <Kpi label="Total people" value={rows.length} />
            <Kpi label="Available" value={onQueue} />
            <Kpi label="Offline" value={rows.length - onQueue} />
            <Kpi label="Groups" value={Math.max(departments.length - 1, 0)} />
          </>
        }
        actions={
          <>
            <button
              type="button"
              className="btn ghost soft-accent"
              onClick={() => navigate('/directory?view=groups')}
            >
              <Ic n="users" />
              Groups
            </button>
            {/* The count is in the label on purpose: filters are on this page,
                and a button that just says "Export" invites somebody to file a
                filtered list as the whole company. */}
            <button
              type="button"
              className="btn ghost soft-accent"
              disabled={!visible.length}
              title={
                visible.length === rows.length
                  ? 'Download everybody as a spreadsheet'
                  : 'Downloads the people these filters are showing, not the whole company'
              }
              onClick={exportRoster}
            >
              <Ic n="dl" />
              Export {visible.length}
            </button>
            {canInvite ? (
              <button
                type="button"
                className="btn primary"
                onClick={() => setInviting(true)}
              >
                <Ic n="plus" />
                Invite person
              </button>
            ) : null}
          </>
        }
        filters={
          <>
            <SearchChip value={search} onChange={setSearch} placeholder="Search people" />
            <button
              type="button"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100"
              title="Refresh"
              aria-label="Refresh the roster"
              onClick={() => refetchRoster()}
            >
              <Ic n="refresh" size={15} />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="fchip fchip-select">
                  <FilterIcon size={13} />
                  Filters
                  {activeFilterCount ? ` (${activeFilterCount})` : ''}
                  <ChevronDown size={12} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[220px] border-transparent">
                <DropdownMenuLabel className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-900">
                  <Ic n="users" size={16} />
                  Groups
                </DropdownMenuLabel>
                {departments.map((option) => (
                  <DropdownMenuItem
                    key={`department-${option}`}
                    className="ppl-row-menu-item justify-between"
                    data-selected={option === department}
                    onSelect={(event) => {
                      event.preventDefault();
                      setDepartment(option);
                    }}
                  >
                    {option}
                    {option === department ? <Check size={14} /> : null}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-900">
                  <Ic n="globe" size={16} />
                  Location
                </DropdownMenuLabel>
                {locations.map((option) => (
                  <DropdownMenuItem
                    key={`location-${option}`}
                    className="ppl-row-menu-item justify-between"
                    data-selected={option === location}
                    onSelect={(event) => {
                      event.preventDefault();
                      setLocation(option);
                    }}
                  >
                    {option}
                    {option === location ? <Check size={14} /> : null}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-900">
                  <Ic n="bolt" size={16} />
                  Presence
                </DropdownMenuLabel>
                {presences.map((option) => (
                  <DropdownMenuItem
                    key={`presence-${option}`}
                    className="ppl-row-menu-item justify-between"
                    data-selected={option === presence}
                    onSelect={(event) => {
                      event.preventDefault();
                      setPresence(option);
                    }}
                  >
                    {option}
                    {option === presence ? <Check size={14} /> : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="fchip live" style={{ marginLeft: 'auto' }}>
              <span className="num">{onQueue}</span> available
            </span>
          </>
        }
      >
        {/* A new admin adding their first people is exactly who needs to see
            how far through setup they are. The guide hides itself once
            everything is done, so an established account never sees it. */}
        <SetupGuide companyInfo={user?.company_info} />

        <table className="tbl">
          <thead>
            <tr className="tbl__head-row">
              <th className="tbl__th tbl__th--left">Person</th>
              <th className="tbl__th tbl__th--left">Role</th>
              <th className="tbl__th tbl__th--left">Groups</th>
              <th className="tbl__th tbl__th--left">Location</th>
              <th className="tbl__th tbl__th--left">Numbers</th>
              <th className="tbl__th tbl__th--left">ACD skills</th>
              <th className="tbl__th tbl__th--center">Presence</th>
              <th className="tbl__th tbl__th--center">Contact</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <EmptyRow span={8} message="Loading the roster…" />
            ) : pagedRows.length ? (
              pagedRows.map((row: PersonRow) => (
                <tr key={row.uuid} className="tbl__row">
                  <td className="tbl__td tbl__td--left">
                    <span className="tbl__agent">
                      <CustomAvatar name={row.name} image={row.image} size="30" />
                      <span className="tbl__agent-meta">
                        <span className="tbl__name">{row.name}</span>
                        {/* Job title is already the Role column right next to this
                            cell — repeating it here as a second subtitle line was
                            bloating every row past the 52.67px spec height, which
                            is why only ~2 rows fit before the table had to scroll. */}
                        {row.email ? <span className="tbl__subtitle">{row.email}</span> : null}
                      </span>
                    </span>
                  </td>
                  <td className="tbl__td tbl__td--left tbl__value">{row.role}</td>
                  <td className="tbl__td tbl__td--left tbl__value--muted">{row.department}</td>
                  <td className="tbl__td tbl__td--left">
                    <span className="tbl__value">{row.location}</span>
                    {row.locationPlace ? (
                      <span className="tbl__subtitle">{row.locationPlace}</span>
                    ) : null}
                  </td>
                  {/* Extension is the internal number, caller ID the outbound
                      one people outside the org actually see. Both belong here;
                      the personal phone stays in the drawer. */}
                  <td className="tbl__td tbl__td--left num">
                    <span className="tbl__value">{row.extension || '—'}</span>
                    {row.callerId ? <span className="tbl__subtitle">{row.callerId}</span> : null}
                  </td>
                  <td className="tbl__td tbl__td--left tbl__value--muted">
                    {row.skills.length ? (
                      row.skills.join(', ')
                    ) : (
                      <span style={{ color: 'var(--ink-4)' }}>—</span>
                    )}
                  </td>
                  {/* Your own row gets a control; everyone else's shows only the
                      live state. Availability is yours to set and nobody else's,
                      so there is nothing to display or imply on their rows. */}
                  <td className="tbl__td tbl__td--center" onClick={(event) => event.stopPropagation()}>
                    <span className={`tbl__pill ${TONE_PILL_CLASS[row.tone] || 'tbl__pill--paused'}`}>
                      <span className="tbl__pill-dot" />
                      {row.presence}
                    </span>
                    {row.uuid === myUuid ? (
                      <select
                        className="mcm-presence-set"
                        aria-label="Set my availability"
                        value={presenceValueOf(row.availability)}
                        disabled={isSettingPresence}
                        onChange={(event) => setMyPresence(event.target.value)}
                      >
                        {PRESENCE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </td>
                  <td className="tbl__td tbl__td--center" onClick={(event) => event.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="ppl-row-menu-trigger"
                          title={`Actions for ${row.name}`}
                          aria-label={`Actions for ${row.name}`}
                        >
                          <MoreVertical size={16} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="ppl-row-menu border-transparent"
                      >
                        <DropdownMenuItem
                          onSelect={() => toggleFavourite('person', row.uuid)}
                          className="ppl-row-menu-item"
                        >
                          <Ic n="star" size={14} fill={isFavourite('person', row.uuid)} />
                          {isFavourite('person', row.uuid)
                            ? 'Remove from favourites'
                            : 'Add to favourites'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!row.extension}
                          onSelect={() =>
                            row.extension &&
                            dial(row.extension, { forceRefreshContactInfo: true })
                          }
                          className="ppl-row-menu-item"
                        >
                          <Ic n="phone" size={14} />
                          Call
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => navigate(`/messenger?chatId=${row.uuid}&chatType=chat`)}
                          className="ppl-row-menu-item"
                        >
                          <Ic n="chat" size={14} />
                          Message
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={isStarting}
                          onSelect={() =>
                            startVideoCall(
                              { user_uuid: row.uuid, name: row.name, email: row.email },
                              `Call with ${row.name}`,
                            )
                          }
                          className="ppl-row-menu-item"
                        >
                          <Ic n="video" size={14} />
                          Start video
                        </DropdownMenuItem>
                        {canEdit ? (
                          <DropdownMenuItem
                            onSelect={() => setEditing(row)}
                            className="ppl-row-menu-item"
                          >
                            <Ic n="sliders" size={14} />
                            Edit
                          </DropdownMenuItem>
                        ) : null}
                        {isAdmin ? (
                          <DropdownMenuItem
                            onSelect={() => navigate(`/activity/${row.uuid}`)}
                            className="ppl-row-menu-item"
                          >
                            <Ic n="clock" size={14} />
                            Activity
                          </DropdownMenuItem>
                        ) : null}
                        {canChangeRoleOf(row) ? (
                          <DropdownMenuItem
                            onSelect={() => setChangingRole(row)}
                            className="ppl-row-menu-item"
                          >
                            <Ic n="shield" size={14} />
                            Change role
                          </DropdownMenuItem>
                        ) : null}
                        {canAssignCallerId ? (
                          <DropdownMenuItem
                            onSelect={() => setAssigningCallerId(row)}
                            className="ppl-row-menu-item"
                          >
                            <Ic n="vm" size={14} />
                            Assign caller ID
                          </DropdownMenuItem>
                        ) : null}
                        {canAssignCallerId && row.callerId ? (
                          <DropdownMenuItem
                            onSelect={() => setUnassigning(row)}
                            className="ppl-row-menu-item"
                          >
                            <Ic n="x" size={14} />
                            Remove caller ID
                          </DropdownMenuItem>
                        ) : null}
                        {/* Admins can remove a person; never yourself, and never
                            another admin unless you are one. */}
                        {canDelete && row.uuid !== myUuid ? (
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setDeleting(row)}
                            className="ppl-row-menu-item"
                          >
                            <Ic n="trash" size={14} />
                            Remove
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            ) : (
              <EmptyRow
                span={8}
                message={
                  rows.length ? 'Nobody matches those filters.' : 'No people on the roster yet.'
                }
              />
            )}
          </tbody>
        </table>

        {open ? (
          <DirectoryDrawer
            title={open.name}
            onClose={() => setOpen(null)}
            footer={
              <>
                <button type="button" className="btn ghost" onClick={() => setOpen(null)}>
                  Close
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => navigate(`/department/extension/${open.uuid}`)}
                >
                  <Ic n="user" />
                  Full record
                </button>
                {canEdit ? (
                  <button type="button" className="btn primary" onClick={() => setEditing(open)}>
                    <Ic n="sliders" />
                    Edit
                  </button>
                ) : null}
              </>
            }
          >
            <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
              <CustomAvatar name={open.name} image={open.image} size="44" />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{open.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{open.role}</div>
              </div>
              <span
                className={`${TONE_CLASS[open.tone] || 'tag neu'}`}
                style={{ marginLeft: 'auto' }}
              >
                {open.presence}
              </span>
            </div>

            <div className="kv">
              <span className="k">Groups</span>
              <span className="v">{open.department}</span>
            </div>
            <div className="kv">
              <span className="k">Job title</span>
              <span className="v">{open.jobTitle || '—'}</span>
            </div>
            <div className="kv">
              <span className="k">Location</span>
              <span className="v">
                {open.location}
                {open.locationPlace ? ` · ${open.locationPlace}` : ''}
              </span>
            </div>
            <div className="kv">
              <span className="k">Extension</span>
              <span className="v num">{open.extension || '—'}</span>
            </div>
            <div className="kv">
              <span className="k">Email</span>
              <span className="v">{open.email || '—'}</span>
            </div>
            <div className="kv">
              <span className="k">Caller ID</span>
              <span className="v">{open.callerId || 'Not assigned'}</span>
            </div>
            <div className="kv">
              <span className="k">Phone</span>
              <span className="v num">{open.phone || '—'}</span>
            </div>
            <div className="kv">
              <span className="k">ACD skills</span>
              <span className="v">{open.skills.length ? open.skills.join(', ') : '—'}</span>
            </div>

            <div className="ac-acts" style={{ marginTop: 14 }}>
              <button
                type="button"
                className="mini solid"
                disabled={!open.extension}
                onClick={() =>
                  open.extension && dial(open.extension, { forceRefreshContactInfo: true })
                }
              >
                <Ic n="phone" size={12} />
                Call
              </button>
              <button
                type="button"
                className="mini"
                onClick={() => navigate(`/messenger?chatId=${open.uuid}&chatType=chat`)}
              >
                <Ic n="chat" size={12} />
                Message
              </button>
              <button
                type="button"
                className="mini"
                disabled={isStarting}
                onClick={() =>
                  startVideoCall(
                    { user_uuid: open.uuid, name: open.name, email: open.email },
                    `Call with ${open.name}`,
                  )
                }
              >
                <Ic n="video" size={12} />
                Video
              </button>
            </div>
          </DirectoryDrawer>
        ) : null}
      </DirectoryPage>

      {/* The platform's own add-user flow, opened in place rather than
          bouncing to Admin — the console keeps you in Directory. */}
      {inviting && (
        <Dialog open={inviting} onOpenChange={(val) => !val && setInviting(false)}>
          <DialogContent className="ppl-invite-dialog mcm-wizard-modal flex flex-col gap-0 overflow-hidden p-0">
            {/* The wizard draws its own heading, beside the mark and the line
                saying which company these people are being added to. Radix
                still needs a title in the tree for the dialog to be announced,
                so this one is there for screen readers only. */}
            <DialogTitle className="sr-only">Invite people</DialogTitle>
            <div className="ppl-invite-theme">
              <AddUsers
                key={inviteFormKey}
                setDrawerState={() => setInviting(false)}
                onReset={() => setInviteFormKey((key) => key + 1)}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      <AlertConfirm
        {...{
          apiLoading: isDeletingPerson,
          open: Boolean(deleting),
          setOpen: (value: boolean) => !value && setDeleting(null),
          onConfirm: () => deleting?.raw?.uuid && removePerson(deleting.raw.uuid),
          onCancel: () => setDeleting(null),
          onClose: () => setDeleting(null),
          confirmBtnText: 'Remove them',
          closeBtnText: 'Cancel',
          /* Off only for the finding that cannot be undone from inside the
             product — losing your last administrator. Everything else is a
             judgement the admin is entitled to make. */
          confirmBtnDisabled: removal.blocked || removal.loading,
          className: 'w-full sm:w-2/3 md:w-1/2 lg:w-2/5 p-3',
          descriptionTextComp: (
            <RemovalWarning
              impacts={removal.impacts}
              loading={removal.loading}
              incomplete={removal.incomplete}
              name={deleting?.name || 'this person'}
            />
          ),
        }}
      />

      <AlertConfirm
        {...{
          apiLoading: isUnassigning,
          open: Boolean(unassigning),
          setOpen: (value: boolean) => !value && setUnassigning(null),
          onConfirm: () =>
            unassigning?.callerId && removeCallerId({ did_number: unassigning.callerId }),
          onCancel: () => setUnassigning(null),
          onClose: () => setUnassigning(null),
          confirmBtnText: 'Remove',
          closeBtnText: 'Cancel',
          descriptionTextComp: (
            <div className="text-md">
              Remove <strong>{unassigning?.callerId}</strong> from {unassigning?.name}? The number
              stays on the account and can be assigned again.
            </div>
          ),
        }}
      />

      <RoleChangeModal
        open={Boolean(changingRole)}
        userData={changingRole?.raw}
        setOpen={(val: boolean) => {
          if (!val) setChangingRole(null);
        }}
      />

      {/* The Extension page normalises the key before handing the record over,
          because the modal expects `user_uuid` and the roster carries `uuid`. */}
      <AssignCallerIdModal
        open={Boolean(assigningCallerId)}
        userData={
          assigningCallerId
            ? {
                ...assigningCallerId.raw,
                user_uuid: assigningCallerId.raw?.user_uuid || assigningCallerId.raw?.uuid,
              }
            : null
        }
        onClose={() => setAssigningCallerId(null)}
        onOpenMultipleAssignModal={(users) => {
          setMultipleAssignUsers(users || []);
          setShowMultipleAssignModal(true);
        }}
      />

      {showMultipleAssignModal && (
        <Dialog
          open={showMultipleAssignModal}
          onOpenChange={(val) => {
            setShowMultipleAssignModal(val);
            if (!val) {
              setMultipleAssignUsers([]);
            }
          }}
        >
          <DialogContent
            className="md:w-3/6 p-3 max-h-[99%] overflow-y-auto"
            showCloseButton={false}
          >
            <MultipleAssignNumber
              users={multipleAssignUsers}
              handleClose={() => {
                setShowMultipleAssignModal(false);
                setMultipleAssignUsers([]);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* An explicit width matters: without one SideDrawer falls back to
          `calc(100% - 21rem)`, which is ~1660px on a wide screen — far more
          than a four-step form needs, and it buries the page behind it. */}
      {editing ? (
        <SideDrawer
          isOpen={Boolean(editing)}
          title={`Edit ${editing.name}`}
          width="min(1080px, 82vw)"
          enableResponsive
          responsiveWidth="96vw"
          responsiveBreakpoint={1024}
          handleClose={() => setEditing(null)}
          content={
            <UpdateForwarding
              drawerState
              setDrawerState={() => setEditing(null)}
              data={editing.raw}
              setTabData={() => undefined}
            />
          }
        />
      ) : null}
    </div>
  );
};

export default People;
