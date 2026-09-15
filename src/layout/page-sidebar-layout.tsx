import { cloneElement, isValidElement, useState } from 'react';
import { ChevronIcon } from '@/assets/icons';
import { cn } from '@/lib/utils';
/* The wordmark on its own. The full lockup (`Logo.svg`) leads with the circular
   mark, which sat directly above the rail's own icon column and read as one
   more nav icon rather than as the brand. */
import AcepeakWordmark from '@/assets/images/LogoWordmark.png';

const PageSidebarLayout = ({
  title = '',
  content = null,
  action = null,
  icon = null,
  isTab = true,
  headerCustomClass = '',
  fullHeightOnMobile = false,
}: {
  title?: string;
  headerCustomClass?: string;
  icon?: any;
  content: any;
  action?: any;
  isTab?: boolean;
  fullHeightOnMobile?: boolean;
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const isAdminResponsiveTopbar = !isTab && title === 'Admin Hub';
  const isCampaignResponsiveTopbar = !isTab && title === 'Campaign';
  return (
    <section
      data-admin-rail={isAdminResponsiveTopbar ? 'true' : undefined}
      data-rail-collapsed={isAdminResponsiveTopbar && collapsed ? 'true' : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'relative bg-white transition-all',
        // Admin Hub's own smooth-and-relaxed width transition is declared as
        // plain CSS (`.mcm-admin section[data-admin-rail]`) instead of a
        // Tailwind arbitrary-value class here — easier to verify is actually
        // taking effect than trusting `ease-[cubic-bezier(...)]` parsed
        // correctly, and one definition instead of duplicating the curve
        // across every collapsed-state rule in mcm-page.css.
        !isAdminResponsiveTopbar && 'duration-300 ease-in-out',
        isCampaignResponsiveTopbar
          ? 'h-auto lg:h-full'
          : isAdminResponsiveTopbar
            ? 'h-auto lg:h-full'
            : isTab
              ? fullHeightOnMobile
                ? 'h-full'
                : 'h-auto lg:h-full'
              : title === 'Reports'
                ? 'h-auto md:h-full'
                : 'h-full',
        /* A `border` still renders on a 0-width box — border-width is
           independent of content-width — so a collapsed panel (see the
           width rule below) was showing a stray hover-coloured line with
           nothing behind it. No border at all reads correctly as "nothing
           here" instead. */
        collapsed
          ? isAdminResponsiveTopbar
            ? 'border-r border-gray-200'
            : 'border-none'
          : isCampaignResponsiveTopbar
            ? hovered
              ? 'border-b border-primary lg:border-r lg:border-b-0'
              : 'border-b border-gray-200 lg:border-r lg:border-b-0'
            : isAdminResponsiveTopbar
              ? hovered
                ? 'border-b border-primary lg:border-r lg:border-b-0'
                : 'border-b border-gray-200 lg:border-r lg:border-b-0'
              : title === 'Reports'
                ? hovered
                  ? 'border-b border-primary md:border-r md:border-b-0'
                  : 'border-b border-gray-200 md:border-r md:border-b-0'
                : hovered
                  ? 'border-r border-primary'
                  : 'border-r border-gray-200 ',
        collapsed
          ? isAdminResponsiveTopbar
            ? 'w-[80px] min-w-[80px] max-w-[80px]'
            : 'w-[0rem] min-w-[0rem]'
          : isTab
            ? 'w-full min-w-0 lg:min-w-[19rem] lg:max-w-[19rem] xl:min-w-[22rem] xl:max-w-[22rem]'
            : title === 'Reports'
              ? 'w-full min-w-0 max-w-full md:min-w-[14rem] md:max-w-[14rem]'
              : isCampaignResponsiveTopbar
                ? 'w-full min-w-0 max-w-full lg:min-w-[16rem] lg:max-w-[16rem]'
                : isAdminResponsiveTopbar
                  ? 'w-full min-w-0 max-w-full lg:min-w-[14rem] lg:max-w-[14rem]'
                  : 'md:min-w-[16rem] md:max-w-[16rem] w-full xs:max-h-32 md:max-h-full',
      )}
    >
      {/* The toggle rides the divider between the panel and the body, and only
          shows itself once you are on the panel — every side panel in the app
          opens and closes from the same spot, Admin Hub included. */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        /* A solid chip, not a bare chevron: sitting on the divider with the
           page behind it, an outline-only button had nothing to read against
           and disappeared into whatever it happened to overlap. */
        className={cn(
          'absolute z-30 top-10 -right-3 h-6 w-6 items-center justify-center transition-all ease-in-out duration-200 border rounded-full shadow-md cursor-pointer hidden',
          isCampaignResponsiveTopbar || isAdminResponsiveTopbar ? 'lg:flex' : 'md:flex',
          collapsed || hovered
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none',
          hovered
            ? 'bg-primary border-primary text-white'
            : 'bg-white border-gray-300 text-gray-600',
        )}
      >
        <ChevronIcon
          className={cn(
            'w-4 h-4 transition-transform duration-200',
            collapsed ? '-rotate-90' : 'rotate-90',
          )}
        />
      </button>

      <div className={cn('flex flex-col', fullHeightOnMobile ? 'h-full' : 'h-auto sm:h-full')}>
        {(title || action) && isAdminResponsiveTopbar ? (
          // The wordmark stays mounted and fades with the rail's own width
          // (`data-rail-collapsed`) rather than being swapped by a React
          // conditional — an unmount/mount is a different DOM node, which no
          // CSS transition can smooth. Collapsed, the row closes to nothing
          // and the nav below takes the space back.
          <div className="relative mcm-adminnav-headerwrap">
            <div className="mcm-adminnav-header-expanded absolute inset-0 flex items-center justify-center px-4">
              <img src={AcepeakWordmark} alt="Acepeak" className="h-6 w-auto" />
            </div>
          </div>
        ) : (
          (title || action) && (
            <div
              className={cn(
                'flex items-center justify-between p-3 transition-opacity duration-300 border-b border-gray-200 min-h-[65px]',
                title === 'Reports' && 'min-h-14 md:min-h-[65px]',
                collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100',
              )}
            >
              <div className={`flex gap-1 items-center ${headerCustomClass}`}>
                <span>{icon}</span>
                <h4 className="text-gray-900 font-semibold text-lg">{title}</h4>
              </div>
              {action && action}
            </div>
          )
        )}

        <div
          className={cn(
            'transition-all duration-500 ease-in-out flex-1 min-h-0',
            fullHeightOnMobile
              ? 'overflow-hidden'
              : isCampaignResponsiveTopbar
                ? 'lg:overflow-hidden'
                : isAdminResponsiveTopbar
                  ? 'lg:overflow-hidden'
                  : 'md:overflow-hidden',
          )}
          onMouseEnter={() => setHovered(true)}
        >
          {collapsed && !isAdminResponsiveTopbar
            ? null
            : isAdminResponsiveTopbar && isValidElement(content)
              ? cloneElement(content as any, { collapsed })
              : content}
        </div>
      </div>
    </section>
  );
};

export default PageSidebarLayout;
