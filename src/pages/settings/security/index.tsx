import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUser } from '@/hooks/use-user';
import { handleAlert, capitalizeFirstLetter } from '@/lib/utils';
import { deviceSecurityList, logout } from '@/services/api';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  LucideMonitor,
  LucideShieldCheck,
  LucideTablet,
  LogOut,
  Info,
  KeyRound,
  RefreshCcw,
  Search,
} from 'lucide-react';
import CustomAvatar from '@/components/custom/custom-avatar';
import Loader from '@/components/custom/loader';
import TableManager from '@/components/custom/table-manager';
import CustomSelect from '@/components/custom/custom-select';
import { useState, useMemo, useEffect } from 'react';
import useDebounce from '@/hooks/use-debounce';
import ChangePassword from '@/pages/change-password';

/* UI-testing only: flip to false (or delete this block and its one use site
   below) to go back to the real deviceSecurityList-backed list exactly as it
   was. While true, ownDevices is built from mockSessions below instead of
   the live query result — the query itself still fires and refetches
   normally, it's just not what's driving the list while this flag is on.
   Same technique already used for Media Files' own mock toggle. Fields
   below match exactly what the real API returns and this page already
   reads: uuid, user_uuid, device_type ('W' | other), user_agent, ip_address,
   user_detail.{first_name,last_name,email,profile,extension} — nothing
   invented beyond that shape. */
const USE_MOCK_SESSIONS_DATA = true;

const DEVICE_FILTER_OPTIONS = [
  { label: 'All devices', value: 'all' },
  { label: 'Desktop', value: 'W' },
  { label: 'Mobile', value: 'other' },
];

/* user_agent is the one field the API already returns that this page didn't
   read for display — showing the full raw string ("Mozilla/5.0 (Windows NT
   10.0; ...) AppleWebKit/537.36...") is accurate but unscannable. This pulls
   plain "Device" and "Browser" values out of it for their own table columns;
   the original field is untouched everywhere else (search still matches
   against the raw string). */
const parseUserAgent = (userAgent?: string): { device: string; browser: string } => {
  if (!userAgent) return { device: 'Unknown device', browser: 'Unknown browser' };
  const device = /Windows/.test(userAgent)
    ? 'Windows'
    : /iPhone/.test(userAgent)
      ? 'iPhone'
      : /iPad/.test(userAgent)
        ? 'iPad'
        : /Mac OS X/.test(userAgent)
          ? 'macOS'
          : /Android/.test(userAgent)
            ? 'Android'
            : /Linux/.test(userAgent)
              ? 'Linux'
              : 'Unknown device';
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Chrome\/|CriOS\//.test(userAgent)
      ? 'Chrome'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Version\/.*Safari/.test(userAgent)
          ? 'Safari'
          : 'Unknown browser';
  return { device, browser };
};

const Security = () => {
  const { user } = useUser();
  const [search, setSearch] = useState('');
  const [deviceFilter, setDeviceFilter] = useState<string>('all');
  const [isTableRefreshing, setIsTableRefreshing] = useState(false);
  const [selectedUserExtension, setSelectedUserExtension] = useState<string>('');
  /* react-select portals its open dropdown menu to document.body by
     default — outside this page's own DOM subtree, so page-scoped CSS
     (ancestor selectors, like the selected-option colour override below)
     can never reach it. Giving it this node as its portal target instead
     keeps it a real descendant of the page. Same technique already used
     by My Phone/Greetings/Preferences' own selectPortalNode. */
  const [selectPortalNode, setSelectPortalNode] = useState<HTMLDivElement | null>(null);
  /* The change-password dialog was written and then never mounted anywhere, so
     there has been no way to change a password from inside the console. */
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const debouncedSearch = useDebounce(search || '', 1000);
  /* Briefly self-reveals on load, the same as the other My Account pages' own
     info tooltip, so the icon reads as interactive before anyone hovers it. */
  const [showHeaderHint, setShowHeaderHint] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setShowHeaderHint(false), 700);
    return () => clearTimeout(timer);
  }, []);

  const {
    data: loggedInUsers = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['deviceSecurityList', debouncedSearch, selectedUserExtension],
    queryFn: () =>
      deviceSecurityList({
        search: debouncedSearch,
        filter: selectedUserExtension ? [{ key: 'extension', value: [selectedUserExtension] }] : [],
      }),
    select: (data) => {
      const result = data?.data?.data?.result || [];
      // Sort to show current device first
      return result.sort((a: any, b: any) => {
        if (user?.device_token === a?.uuid) return -1;
        if (user?.device_token === b?.uuid) return 1;
        return 0;
      });
    },
  });

  /* This page is titled "your password, and every device signed in as you", and
     that is what it should show.

     It used to say the server did not check who you were targeting. That is no
     longer true, and the note is kept accurate on purpose: the three server-side
     gaps behind it are all closed and live as of 29 August 2026.
       - logout() gives a non-privileged caller `undefined` for the target, so it
         falls back to their own uuid, and the payload cannot smuggle one past it.
       - getDeviceSecurities scopes to the caller's company, and to the caller's
         own uuid unless they are an ADMIN.
       - logOutUser now refuses a target outside the admin's own company.

     The filter below stays regardless. Ending someone else's session is an
     administrative act and belongs on an admin screen, not on a page about your
     own account — so this page shows you your own devices whatever your role. */
  const currentUserUuid = `${user?.uuid || user?.user_info?.uuid || ''}`.trim();

  /* The first entry's uuid mirrors the real user?.device_token, so the same
     "Current Device" comparison this page already does further down lights
     up correctly on mock data too — nothing about that check changes. */
  const mockSessions = useMemo(() => {
    if (!USE_MOCK_SESSIONS_DATA) return [];
    const selfDetail = {
      first_name: user?.user_info?.first_name || user?.first_name || 'You',
      last_name: user?.user_info?.last_name || user?.last_name || '',
      email: user?.user_info?.email || user?.email || '',
      profile: user?.user_info?.profile || user?.profile,
      extension: user?.user_info?.extension || user?.extension,
    };
    return [
      {
        uuid: user?.device_token || 'mock-session-current',
        user_uuid: currentUserUuid,
        device_type: 'W',
        user_agent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        ip_address: '49.36.14.201',
        user_detail: selfDetail,
      },
      {
        uuid: 'mock-session-iphone',
        user_uuid: currentUserUuid,
        device_type: 'M',
        user_agent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
        ip_address: '103.27.9.44',
        user_detail: selfDetail,
      },
      {
        uuid: 'mock-session-mac',
        user_uuid: currentUserUuid,
        device_type: 'W',
        user_agent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
        ip_address: '182.71.55.9',
        user_detail: selfDetail,
      },
    ];
  }, [user, currentUserUuid]);

  const ownDevices = useMemo(() => {
    let base: any[];
    if (USE_MOCK_SESSIONS_DATA) {
      const term = debouncedSearch.trim().toLowerCase();
      base = !term
        ? mockSessions
        : mockSessions.filter((item) =>
            [
              item?.user_detail?.first_name,
              item?.user_detail?.last_name,
              item?.user_detail?.email,
              item?.ip_address,
              item?.user_agent,
            ]
              .filter(Boolean)
              .some((field) => String(field).toLowerCase().includes(term)),
          );
    } else {
      base = currentUserUuid
        ? loggedInUsers.filter((item: any) => `${item?.user_uuid || ''}`.trim() === currentUserUuid)
        : loggedInUsers;
    }
    if (deviceFilter === 'all') return base;
    return base.filter((item: any) =>
      deviceFilter === 'W' ? item?.device_type === 'W' : item?.device_type !== 'W',
    );
  }, [loggedInUsers, currentUserUuid, mockSessions, debouncedSearch, deviceFilter]);

  const { mutate: logoutMutate } = useMutation({
    mutationFn: logout,
    onSuccess: (data) => {
      handleAlert({ text: data?.data?.data?.message, type: 'success' });
      setSelectedUserExtension('');

      refetch();
    },
  });

  /* While USE_MOCK_SESSIONS_DATA is on, a click here still calls the real
     logout endpoint — just with one of the mock uuids above (except the
     current-device row, which is the real device_token). Same trade-off
     Media Files' own mock rows already accept for their Edit/Delete
     buttons: fine for a UI demo, not something to wire around for a
     display-only toggle. */
  const logoutDevice = (type: string = 'single', item: any) => {
    const payload = {
      type,
      device_securities: item?.uuid ? [item?.uuid] : [],
      user_uuid: item?.user_uuid || currentUserUuid,
    };
    logoutMutate(payload);
  };

  const handleLogoutAll = () => {
    if (!currentUserUuid) return;
    logoutDevice('all', { user_uuid: currentUserUuid });
  };

  const handleLogoutExcept = () => {
    if (!currentUserUuid) return;
    logoutDevice('except_himself', { user_uuid: currentUserUuid });
  };

  /* Same shape as Media Files' own columns (header/accessorKey/cell/meta),
     fed into the same shared TableManager component — reused here for its
     search+filter header, table styling and pagination footer exactly as
     built, not reimplemented. Session-specific fields only (User, Device,
     Browser, IP Address, Action) — nothing from the Media Files reference
     data itself. */
  const columns = [
    {
      header: 'User',
      accessorKey: 'user',
      meta: { textAlign: 'left' },
      cell: (props: any) => {
        const item = props?.row?.original;
        const isCurrent = user?.device_token === item?.uuid;
        const fullName =
          `${item?.user_detail?.first_name || ''} ${item?.user_detail?.last_name || ''}`.trim();
        return (
          <div className="flex min-w-0 items-center gap-2.5">
            <CustomAvatar
              name={fullName || 'Unknown User'}
              showPresence={true}
              size="36"
              image={item?.user_detail?.profile}
              extension={item?.user_detail?.extension}
            />
            <div className="flex min-w-0 flex-col">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium text-gray-900">
                  {capitalizeFirstLetter(fullName) || 'Unknown User'}
                </p>
                {isCurrent && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                    <LucideShieldCheck className="h-3 w-3" />
                    Current device
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-gray-500">{item?.user_detail?.email || ''}</p>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Device',
      accessorKey: 'device_type',
      meta: { textAlign: 'center' },
      cell: (props: any) => {
        const item = props?.row?.original;
        const { device } = parseUserAgent(item?.user_agent);
        return (
          <span className="inline-flex items-center justify-center gap-1.5 text-gray-600">
            {item?.device_type === 'W' ? (
              <LucideMonitor className="h-3.5 w-3.5 text-gray-500" />
            ) : (
              <LucideTablet className="h-3.5 w-3.5 text-gray-500" />
            )}
            {device}
          </span>
        );
      },
    },
    {
      header: 'Browser',
      accessorKey: 'browser',
      meta: { textAlign: 'center' },
      cell: (props: any) => (
        <span className="text-gray-600">{parseUserAgent(props?.row?.original?.user_agent).browser}</span>
      ),
    },
    {
      header: 'IP Address',
      accessorKey: 'ip_address',
      meta: { textAlign: 'center' },
      cell: ({ getValue }: any) => <span className="text-gray-600">{getValue()}</span>,
    },
    {
      header: 'Action',
      accessorKey: 'action',
      meta: { textAlign: 'center' },
      cell: (props: any) => {
        const item = props?.row?.original;
        const isCurrent = user?.device_token === item?.uuid;
        if (isCurrent) return null;
        return (
          <Button
            variant="dark"
            size="sm"
            onClick={() => logoutDevice('single', item)}
            className="rounded-lg bg-black! text-white! border-black! hover:bg-neutral-800! text-[11.5px]!"
          >
            Sign out
          </Button>
        );
      },
    },
  ];

  return (
    <section className="acepeak-security flex h-full w-full flex-col overflow-y-auto bg-gray-200/15">
      {/* The dropdown menu portal target — see the comment on
          selectPortalNode above. Zero-size and unstyled; it exists only as
          an attachment point. */}
      <div ref={setSelectPortalNode} />
      {/* Same brand tokens and fixes as the other My Account pages' own style
          blocks — duplicated per-page rather than shared, since each page
          owns its scope. Kept identical on purpose so this page reads as
          part of the same system. */}
      <style>{`
        .acepeak-security {
          font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
          --ap-primary: #DC2626;
          --ap-primary-hover: #B91C1C;
        }
        .acepeak-security .acepeak-page-title {
          font-family: 'Instrument Serif', serif;
          font-style: italic;
          font-weight: 400;
          font-size: 27px;
          line-height: 41px;
          color: #171717;
        }
        .acepeak-security .acepeak-info-trigger:hover {
          color: var(--ap-primary);
        }
        .acepeak-security [data-slot='button'] {
          border-radius: 9999px !important;
        }
        /* index.css's own .custom-react-select__option--is-selected rule
           is itself !important inside @layer base — an unlayered
           !important here (this page's usual technique) would still lose
           to it regardless of specificity, since a layered !important
           always outranks an unlayered one. Joining the same layer name
           puts this back on normal specificity terms, where the page
           scope here wins. Only the text colour changes; the pink
           background/weight that mark a selected row stay as they are
           everywhere else. */
        @layer base {
          .acepeak-security .custom-react-select__option--is-selected,
          .acepeak-security .custom-react-select__option--is-selected:hover,
          .acepeak-security .custom-react-select__option--is-selected.custom-react-select__option--is-focused {
            color: #171717 !important;
          }
        }
        /* Matches the Numbers page's own coral eyebrow (mcm-page.css's
           .ident-coral-theme .mcm-adminpage-eyebrow) without pulling in
           that whole theme class — reusing mcm-adminpage-eyebrow for its
           family/case/tracking, only the 4 properties that variant
           changes are restated here, scoped to this page. */
        .acepeak-security .mcm-adminpage-eyebrow {
          font-size: 12px;
          font-weight: 800;
          line-height: 18px;
          color: #DC2626;
        }
      `}</style>
      <div className="flex shrink-0 items-center justify-between p-3 border-b border-gray-200 min-h-[65px] bg-white">
        <div>
          <p className="mcm-adminpage-eyebrow">My Account</p>
          <div className="flex items-center gap-1.5">
            <p className="acepeak-page-title text-gray-900 font-semibold">Security &amp; Privacy</p>
          <Tooltip open={showHeaderHint || undefined}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="acepeak-info-trigger inline-flex h-4 w-4 items-center justify-center rounded-full text-gray-400"
                aria-label="About this page"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              textWrap="pretty"
              className="w-max max-w-[340px] text-black [&_svg]:fill-[#fdf7f5]"
              style={{
                background: '#fdf7f5',
                border: 'none',
                color: '#000',
                boxShadow: '0 6px 20px rgba(17,17,17,0.18)',
              }}
            >
              Your password, and every device currently signed in as you.
            </TooltipContent>
          </Tooltip>
          </div>
        </div>
      </div>
      <div className="gap-3 flex shrink-0 flex-col w-full p-3">
        {/* Password — standalone card. */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shrink-0">
          <div className="flex sm:flex-row flex-col sm:items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <KeyRound className="h-4.5 w-4.5" />
              </span>
              <div className="flex flex-col gap-0.5">
                <p className="text-gray-900 font-semibold text-sm">Password</p>
                <p className="text-gray-500 text-xs">
                  Keep your account secure by updating your password regularly.
                </p>
              </div>
            </div>
            <Button
              variant="dark"
              size="sm"
              className="rounded-lg bg-black! text-white! border-black! hover:bg-neutral-800! text-[11.5px]!"
              onClick={() => setIsChangePasswordOpen(true)}
            >
              Change password
            </Button>
          </div>
        </div>

        {/* Active Sessions — its own card now, with a header row matching the
            Password/Sign out cards' icon+title pattern. The TableManager
            block below (search/filter header, columns, rows, pagination) is
            left exactly as it was — only its surrounding card changed. */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shrink-0">
          <div className="flex items-center gap-3 border-b border-gray-100 p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <LucideMonitor className="h-4.5 w-4.5" />
            </span>
            <div className="flex items-center gap-2">
              <p className="text-gray-900 font-semibold text-sm">Active Sessions</p>
              <p className="text-gray-500 text-xs">
                You&apos;re signed in on {ownDevices.length || 0} device
                {ownDevices.length === 1 ? '' : 's'}.
              </p>
            </div>
          </div>
          {isLoading && !USE_MOCK_SESSIONS_DATA ? (
            <div className="flex items-center justify-center bg-white py-16">
              <Loader variant="blue" />
            </div>
          ) : (
            <div className="overflow-hidden bg-white">
              <TableManager
                {...{
                  columns,
                  recordsPosition: 'right',
                  centerPager: true,
                  pagerAccentClassName: 'border-red-600! text-white! bg-red-600!',
                  hideFooterRefresh: true,
                  /* TableManager defaults to a fixed-height (~350px)
                     internal scroll box around the rows — exactly the
                     nested/stuck scroll region this page just moved away
                     from. Off here (Media Files leaves this on its own
                     default instead, since it expects many more rows) so
                     the table renders at its full natural height and the
                     page itself is the only thing that scrolls. */
                  isHeightSet: false,
                  /* TableManager's <thead> defaults to "sticky top-0
                     left-0 z-10" regardless of isHeightSet — meant to
                     stick within the table's own small internal scroll
                     box. With that box turned off above, this page's
                     shared outer scroll container is the nearest
                     scrolling ancestor instead, and the header pins
                     itself to the top of that — overlapping the Password
                     / Sign out cards above the table. customClass's
                     [&_thead] rule only overrides the header's
                     background colour, not these positioning classes, so
                     they're replaced directly here with a plain,
                     non-sticky header in the same colour. */
                  theadClassName: 'bg-neutral-50 text-gray-900/80',
                  staticData: ownDevices,
                  customHeader: (
                    <div className="flex flex-col gap-3 py-1 sm:flex-row sm:items-center">
                      <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border! border-neutral-200! bg-white! pl-2 pr-3 shadow-[0_1px_2px_rgba(0,0,0,.03)] transition-all focus-within:border-red-300! sm:max-w-[320px]">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                          <Search className="h-3.5 w-3.5" />
                        </span>
                        <input
                          value={search}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value.startsWith(' ')) return;
                            setSearch(value);
                          }}
                          placeholder="Search sessions..."
                          className="min-w-0 flex-1 border-none bg-transparent text-sm text-neutral-900 outline-none! placeholder:text-neutral-400"
                        />
                      </div>
                      <button
                        type="button"
                        title="Refresh"
                        onClick={async () => {
                          setIsTableRefreshing(true);
                          try {
                            await refetch();
                          } finally {
                            setIsTableRefreshing(false);
                          }
                        }}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-none! bg-transparent! text-neutral-500! shadow-none! transition-colors hover:text-neutral-900!"
                      >
                        <RefreshCcw className={`h-4 w-4 ${isTableRefreshing ? 'animate-spin' : ''}`} />
                      </button>
                      <div className="w-40 shrink-0 sm:ml-auto">
                        <CustomSelect
                          isSearchable={false}
                          menuPortalTarget={selectPortalNode}
                          options={DEVICE_FILTER_OPTIONS}
                          value={DEVICE_FILTER_OPTIONS.find((option) => option.value === deviceFilter)}
                          handleChange={(option: any) => setDeviceFilter(option?.value || 'all')}
                        />
                      </div>
                    </div>
                  ),
                  customClass:
                    "!rounded-none !border-0 !shadow-none [&_thead]:bg-neutral-50! [&_th]:bg-transparent! [&_th]:px-[18px]! [&_th]:py-[13px]! [&_th]:text-[12px]! [&_th]:font-bold! [&_th]:uppercase! [&_th]:tracking-[0.04em]! [&_th]:text-[oklch(0.556_0_0)]! [&_td]:bg-transparent! [&_td]:px-[18px]! [&_td]:py-2! [&_td]:align-middle [&_td]:text-[13px]! [&_th:nth-child(2)]:w-[130px] [&_td:nth-child(2)]:w-[130px] [&_th:nth-child(3)]:w-[130px] [&_td:nth-child(3)]:w-[130px] [&_th:nth-child(4)]:w-[140px] [&_td:nth-child(4)]:w-[140px] [&_th:last-child]:w-[130px] [&_td:last-child]:w-[130px] [&_th:nth-child(n+2)]:text-center! [&_td:nth-child(n+2)]:text-center!",
                  getRowClassName: (row: any) =>
                    `bg-white! transition-colors hover:bg-neutral-50! ${
                      user?.device_token === row?.original?.uuid ? 'bg-gray-50/60!' : ''
                    }`,
                  emptyTablePlaceholder: debouncedSearch
                    ? 'No matching sessions'
                    : 'No other active sessions',
                  descriptionEmptyTable: debouncedSearch
                    ? 'Try a different search term.'
                    : "You're only signed in on this device right now.",
                }}
              />
            </div>
          )}
        </div>

        {/* Sign out — its own card below Active Sessions, with the two
            actions side by side inside plain gray (not red/pink) panels and
            no icons, per this page's own layout request. Same handlers and
            disabled-state logic as before, just relocated. */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shrink-0 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
              <LogOut className="h-4.5 w-4.5" />
            </span>
            <div className="flex flex-col gap-0.5">
              <p className="text-gray-900 font-semibold text-sm">Sign out</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="flex-1 text-gray-500 text-xs">
                Ends all active sessions except the device you&apos;re currently using.
              </p>
              <Button
                variant="dark"
                size="sm"
                onClick={handleLogoutExcept}
                disabled={!currentUserUuid}
                className="w-fit whitespace-nowrap rounded-lg bg-black! text-white! border-black! hover:bg-neutral-800! text-[11.5px]!"
              >
                Sign out other devices
              </Button>
            </div>
            <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="flex-1 text-gray-500 text-xs">
                Ends all active sessions, including this device. You will need to sign in again.
              </p>
              <Button
                variant="dark"
                size="sm"
                onClick={handleLogoutAll}
                disabled={!currentUserUuid}
                className="w-fit whitespace-nowrap rounded-lg bg-black! text-white! border-black! hover:bg-neutral-800! text-[11.5px]!"
              >
                Sign out everywhere
              </Button>
            </div>
          </div>
        </div>
      </div>
      <ChangePassword modalState={isChangePasswordOpen} setModalState={setIsChangePasswordOpen} />
    </section>
  );
};

export default Security;
