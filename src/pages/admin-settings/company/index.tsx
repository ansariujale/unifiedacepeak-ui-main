import { Input } from '@/components/ui/input';
import { siteDelete, siteList } from '@/services/api';
import { useEffect, useMemo, useState } from 'react';
import CompanyDetails from './company-details';
import LocationFacts from './location-facts';
import CompanyRecord from './company-record';
import CompanySettingsCard from './company-settings-card';
import SetupGuide from '@/components/mcm/setup-guide';
import { Button } from '@/components/ui/button';
import NewSiteSteps from './new-site-steps';
import AlertConfirm from '@/components/custom/alert-confirm';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { upsertSite, siteList as fetchSiteList } from '@/services/api';
import { handleAlert } from '@/lib/utils';
import { SearchLine } from '@/assets/icons';
import SideDrawer from '@/components/custom/side-drawer';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate, useParams } from 'react-router-dom';
import { Icon } from '@/assets/icons/icon';
import { useCompanyFeatures } from '@/hooks/rbac';
import {
  Briefcase,
  Building2,
  Clock,
  Crown,
  Globe,
  Hash,
  Info,
  Map,
  MapPin,
  MapPinIcon,
  MoreVertical,
  Settings,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import useDebounce from '@/hooks/use-debounce';
import Loader from '@/components/custom/loader';
import { useUser } from '@/hooks/use-user';

const CompanyInfo = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState<string>('');
  const debouncedSearch = useDebounce(search, 1000);
  const [rowData, setRowData] = useState<any>({});
  const [drawerState, setDrawerState] = useState<any>(false);
  const [drawerState2, setDrawerState2] = useState<any>(false);

  /* A location is opened from its own URL rather than only from a click, so it
     can be linked to, reloaded and sent to someone. The drawer stays — it is a
     good way to show a location — but it is no longer that location's only
     address. */
  const navigate = useNavigate();
  const { locationId } = useParams();
  const [open, setOpen] = useState(false);
  const { user } = useUser();
  const isTrial = user?.company_info?.is_trial === 'Y';
  const { features } = useCompanyFeatures();
  const siteAccess = features?.plan_features?.account_setting?.access?.SITE?.action;
  const canViewSites = Boolean(siteAccess?.view);
  const canAddSites = Boolean(siteAccess?.add);
  const canEditSites = Boolean(siteAccess?.edit);
  const canDeleteSites = Boolean(siteAccess?.delete);

  const { mutate: mutateSiteDelete, isPending } = useMutation({
    mutationKey: ['siteDelete'],
    mutationFn: siteDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['siteList'] });
      handleAlert({ text: 'Location deleted successfully', type: 'success' });
      setOpen(false);
    },
  });
  const { data: sites = [], isLoading: isSitesLoading } = useQuery({
    queryKey: ['siteList'],
    queryFn: () =>
      siteList({
        page: 1,
        limit: 1000,
      }),
    enabled: canViewSites,
    select: (data: any) => data?.data?.data?.result?.rows || [],
  });

  const defaultSite = useMemo(
    () => sites.find((site: any) => site?.is_default === '1') || null,
    [sites],
  );

  const filteredSites = useMemo(() => {
    const nameSearch = debouncedSearch?.trim()?.toLowerCase();
    const nonDefaultSites = sites.filter((site: any) => site?.is_default !== '1');
    if (!nameSearch) return nonDefaultSites;

    return nonDefaultSites.filter((site: any) => site?.name?.toLowerCase()?.includes(nameSearch));
  }, [sites, debouncedSearch]);

  const handleNewSite = () => {
    if (isTrial) return;

    if (!canAddSites) {
      return handleAlert({
        text: 'This feature is not available in your current plan. Please upgrade',
        type: 'error',
      });
    }
    setDrawerState2(true);
    setRowData({});
  };

  const handleViewSite = (site: any) => {
    if (!canViewSites) {
      return handleAlert({
        text: 'You do not have permission to view locations',
        type: 'error',
      });
    }
    /* Navigating opens the drawer through the effect below, so a click and a
       pasted URL take exactly the same path. */
    navigate(`/admin-settings/company/locations/${site?.uuid}`);
  };

  /* Opens the drawer for whichever location the URL names. Runs once the list
     has arrived, because the drawer needs the whole record and the URL carries
     only an id. An id that matches nothing is ignored rather than opening an
     empty drawer. */
  useEffect(() => {
    if (!locationId || !sites.length) return;
    const match = sites.find((site: any) => site?.uuid === locationId);
    if (!match) return;
    setRowData(match);
    setDrawerState(true);
  }, [locationId, sites]);

  /* Choosing the main location.
     
     Established systems treat this as a real setting; inbound calls fail when
     it is wrong; ours only ever displayed which location was marked. There is no
     dedicated endpoint, so the flag is sent through the ordinary site save.
     
     Whether the API honours an is_default it has never been sent before is not
     knowable from here, so the result is checked rather than assumed: the list is
     re-read and, if the flag did not move, the admin is told it was refused
     instead of being shown a success message for something that did not happen. */
  const { mutate: makeMainLocation, isPending: isSettingMain } = useMutation({
    mutationFn: (site: any) =>
      upsertSite({
        siteUUID: site?.uuid,
        name: site?.name,
        address: site?.address,
        country: site?.country,
        state: site?.state,
        city: site?.city,
        postal_code: site?.postal_code,
        timezone: site?.timezone,
        is_default: '1',
      }),
    onSuccess: async (_response: any, site: any) => {
      const fresh: any = await fetchSiteList({ page: 1, limit: 200 });
      const rows: any[] = fresh?.data?.data?.result?.rows || [];
      const moved = rows.find((row: any) => row?.uuid === site?.uuid)?.is_default === '1';

      queryClient.invalidateQueries({ queryKey: ['siteList'] });

      handleAlert({
        text: moved
          ? `${site?.name || 'That location'} is now your main location.`
          : 'The server did not accept the change, so your main location is unchanged. This needs a change on the API side.',
        type: moved ? 'success' : 'error',
      });
    },
    onError: () => {
      handleAlert({
        text: 'Could not change the main location. Nothing was changed.',
        type: 'error',
      });
    },
  });

  const handleEditSite = (site: any) => {
    if (isTrial || !canEditSites) return;
    setDrawerState2(true);
    setRowData(site);
  };

  const handleDeleteSite = (site: any, isDefault: boolean) => {
    if (isDefault || !canDeleteSites) return;
    setRowData(site);
    setOpen(true);
  };

  return (
    <section className="mcm-company-theme flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-gray-100">
      <div className="flex min-h-[65px] flex-row items-center justify-start gap-2 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex flex-col">
          <p
            className="uppercase"
            style={{
              fontFamily: "'IBM Plex Mono', 'ui-monospace', 'SF Mono', Menlo, monospace",
              fontWeight: 800,
              fontStyle: 'normal',
              fontSize: '12px',
              lineHeight: '18px',
              letterSpacing: '0.1em',
              color: 'rgb(220, 38, 38)',
            }}
          >
            Company
          </p>
          <div className="flex items-center gap-1.5">
            <p
              className="italic text-[27px] leading-[33px]"
              style={{
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontWeight: 400,
                color: 'rgb(23, 23, 23)',
              }}
            >
              Company &amp; Locations
            </p>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 shrink-0 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent
            side="right"
            className="w-max max-w-[360px] text-black [&_svg]:fill-[#fdf7f5]"
            style={{
              background: '#fdf7f5',
              border: 'none',
              color: '#000',
              boxShadow: '0 6px 20px rgba(17,17,17,0.18)',
            }}
          >
              Your company record and every place it operates from — address, timezone and the
              people who work there.
            </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
      {!canViewSites ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-3 sm:px-4">
          <div className="flex w-full min-h-0 flex-col gap-4">
            <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center">
              <p className="text-sm font-semibold text-gray-900">
                You do not have permission to view sites
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-3 sm:px-4">
          <div className="flex w-full min-h-0 flex-col gap-4">
            {/* Organisation before locations — the order established systems
                use, and the order the platform's own data follows: a location
                belongs to a company. */}
            {/* Above the company record: it is the thing a new admin should read
                first, and it disappears once everything is done. */}
            <SetupGuide companyInfo={user?.company_info} />

            <div id="setup-company-record" className="rounded-xl">
              <CompanyRecord companyInfo={user?.company_info} defaultSite={defaultSite} />
            </div>

            {/* Company-wide rules belong on the company screen, which is where
                established systems put them and where an admin looks. The editor
                itself stays under Phone System — one editor, one record. */}
            <CompanySettingsCard />

            {/* A location is not a label — it decides how calls behave for
                everyone assigned to it. Saying so here saves an admin working it
                out from the fields. */}
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-sm font-semibold text-gray-900">What a location decides</p>
              <p className="mt-1 text-xs text-gray-600">
                Each location — London, Dubai, Singapore — sets its own opening hours, outbound
                caller ID, and address for numbers and regulatory checks, all under one billing
                account.
              </p>
            </div>
            <div id="setup-locations" className="flex items-center gap-3 rounded-xl">
              <p className="flex items-center gap-2 text-base font-semibold capitalize tracking-wide text-gray-900">
                <Briefcase className="h-4.5 w-4.5 text-black" />
                Default location
              </p>
            </div>
            {defaultSite ? (
              <div className="rounded-xl bg-white shadow-md ring-2 ring-primary/25 ring-offset-2 ring-offset-gray-100">
                <div className="p-4">
                  <div className="flex gap-3">
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ucass-primary-200 text-primary">
                      <Icon name="CompayIcon" className="h-5 w-5" />
                      <span className="absolute bottom-0 -right-1 h-3 w-3 rounded-full border border-white bg-green-500" />
                    </div>
                    <div className="flex flex-1 flex-wrap items-start gap-3 border-b border-gray-200 pb-4">
                      <div className="flex min-w-[220px] flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="cursor-pointer text-left text-sm font-semibold text-primary"
                            onClick={() => handleViewSite(defaultSite)}
                          >
                            {defaultSite?.name || '---'}
                          </button>
                          <span className="rounded-sm bg-ucass-primary-200 px-2 py-1 text-xs font-semibold capitalize text-primary">
                            Main location
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          Location ID:{' '}
                          {defaultSite?.site_id || defaultSite?.id || defaultSite?.uuid || '---'}
                        </p>
                      </div>
                      <div className="flex flex-1 items-center justify-end gap-1.5 pr-4 text-right">
                        <MapPinIcon className="h-4 w-4 shrink-0 text-black" />
                        <p className="text-sm font-semibold text-gray-900 underline decoration-gray-300 underline-offset-2">
                          {defaultSite?.address || '---'}
                        </p>
                      </div>
                      {!isTrial && canEditSites && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            aria-label="Edit the default location"
                            title="Edit"
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-gray-100 text-gray-500 hover:bg-primary hover:text-white"
                            onClick={() => handleEditSite(defaultSite)}
                          >
                            <Icon name="EditStrokIcon" className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-md">
                        <p className="flex items-center gap-1 text-[11px] font-semibold capitalize tracking-wide text-gray-500">
                          <Globe className="h-3 w-3" />
                          Country
                        </p>
                        <p className="text-sm font-semibold text-gray-700">
                          {defaultSite?.country || '---'}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-md">
                        <p className="flex items-center gap-1 text-[11px] font-semibold capitalize tracking-wide text-gray-500">
                          <Map className="h-3 w-3" />
                          State
                        </p>
                        <p className="text-sm font-semibold text-gray-700">
                          {defaultSite?.state || '---'}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-md">
                        <p className="flex items-center gap-1 text-[11px] font-semibold capitalize tracking-wide text-gray-500">
                          <Building2 className="h-3 w-3" />
                          City
                        </p>
                        <p className="text-sm font-semibold text-gray-700">
                          {defaultSite?.city || '---'}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-md">
                        <p className="flex items-center gap-1 text-[11px] font-semibold capitalize tracking-wide text-gray-500">
                          <Hash className="h-3 w-3" />
                          Postal Code
                        </p>
                        <p className="text-sm font-semibold text-gray-700">
                          {defaultSite?.postal_code || '---'}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-md">
                        <p className="flex items-center gap-1 text-[11px] font-semibold capitalize tracking-wide text-gray-500">
                          <Clock className="h-3 w-3" />
                          Timezone
                        </p>
                        <p className="text-sm font-semibold text-gray-700">
                          {defaultSite?.timezone || '---'}
                        </p>
                      </div>
                  </div>
                  <LocationFacts site={defaultSite} />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center">
                <p className="text-sm font-semibold text-gray-900">No default location found</p>
              </div>
            )}
            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="flex gap-2 ">
                <MapPin className="h-4.5 w-4.5 text-black mt-0.75" />

                <div className="flex flex-col gap-0.5">
                  <p className="flex items-center gap-2 text-base font-semibold capitalize tracking-wide text-gray-900">
                    Other locations
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 shrink-0 cursor-help text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent
                        side="right"
                        className="w-max max-w-[280px] text-black [&_svg]:fill-[#fdf7f5]"
                        style={{
                          background: '#fdf7f5',
                          border: 'none',
                          color: '#000',
                          boxShadow: '0 6px 20px rgba(17,17,17,0.18)',
                        }}
                      >
                        Manage the physical locations or virtual boundaries associated with your
                        account.
                      </TooltipContent>
                    </Tooltip>
                  </p>
                </div>
              </div>
              <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
                <div className="w-full sm:min-w-[240px]">
                  <Input
                    placeholder="Search sites..."
                    className="mcm-pill-input pl-8"
                    IconPosition="left-0 pl-3 inset-y-0"
                    value={search}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value.startsWith(' ')) return;
                      setSearch(e.target.value);
                    }}
                    Icon={<SearchLine className="h-3.5 w-3.5 text-gray-700" />}
                  />
                </div>
                {/* Comparing locations is a different job from reading one, and
                    it needs a table rather than a column of cards. */}
                <Button
                  className="rounded-full"
                  variant={'dark'}
                  onClick={() => navigate('/admin-settings/company/location-management')}
                >
                  <Settings className="mr-1 h-4 w-4" />
                  Manage
                </Button>
                {!isTrial && canViewSites && canAddSites && (
                  <Button
                    className="rounded-full"
                    variant={'dark'}
                    onClick={() => handleNewSite()}
                  >
                    <Icon name="Plus" className="mr-1 h-4 w-4" />
                    New location
                  </Button>
                )}
              </div>
            </div>
            <div className="grid w-full grid-cols-1 gap-5 pb-3 xl:grid-cols-2">
              {isSitesLoading ? (
                <div className="col-span-full rounded-xl border border-gray-200 bg-white px-4 py-8">
                  <div className="flex items-center justify-center">
                    <Loader variant="blue" size="md" />
                  </div>
                </div>
              ) : !filteredSites.length ? (
                <div className="col-span-full rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-gray-900">No additional sites found</p>
                  <p className="text-xs text-gray-600">
                    Try a different search, or create a location.
                  </p>
                </div>
              ) : (
                filteredSites.map((site: any) => {
                  const isDefault = site?.is_default === '1';
                  const siteId = site?.site_id || site?.id || site?.uuid || '---';
                  return (
                    <div
                      key={site?.uuid || siteId}
                      className="rounded-xl border border-gray-400 bg-white p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 pb-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ucass-primary-200 text-primary">
                            <Icon name="CompayIcon" className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                className="cursor-pointer text-left text-sm font-semibold leading-7 text-primary"
                                onClick={() => handleViewSite(site)}
                              >
                                {site?.name || '---'}
                              </button>
                              {isDefault && (
                                <span className="rounded-sm bg-ucass-primary-200 px-2 py-1 text-xs font-semibold capitalize text-primary">
                                  Main location
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">Location ID: {siteId}</p>
                          </div>
                        </div>
                        <div className="flex flex-1 items-center justify-end gap-1.5 pr-4 text-right">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            className="h-4 w-4 shrink-0 text-black"
                            aria-hidden="true"
                          >
                            <rect x="2.5" y="10" width="4" height="9" rx="0.5" fill="currentColor" />
                            <rect x="8.5" y="5" width="4" height="14" rx="0.5" fill="currentColor" />
                            <rect x="14.5" y="12" width="4" height="7" rx="0.5" fill="#fb923c" />
                            <line
                              x1="2"
                              y1="19.25"
                              x2="19.5"
                              y2="19.25"
                              stroke="currentColor"
                              strokeWidth="1"
                            />
                            <circle
                              cx="10.5"
                              cy="19"
                              r="2.5"
                              fill="white"
                              stroke="currentColor"
                              strokeWidth="1.2"
                            />
                          </svg>
                          <p className="text-sm font-semibold text-gray-900 underline decoration-gray-300 underline-offset-2">
                            {site?.address || '---'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {(!isTrial && canEditSites) || canDeleteSites ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  aria-label={`More actions for ${site?.name || 'site'}`}
                                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-gray-100 text-gray-500 !outline-none hover:bg-primary hover:text-white"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {!isTrial && canEditSites && !isDefault && (
                                  <DropdownMenuItem
                                    disabled={isSettingMain}
                                    onClick={() => makeMainLocation(site)}
                                  >
                                    <Crown className="h-3.5 w-3.5" fill="currentColor" />
                                    Make main
                                  </DropdownMenuItem>
                                )}
                                {!isTrial && canEditSites && (
                                  <DropdownMenuItem onClick={() => handleEditSite(site)}>
                                    <Icon name="EditStrokIcon" className="h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                )}
                                {canDeleteSites && (
                                  <DropdownMenuItem
                                    variant="destructive"
                                    disabled={isDefault}
                                    /* The main location cannot be deleted, so the item is
                                       disabled rather than left to fail after the fact. */
                                    title={
                                      isDefault ? 'The main location cannot be deleted' : undefined
                                    }
                                    onClick={() => handleDeleteSite(site, isDefault)}
                                  >
                                    <Icon name="TrashBin" className="h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <span className="text-xs font-medium text-gray-400">---</span>
                          )}
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-md">
                          <p className="flex items-center gap-1 text-[11px] font-semibold capitalize tracking-wide text-gray-500">
                            <Globe className="h-3 w-3" />
                            Country
                          </p>
                          <p className="text-sm font-semibold text-gray-700">
                            {site?.country || '---'}
                          </p>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-md">
                          <p className="flex items-center gap-1 text-[11px] font-semibold capitalize tracking-wide text-gray-500">
                            <Map className="h-3 w-3" />
                            State
                          </p>
                          <p className="text-sm font-semibold text-gray-700">
                            {site?.state || '---'}
                          </p>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-md">
                          <p className="flex items-center gap-1 text-[11px] font-semibold capitalize tracking-wide text-gray-500">
                            <Building2 className="h-3 w-3" />
                            City
                          </p>
                          <p className="text-sm font-semibold text-gray-700">
                            {site?.city || '---'}
                          </p>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-md">
                          <p className="flex items-center gap-1 text-[11px] font-semibold capitalize tracking-wide text-gray-500">
                            <Hash className="h-3 w-3" />
                            Postal Code
                          </p>
                          <p className="text-sm font-semibold text-gray-700">
                            {site?.postal_code || '---'}
                          </p>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-md">
                          <p className="flex items-center gap-1 text-[11px] font-semibold capitalize tracking-wide text-gray-500">
                            <Clock className="h-3 w-3" />
                            Timezone
                          </p>
                          <p className="text-sm font-semibold text-gray-700">
                            {site?.timezone || '---'}
                          </p>
                        </div>
                      </div>
                      <LocationFacts site={site} />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
      {drawerState && (
        <SideDrawer
          width="min(1040px, 84vw)"
          isOpen={drawerState}
          isTab={false}
          handleClose={() => setDrawerState(false)}
          content={
            <CompanyDetails
              data={rowData}
              isTrial={isTrial}
              canEdit={canEditSites}
              canDelete={canDeleteSites}
              isSettingMain={isSettingMain}
              onMakeMain={() => makeMainLocation(rowData)}
              onEdit={() => {
                setDrawerState(false);
                handleEditSite(rowData);
              }}
              onDelete={() => {
                setDrawerState(false);
                handleDeleteSite(rowData, rowData?.is_default === '1');
              }}
            />
          }
        />
      )}
      <Dialog open={drawerState2} onOpenChange={(open) => !open && setDrawerState2(false)}>
        <DialogContent className="mcm-company-theme flex max-h-[75vh] w-full max-w-[760px] flex-col overflow-hidden bg-white p-4 shadow-2xl sm:p-6">
          <NewSiteSteps data={rowData} handleClose={() => setDrawerState2(false)} />
        </DialogContent>
      </Dialog>
      <AlertConfirm
        {...{
          apiLoading: isPending,
          onConfirm: () => {
            if (!canDeleteSites) return;
            mutateSiteDelete(rowData?.uuid);
          },
          open,
          setOpen,
        }}
      />
    </section>
  );
};

export default CompanyInfo;
