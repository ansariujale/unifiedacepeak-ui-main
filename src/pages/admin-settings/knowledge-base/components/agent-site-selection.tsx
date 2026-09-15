import { Check, ChevronDown, Info, MapPin } from 'lucide-react';
import CustomTooltip from '@/components/custom/custom-tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { normalizeRegionalSettings } from '@/lib/regional-settings';

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

type AgentSiteSelectionProps = {
  sites: any[];
  selectedSiteId: string;
  onChange: (siteId: string) => void;
  error?: string;
  disabled?: boolean;
  isLoading?: boolean;
};

const readSiteValue = (value: unknown): string => {
  if (value && typeof value === 'object') {
    const option = value as { value?: unknown; label?: unknown };
    return String(option.value || option.label || '').trim();
  }

  return String(value || '').trim();
};

export const getAgentSiteId = (site: any): string =>
  String(site?.uuid || site?.id || site?.site_uuid || site?.site_id || '').trim();

export const getAgentSiteTimezone = (site: any): string =>
  readSiteValue(site?.timezone || site?.time_zone || site?.timeZone);

export const getPreferredAgentSiteId = (sites: any[]): string => {
  const defaultSite = sites.find(
    (site) => site?.is_default === '1' || site?.is_default === 1 || site?.is_default === true,
  );
  return getAgentSiteId(defaultSite || sites[0]);
};

export const getAgentSiteRegionalSettings = (site: any, currentRegional?: any) => {
  const timezone = getAgentSiteTimezone(site);
  const country = readSiteValue(site?.country);
  const countryCode = readSiteValue(
    site?.country_code || site?.countryCode || site?.iso_code || site?.isoCode,
  );

  return normalizeRegionalSettings({
    ...(currentRegional || {}),
    country: country
      ? { label: country, value: country }
      : currentRegional?.country || { label: '', value: '' },
    country_code: countryCode
      ? { label: countryCode, value: countryCode }
      : currentRegional?.country_code || { label: '', value: '' },
    timezone: { label: timezone, value: timezone },
  });
};

export default function AgentSiteSelection({
  sites,
  selectedSiteId,
  onChange,
  error,
  disabled = false,
  isLoading = false,
  className,
}: AgentSiteSelectionProps & { className?: string }) {
  return (
    <div
      className={cx(
        'scroll-mt-24 rounded-2xl border-[1.5px] border-neutral-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,.03)]',
        className,
      )}
      data-validation-key="siteLocation"
    >
      {/* The one line of explanation moves into a tooltip - it is read once,
          and the card is tighter without a permanent subtitle. */}
      <h3 className="flex items-center gap-2 text-[17px] font-bold text-neutral-950">
        <MapPin className="h-4 w-4 shrink-0 text-red-600" strokeWidth={2.25} />
        Location
        <CustomTooltip
          side="top"
          text="Select the site this agent belongs to for schedules and reporting."
          className="w-max max-w-[340px] border-none! bg-[#fdf7f5]! text-black! shadow-[0_6px_20px_rgba(17,17,17,0.18)]! [&_svg]:fill-[#fdf7f5]"
        >
          <Info className="h-4 w-4 cursor-help text-neutral-400" />
        </CustomTooltip>
      </h3>

      <label className="mt-2.5 block">
        {(() => {
          const isSiteDefault = (site: any) =>
            site?.is_default === '1' || site?.is_default === 1 || site?.is_default === true;
          const selectedSite = sites.find((item) => getAgentSiteId(item) === selectedSiteId);
          const selectedLabel = selectedSite
            ? `${selectedSite?.name || 'Unnamed site'}${isSiteDefault(selectedSite) ? ' (Main Site)' : ''}`
            : '';
          const isDisabled = disabled || isLoading || sites.length === 0;

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={isDisabled}
                  aria-invalid={Boolean(error)}
                  className={cx(
                    'flex h-10 w-full items-center justify-between rounded-xl border! bg-white! px-3 text-sm outline-none! transition-colors disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500',
                    error ? 'border-red-400!' : 'border-neutral-300!',
                  )}
                >
                  <span className={selectedLabel ? 'text-neutral-900!' : 'text-neutral-400!'}>
                    {selectedLabel ||
                      (isLoading
                        ? 'Loading sites...'
                        : sites.length
                          ? 'Select a site'
                          : 'No sites available')}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="[&_[data-slot=dropdown-menu-item]]:focus:text-neutral-900! flex w-[var(--radix-dropdown-menu-trigger-width)] max-h-[320px] flex-col gap-1 overflow-y-auto rounded-xl! border! border-neutral-200! bg-white p-1.5 shadow-lg z-50 animate-none"
              >
                {sites.map((site) => {
                  const siteId = getAgentSiteId(site);
                  const label = `${site?.name || 'Unnamed site'}${isSiteDefault(site) ? ' (Main Site)' : ''}`;
                  const isSelected = siteId === selectedSiteId;
                  return (
                    <DropdownMenuItem
                      key={siteId}
                      onClick={() => onChange(siteId)}
                      className={cx(
                        'flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium',
                        isSelected
                        ? 'bg-red-50! text-neutral-900! font-semibold'
                        : 'text-neutral-900 hover:bg-[#f3f4f6]! focus:bg-[#f3f4f6]!',
                      )}
                    >
                      <span className="truncate">{label}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-red-600!" />}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })()}
      </label>
      {error ? <p className="mt-2 text-xs font-medium text-red-500">{error}</p> : null}
    </div>
  );
}
