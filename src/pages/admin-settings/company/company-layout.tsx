/* The frame around every company settings screen.
 *
 * These nine screens used to be one page holding `activeSection` in state, so
 * all nine shared a single URL. Nothing could be linked to, a reload always
 * landed back on the first section, the back button skipped the whole area, and
 * one permission guarded the lot — including Security, which sits behind the
 * phone-system permission and therefore opens for anyone who can view the phone
 * system.
 *
 * Each section is now a route. This component holds only what they share: the
 * heading, the sub-navigation, and the outlet the section renders into. The nav
 * is built from the same table the router uses, so a section cannot appear in
 * one and not the other.
 */

import { NavLink, Outlet } from 'react-router-dom';
import { Info } from 'lucide-react';

import { useUser } from '@/hooks/use-user';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { COMPANY_SECTIONS } from './company-sections';

import '@/components/mcm/mcm-page.css';

const CompanyLayout = () => {
  const { user } = useUser();
  const companyName =
    user?.company_info?.company_name || user?.user_info?.company_name || 'your company';

  return (
    <section className="mcm-company-theme w-full h-full min-h-0 flex flex-col overflow-hidden bg-gray-200/15">
      <div className="flex items-start justify-between gap-4 px-3 py-2 border-b border-gray-200 min-h-[56px] bg-white">
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
              Company Phone Preferences
            </p>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 shrink-0 cursor-help text-gray-400" />
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="w-max max-w-[280px] [text-wrap:pretty] text-black [&_svg]:fill-[#fdf7f5]"
                style={{
                  background: '#fdf7f5',
                  border: 'none',
                  color: '#000',
                  boxShadow: '0 6px 20px rgba(17,17,17,0.18)',
                }}
              >
                The phone rules for {companyName}, kept in one place.
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Stays put while the section below scrolls — the tab strip is
          orientation, not content, so it should not disappear the moment
          someone scrolls a couple of settings down. */}
      <div className="shrink-0 px-3 pt-4 bg-white">
        {/* Links rather than buttons, so each section can be opened in a new tab,
            bookmarked, and sent to someone in a support reply. */}
        <div className="mb-3">
          <nav className="mcm-segmented company-tabs-nav" aria-label="Company settings">
            {COMPANY_SECTIONS.map((item) => (
              <NavLink key={item.path} to={`/admin-settings/company/${item.path}`}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      <div className="no-scrollbar flex min-h-0 flex-1 flex-col px-3 pb-3 overflow-y-auto">
        <Outlet />
      </div>
    </section>
  );
};

export default CompanyLayout;
