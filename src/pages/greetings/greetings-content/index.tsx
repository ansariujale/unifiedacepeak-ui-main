import { FC, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { deleteGreeting, deleteMedia, getGreetings } from '@/services/api';
import { Icon, IconName } from '@/assets/icons/icon';
import TableManager from '@/components/custom/table-manager';
import CustomSelect from '@/components/custom/custom-select';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Info, MoreVertical, Play, RefreshCcw, Search } from 'lucide-react';
import { useUser } from '@/hooks/use-user';
import {
  capitalizeFirstLetter,
  DEFAULT_RECORDING_UUIDS,
  formatDate,
  formatDuration,
  formatSize,
  getEnv,
  handleAlert,
  MEDIA_URL,
} from '@/lib/utils';
import AudioModal from '@/pages/phone/audio-dialog';
import AlertConfirm from '@/components/custom/alert-confirm';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import AddGreeting from '../add-greeting';
import SideDrawer from '@/components/custom/side-drawer';
import EditGreeting from '../edit-greeting';
import CustomTooltip from '@/components/custom/custom-tooltip';
import { useCompanyFeatures } from '@/hooks/rbac';

/* UI-testing only: flip to false (or delete this block and its two use
   sites below) to go back to the real API-backed table/empty state
   exactly as it was. While true, TableManager's own `staticData` prop
   bypasses its live query entirely — nothing about getGreetings, the
   real fetch, or the real empty-state path is changed; it's just not
   what's driving the table's data while this flag is on. */
const USE_MOCK_MEDIA_DATA = true;
const MOCK_MEDIA_FILES = [
  {
    uuid: 'mock-uuid-1',
    name: 'Welcome Greeting - Main Line',
    filename: 'welcome-main-line.mp3',
    type: 'greeting',
    size: 1258291,
    duration: 18,
    created_at: '2025-08-12',
    is_default: true,
  },
  {
    uuid: 'mock-uuid-2',
    name: 'After Hours Greeting',
    filename: 'after-hours-greeting.mp3',
    type: 'greeting',
    size: 987000,
    duration: 32,
    created_at: '2025-08-20',
    is_default: false,
  },
  {
    uuid: 'mock-uuid-3',
    name: 'Holiday Season Greeting',
    filename: 'holiday-greeting.mp3',
    type: 'greeting',
    size: 2202009,
    duration: 65,
    created_at: '2025-09-01',
    is_default: false,
  },
  {
    uuid: 'mock-uuid-4',
    name: 'IVR Main Menu Prompt',
    filename: 'ivr-main-menu.mp3',
    type: 'prompt',
    size: 512000,
    duration: 24,
    created_at: '2025-07-15',
    is_default: false,
  },
  {
    uuid: 'mock-uuid-5',
    name: 'Sales Department Prompt',
    filename: 'sales-dept-prompt.mp3',
    type: 'prompt',
    size: 665600,
    duration: 21,
    created_at: '2025-08-05',
    is_default: false,
  },
  {
    uuid: 'mock-uuid-6',
    name: 'Support Queue Hold Prompt',
    filename: 'support-hold-prompt.mp3',
    type: 'prompt',
    size: 1887436,
    duration: 48,
    created_at: '2025-08-28',
    is_default: false,
  },
  {
    uuid: 'mock-uuid-7',
    name: 'Standard Voicemail Greeting',
    filename: 'standard-voicemail.mp3',
    type: 'voicemail',
    size: 819200,
    duration: 15,
    created_at: '2025-06-30',
    is_default: false,
  },
  {
    uuid: 'mock-uuid-8',
    name: 'Sales Team Voicemail',
    filename: 'sales-voicemail.mp3',
    type: 'voicemail',
    size: 1153434,
    duration: 29,
    created_at: '2025-09-03',
    is_default: false,
  },
];

const GreetingContent: FC = () => {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [recordingUrl, serRecordingUrl] = useState<any>('');
  const { pathname } = useLocation();
  const navigate = useNavigate();
  /* Briefly self-reveals on load, same as the other My Account pages' own
     info tooltip, so the icon reads as interactive before anyone hovers
     it. */
  const [showHeaderHint, setShowHeaderHint] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setShowHeaderHint(false), 700);
    return () => clearTimeout(timer);
  }, []);
  const { features } = useCompanyFeatures();
  const greetingAccess = features?.plan_features?.settings?.action?.greeting || {};
  const [modalState, setModalState] = useState<any>({
    playMedia: false,
    isEdit: false,
    isDelete: false,
  });
  const [drawerState, setDrawerState] = useState<any>(false);
  /* react-select portals its open dropdown menu to document.body by
     default — outside this page's own DOM subtree, so page-scoped CSS
     (ancestor selectors, like the selected-option colour override below)
     can never reach it. Giving it this node as its portal target instead
     keeps it a real descendant of the page. Same technique already used
     by the other My Account pages' own selectPortalNode. */
  const [selectPortalNode, setSelectPortalNode] = useState<HTMLDivElement | null>(null);
  const [greetingData, setGreetingData] = useState<any>(null);
  /* Slug in the URL -> the type this page renders. The plural slugs are the
     current ones; the `type-` forms are the old paths, still routed as
     redirects, and still matched here so a direct hit on one resolves to the
     right library instead of silently falling back to "all". */
  const TYPE_SLUGS: Record<string, string> = {
    voicemail: 'voicemail',
    prompts: 'prompt',
    greetings: 'greeting',
    'type-voicemail': 'voicemail',
    'type-prompt': 'prompt',
    'type-greeting': 'greeting',
  };
  /* One of the type slugs is `greetings`, and this page is also mounted at
     `/greetings`. So the last segment alone cannot say whether it is a type or
     the mount itself: at `/greetings` the answer is "all", at
     `/greetings/greetings` it is the greetings library. Strip the segment and
     look at what is left — an empty base means we were standing on the mount. */
  const trimmed = pathname.replace(/\/+$/, '');
  const lastSegment = trimmed.split('/').pop() || '';
  const candidateBase = trimmed.slice(0, trimmed.length - lastSegment.length - 1);
  const isTypeSegment = Boolean(TYPE_SLUGS[lastSegment]) && candidateBase !== '';

  const type = isTypeSegment ? TYPE_SLUGS[lastSegment] : 'all';

  /* The type routes exist under every place this page is mounted, but only the
     standalone greetings area has a sidebar linking to them — under
     My Account > Media Files they were reachable by typing a URL and no other
     way. The base is whatever precedes the type segment, so the tabs follow the
     mount wherever it is. */
  const typeBase = isTypeSegment ? candidateBase : trimmed;
  const TYPE_TABS = [
    { key: 'all', label: 'All', to: typeBase },
    { key: 'greeting', label: 'Greetings', to: `${typeBase}/greetings` },
    { key: 'prompt', label: 'Prompts', to: `${typeBase}/prompts` },
    { key: 'voicemail', label: 'Voicemail', to: `${typeBase}/voicemail` },
  ];

  /* One page serves four different libraries, so the description follows the
     type rather than saying something vague enough to cover all of them. */
  const typeBlurb: Record<string, string> = {
    greeting: 'Recordings callers hear when they reach you — welcome messages and hold music.',
    prompt: 'Recordings played inside IVR menus to tell callers what their options are.',
    voicemail:
      'Recordings played when a call goes to voicemail, before the caller leaves a message.',
    all: 'Audio this account can use for greetings, IVR prompts and voicemail.',
  };

  function handleOpenAudio(src: string) {
    serRecordingUrl(src);
    setModalState({ playMedia: true });
  }

  const { mutateAsync: mutateDeleteMedia, isPending: PendingMedia } = useMutation({
    mutationFn: deleteMedia,
  });
  const { mutateAsync: mutateDeleteGreeting, isPending: PendingGreeting } = useMutation({
    mutationFn: deleteGreeting,
  });

  const handleDeleteGreeting = async () => {
    try {
      const result = await mutateDeleteGreeting(greetingData?.uuid);
      await mutateDeleteMedia({
        uuid: user?.company_info?.uuid,
        type: greetingData?.type,
        file_name: greetingData?.filename,
      });
      await queryClient.invalidateQueries({ queryKey: ['greetingList'] });
      setModalState({ isDelete: false });
      setGreetingData(null);
      handleAlert({
        text: result?.data?.data?.message || 'Record deleted successfully',
        type: 'success',
      });
    } catch (error) {
      console.error('FAILED TO ADD GREETING: ', error);
    }
  };

  const columns = [
    {
      header: 'Name',
      accessorKey: 'name',
      meta: { textAlign: 'left' },
    },
    {
      header: 'Size',
      accessorKey: 'size',
      cell: ({ getValue }: any) => <div className="text-gray-600">{formatSize(getValue())}</div>,
      meta: { textAlign: 'center' },
    },
    {
      header: 'Type',
      accessorKey: 'type',
      cell: ({ getValue }: any) => (
        <div className="text-gray-600">{capitalizeFirstLetter(getValue())}</div>
      ),
      meta: { textAlign: 'center' },
    },
    {
      header: 'Duration',
      accessorKey: 'duration',
      cell: ({ getValue }: any) => (
        <div className="text-gray-600">{formatDuration(getValue())}</div>
      ),
      meta: { textAlign: 'center' },
    },
    {
      header: 'Created At',
      accessorKey: 'created_at',
      cell: ({ getValue }: any) => <div className="text-gray-600">{formatDate(getValue())}</div>,
      meta: { textAlign: 'center' },
    },
    {
      header: 'Action',
      accessorKey: 'action',
      /* Same pattern as the AI Receptionist table this page is matching:
         the primary action (Play) stays a one-click circular button, and
         only the secondary ones (Edit/Delete) sit behind the 3-dot menu
         — same handlers/gating as before, just regrouped. */
      cell: (props: any) => {
        const data = props?.row?.original;
        const srcUrl = DEFAULT_RECORDING_UUIDS?.includes(data?.uuid)
          ? `${getEnv().VITE_API_BASE_URL}/api/media/default/recording/${data?.filename}`
          : `${MEDIA_URL}/${user?.company_info?.uuid}/greeting/${data?.filename}`;
        const canEdit = greetingAccess?.edit && !data?.is_default;
        const canDelete = greetingAccess?.delete && !data?.is_default;
        return (
          <div className="flex w-full items-center justify-center gap-2">
            <CustomTooltip text="Play" side="top">
              <button
                type="button"
                onClick={() => handleOpenAudio(srcUrl)}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-blue-50! text-blue-600! transition-colors hover:bg-blue-600! hover:text-white!"
              >
                <Play className="h-3.5 w-3.5" />
              </button>
            </CustomTooltip>
            {(greetingAccess?.edit || greetingAccess?.delete) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="More actions"
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-neutral-100! text-neutral-500! transition-colors hover:bg-neutral-200! hover:text-neutral-900!"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {greetingAccess?.edit && (
                    <DropdownMenuItem
                      disabled={!canEdit}
                      onClick={() => {
                        setGreetingData(data);
                        setModalState({ isEdit: true });
                      }}
                    >
                      <Icon name={'EditStrokIcon' as IconName} className="w-4 h-4" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {greetingAccess?.delete && (
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={!canDelete}
                      onClick={() => {
                        setGreetingData(data);
                        setModalState({ isDelete: true });
                      }}
                    >
                      <Icon name={'TrashBin' as IconName} className="w-4 h-4" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        );
      },
      meta: { textAlign: 'center' },
    },
  ];

  const activeTab = TYPE_TABS.find((tab) => tab.key === type) || TYPE_TABS[0];
  const [isTableRefreshing, setIsTableRefreshing] = useState(false);
  const mediaTableRef = useRef<any>(null);

  return (
    // <section className="w-full overflow-auto max-h-[calc(100vh-64px)] ">
    <section className="acepeak-media-files w-full overflow-auto  ">
      {/* The dropdown menu portal target — see the comment on
          selectPortalNode above. Zero-size and unstyled; it exists only as
          an attachment point. */}
      <div ref={setSelectPortalNode} />
      {/* Same heading treatment as the other My Account pages' own style
         blocks (Greetings, Preferences, My Phone, Notifications) —
         duplicated per-page rather than shared, since each page owns its
         scope there too. */}
      <style>{`
        .acepeak-media-files .acepeak-page-title {
          font-family: 'Instrument Serif', serif;
          font-style: italic;
          font-weight: 400;
          font-size: 27px;
          line-height: 41px;
          color: #171717;
        }
        .acepeak-media-files [data-slot='button'] {
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
          .acepeak-media-files .custom-react-select__option--is-selected,
          .acepeak-media-files .custom-react-select__option--is-selected:hover,
          .acepeak-media-files .custom-react-select__option--is-selected.custom-react-select__option--is-focused {
            color: #171717 !important;
          }
        }
        /* Matches the Numbers page's own coral eyebrow (mcm-page.css's
           .ident-coral-theme .mcm-adminpage-eyebrow) without pulling in
           that whole theme class — reusing mcm-adminpage-eyebrow for its
           family/case/tracking, only the 4 properties that variant
           changes are restated here, scoped to this page. */
        .acepeak-media-files .mcm-adminpage-eyebrow {
          font-size: 12px;
          font-weight: 800;
          line-height: 18px;
          color: #DC2626;
        }
        .acepeak-tooltip-content {
          background: #fdf7f5 !important;
          color: #000 !important;
          border: none !important;
          width: 395px !important;
          white-space: normal !important;
          text-wrap: normal !important;
          line-height: 1.5 !important;
          box-shadow: 0 6px 20px rgba(17, 17, 17, 0.18) !important;
        }
        .acepeak-tooltip-content svg {
          fill: #fdf7f5 !important;
        }
        .acepeak-media-files .acepeak-info-trigger:hover {
          color: #DC2626;
        }
        /* The "Upload File" drawer — same treatment as the identical
           SideDrawer + AddGreeting popup already used on Settings >
           Greetings and Settings > My Phone. #drawer-example is
           SideDrawer's own fixed id; scoping it under .acepeak-media-files
           means this only ever matches the one opened from this page.
           SideDrawer's own default is a full-height panel pinned to the
           right edge — repositioned/resized into the same small centered
           modal as those other two pages, without touching SideDrawer
           itself (still mount/unmount driven by this page's own
           drawerState exactly as before, so open/close behaviour is
           unchanged). */
        .acepeak-media-files #drawer-example {
          top: 50% !important;
          left: 50% !important;
          right: auto !important;
          transform: translate(-50%, -50%) !important;
          height: auto !important;
          max-height: 85vh !important;
          width: min(520px, 92vw) !important;
          min-width: 0 !important;
          border-radius: 16px !important;
          border: 1px solid #E5E7EB !important;
          box-shadow: 0 24px 60px -12px rgba(17, 17, 17, 0.28) !important;
        }
        .acepeak-media-files #drawer-example .min-h-11 {
          border-bottom: 1px solid #E5E7EB !important;
          padding-top: 14px !important;
          padding-bottom: 12px !important;
          margin-bottom: 2px !important;
        }
        /* The close button is absolutely positioned against #drawer-example
           itself (not against the header row), at a fixed 16px from the
           top — tuned for SideDrawer's own default, unpadded header. The
           padding added above makes this header taller, so that same fixed
           offset now sits lower than the header's real vertical centre.
           Pulled back up to re-centre it against the taller header. */
        .acepeak-media-files #drawer-example [aria-label='Close'] {
          top: 10px !important;
        }
        /* SideDrawer's own content wrapper drops to overflow: hidden at
           the md breakpoint — correct for its original full-height,
           right-edge panel (each tab managed its own scrolling), but this
           page turns it into a small, height-capped (max-height: 85vh)
           centered modal instead, where the Text to Speech tab's fields
           can genuinely be taller than that cap. Without a scrollbar the
           overflow was simply clipped, cutting off the bottom of whatever
           was focused (e.g. the textarea's own focus border) rather than
           letting it scroll into view. */
        .acepeak-media-files #drawer-example > .overflow-auto {
          overflow-y: auto !important;
          /* The original classes set overflow (both axes) to hidden past
             the md breakpoint; overriding overflow-y above still leaves
             overflow-x hidden from that same rule, which was clipping a
             sliver off the textarea's right-hand focus border whenever it
             sat flush against this edge. visible here computes to auto in
             practice (the spec upgrades "visible" to "auto" on this axis
             once the other axis actually scrolls), so nothing gets a
             horizontal scrollbar unless something genuinely overflows
             sideways. */
          overflow-x: visible !important;
        }
        /* The Text to Speech textarea stretches to fill this row exactly,
           so its own right border sits flush against the row's edge with
           no room to render — the fix above stopped that edge from being
           clipped outright, but flush-against-the-edge is still tight
           enough to read as cut off. A few px narrower leaves the border
           itself space to sit fully inside, unrelated to the overflow fix
           above. */
        .acepeak-media-files #drawer-example textarea {
          width: calc(100% - 6px) !important;
          margin: 0 auto !important;
        }
        .acepeak-media-files #drawer-example #drawer-label {
          font-size: 17px !important;
          font-weight: 700 !important;
          color: #171717 !important;
        }
        .acepeak-media-files #drawer-example [data-slot='tabs-trigger'] {
          font-weight: 600 !important;
        }
        .acepeak-media-files #drawer-example [data-slot='tabs-trigger'][data-state='active'] {
          color: #DC2626 !important;
          border-bottom-color: #DC2626 !important;
        }
        /* The drop zone — a plain white dashed box by default; a light red
           wash and matching border make it read as this page's own upload
           target rather than a generic file input. */
        .acepeak-media-files #drawer-example label[for='file-upload'] {
          background: #FEF2F2 !important;
          border-color: #FCA5A5 !important;
          border-radius: 14px !important;
          height: 128px !important;
        }
        .acepeak-media-files #drawer-example label[for='file-upload']:hover {
          border-color: #DC2626 !important;
        }
        .acepeak-media-files #drawer-example label[for='file-upload'] svg {
          color: #DC2626 !important;
        }
        .acepeak-media-files #drawer-example [data-slot='input'] {
          border-color: #E5E7EB !important;
          border-radius: 10px !important;
        }
        .acepeak-media-files #drawer-example [data-slot='input']:focus {
          border-color: #DC2626 !important;
          outline: none !important;
        }
        /* Cancel (first) / Upload (second) — the shared Button's own
           "transparent" and "outline" variants read as this tenant's
           default palette; restyled to a plain neutral Cancel and a solid
           black primary Upload, matching this page's own black CTA
           treatment elsewhere. */
        .acepeak-media-files #drawer-example .justify-end.pt-4.mt-auto [data-slot='button'] {
          border-radius: 9999px !important;
        }
        .acepeak-media-files #drawer-example .justify-end.pt-4.mt-auto [data-slot='button']:first-child {
          background: #fff !important;
          border: 1px solid #E5E7EB !important;
          color: #171717 !important;
        }
        .acepeak-media-files #drawer-example .justify-end.pt-4.mt-auto [data-slot='button']:first-child:hover {
          background: #F9FAFB !important;
          border-color: #D1D5DB !important;
        }
        .acepeak-media-files #drawer-example .justify-end.pt-4.mt-auto [data-slot='button']:last-child {
          background: #171717 !important;
          border-color: #171717 !important;
          color: #fff !important;
        }
        .acepeak-media-files #drawer-example .justify-end.pt-4.mt-auto [data-slot='button']:last-child:hover {
          background: #1a1a1a !important;
          border-color: #1a1a1a !important;
        }
      `}</style>
      <div className="flex items-center justify-between p-3 border-b border-gray-200 min-h-[65px] bg-white">
        <div>
          <p className="mcm-adminpage-eyebrow">My Account</p>
          <div className="flex items-center gap-1.5">
            <p className="acepeak-page-title text-gray-900 font-semibold">
              Media Files
            </p>
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
              <TooltipContent className="acepeak-tooltip-content" side="right" align="center" textWrap="pretty">
                {typeBlurb[type] || typeBlurb.all}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        {greetingAccess?.add && !drawerState && (
          <Button
            className="min-h-9 bg-black! text-white! border-black! hover:bg-neutral-800!"
            type="button"
            variant={'outline'}
            onClick={() => setDrawerState(true)}
          >
            <Icon name="Plus" className="w-3 h-3" /> Add
          </Button>
        )}
      </div>
        <div className="w-full p-3 flex flex-col gap-2">
          {/* TableManager itself renders customHeader, the table, and the
             pagination footer as three separate pieces — customHeader
             with only a bottom border, the table in its own bordered box,
             and the (centerPager) footer with only a top border. AI
             Receptionist unifies these into one visible card by wrapping
             the whole TableManager call in this outer bordered/rounded
             div and stripping the table's own inner border/shadow via
             "!rounded-none !border-0 !shadow-none" in customClass below —
             so only this outer border is ever visible. Same technique
             here, not a new one. */}
          <div className="overflow-hidden rounded-[14px] border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,.04)]">
          <TableManager
            {...{
              fetcherKey: 'greetingList',
              fetcherFn: getGreetings,
              columns,
              search,
              type,
              tableRef: mediaTableRef,
              hideFooterRefresh: true,
              recordsPosition: 'right',
              centerPager: true,
              /* Same red accent as the AI Receptionist table's current-page
                 pager circle, via the same TableManager prop — no changes
                 to the shared component itself. */
              pagerAccentClassName: 'border-red-600! text-white! bg-red-600!',
              /* Search pill + refresh + type filter, grouped the same way
                 as the AI Receptionist table's own customHeader (search +
                 refresh + its All/Live segmented filter) instead of split
                 across the page's own header bar. */
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
                      placeholder="Search media files..."
                      className="min-w-0 flex-1 border-none bg-transparent text-sm text-neutral-900 outline-none! placeholder:text-neutral-400"
                    />
                  </div>
                  <button
                    type="button"
                    title="Refresh"
                    onClick={async () => {
                      setIsTableRefreshing(true);
                      try {
                        await mediaTableRef.current?.refetchTable();
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
                      options={TYPE_TABS.map((tab) => ({ label: tab.label, value: tab.key }))}
                      value={{ label: activeTab.label, value: activeTab.key }}
                      handleChange={(option: any) => {
                        const tab = TYPE_TABS.find((item) => item.key === option?.value);
                        if (tab) navigate(tab.to);
                      }}
                    />
                  </div>
                </div>
              ),
              /* Same technique the AI Receptionist table uses to restyle
                 the shared Table primitives per-page — Tailwind's [&_x]
                 arbitrary variants on TableManager's own customClass prop,
                 not edits to table-manager.tsx or ui/table.tsx (both
                 shared across many other tables). Column 1 (Name) stays
                 left-aligned/flexible; columns 2-5 are centered 140px each;
                 the Action column is centered 150px — same proportions as
                 the reference's 6-column table. Header text 12px/bold/
                 uppercase/oklch(0.556 0 0) and cell text 13px, matching
                 the explicit sizes requested for this page (the reference
                 itself varies size per column; this page uses one
                 consistent size throughout instead, per that separate
                 request). Font-family is untouched here — only size/
                 weight/color/spacing utilities, so this page keeps its
                 own Inter rather than picking up whatever font the
                 reference page happens to use elsewhere. */
              customClass:
                "!rounded-none !border-0 !shadow-none [&_thead]:bg-neutral-50! [&_th]:bg-transparent! [&_th]:px-[18px]! [&_th]:py-[13px]! [&_th]:text-[12px]! [&_th]:font-bold! [&_th]:uppercase! [&_th]:tracking-[0.04em]! [&_th]:text-[oklch(0.556_0_0)]! [&_td]:bg-transparent! [&_td]:px-[18px]! [&_td]:py-2! [&_td]:align-middle [&_td]:text-[13px]! [&_th:nth-child(2)]:w-[140px] [&_td:nth-child(2)]:w-[140px] [&_th:nth-child(3)]:w-[140px] [&_td:nth-child(3)]:w-[140px] [&_th:nth-child(4)]:w-[140px] [&_td:nth-child(4)]:w-[140px] [&_th:nth-child(5)]:w-[140px] [&_td:nth-child(5)]:w-[140px] [&_th:last-child]:w-[150px] [&_td:last-child]:w-[150px] [&_th:nth-child(n+2)]:text-center! [&_td:nth-child(n+2)]:text-center!",
              getRowClassName: () => 'bg-white! transition-colors hover:bg-neutral-50!',
              emptyTablePlaceholder:
                type == 'all' ? 'No media files uploaded yet' : `No ${type} file uploaded yet`,
              descriptionEmptyTable: `Uploaded ${type} files will appear here.`,
              /* Mock-data path — see USE_MOCK_MEDIA_DATA above. Filtered
                 by the active tab the same way the real API's own `type`
                 param would be, and clientSideSearch is only turned on
                 here because staticData bypasses the real query (and
                 with it, the server-side search that normally handles
                 the `search` value) entirely — neither applies once this
                 flag is off. */
              ...(USE_MOCK_MEDIA_DATA
                ? {
                    staticData:
                      type === 'all'
                        ? MOCK_MEDIA_FILES
                        : MOCK_MEDIA_FILES.filter((item) => item.type === type),
                    clientSideSearch: true,
                  }
                : {}),
            }}
          />
          </div>
          {modalState?.playMedia && (
            <AudioModal
              modalState={modalState}
              setModalState={setModalState}
              srcUrl={recordingUrl}
              serRecordingUrl={serRecordingUrl}
            />
          )}
          {modalState?.isEdit && (
            <EditGreeting
              modalState={modalState}
              setModalState={setModalState}
              initialData={greetingData}
            />
          )}
          {modalState?.isDelete && (
            <AlertConfirm
              {...{
                apiLoading: PendingMedia || PendingGreeting,
                onConfirm: () => {
                  handleDeleteGreeting();
                },
                open: modalState,
                setOpen: setModalState,
              }}
            />
          )}
          {drawerState && (
            <SideDrawer
              isOpen={drawerState}
              title="Upload File"
              handleClose={() => setDrawerState(false)}
              width="500px"
              isHeader
              content={
                <AddGreeting
                  drawerState={drawerState}
                  setDrawerState={setDrawerState}
                  greetingType={type}
                  selectMenuPortalTarget={selectPortalNode}
                />
              }
            />
          )}
        </div>
    </section>
  );
};

export default GreetingContent;
