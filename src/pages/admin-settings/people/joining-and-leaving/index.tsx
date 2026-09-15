/* What happens when somebody joins, and what happens when somebody leaves.
 *
 * The People page is a list of who is here. It cannot answer the questions an
 * administrator actually asks on their first week: what does the person I just
 * added receive, does anybody get an email, what happens to their number when
 * they leave, can I get them back, can I change the address they sign in with.
 * Every one of those is answered somewhere between a form, a dialog and a
 * support ticket, and several of the answers are "no" — which is fine, but only
 * if somebody says so before the admin needs it to be yes.
 *
 * So this is one page that answers all of them plainly, marks each one with how
 * far it really goes, and puts the two decisions that are actually decisions —
 * which role a new person starts on, and where the list goes when you export it
 * — where they can be acted on rather than described.
 *
 * Everything on it is checked against what the platform really does. Where the
 * platform cannot do something the card says "coming soon" and says what to do
 * in the meantime, rather than offering a switch that saves an answer nobody
 * reads.
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, InfoIcon, KeyRound, LogOut, Mail, UserPlus, Users } from 'lucide-react';

import CustomTooltip from '@/components/custom/custom-tooltip';
import Loader from '@/components/custom/loader';
import { SettingCard, SettingRow } from '@/components/mcm/setting-card';
import { Button } from '@/components/ui/button';
import { AdminPage } from '@/pages/admin-settings/page-shell';
import { getRoleList, getUserList } from '@/services/api';
import { COMPANY_DEFAULTS_QUERY_KEY, fetchCompanyDefaults } from '@/lib/company-defaults';
import { NEW_PERSON_ROLE_KEY, readNewPersonRole } from '@/lib/role-permission-defaults';
import { decideInviteRole, describeRole } from '@/lib/invite-role';
import { EXPORT_LIMITS } from '@/lib/user-roster-export';
import './joining-and-leaving-theme.css';

const JoiningAndLeaving = () => {
  const navigate = useNavigate();

  /* All three lists are already held under these keys by the pages next door,
     so arriving here from People or from Default permissions fetches nothing. */
  const { data: roster = [], isLoading: rosterLoading } = useQuery({
    queryKey: ['directoryPeople'],
    queryFn: () => getUserList({ page: 1, limit: 500 }),
    select: (res: any) => res?.data?.data?.result?.rows || [],
  });

  const { data: roleList = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['useRolesList', false],
    queryFn: () => getRoleList(),
    select: (data: any) => data?.data?.data?.result?.rows || [],
  });

  const { data: companyDefaults, isLoading: defaultsLoading } = useQuery({
    queryKey: COMPANY_DEFAULTS_QUERY_KEY,
    queryFn: fetchCompanyDefaults,
  });

  /* The same decision the Add person form makes, made here so an administrator
     can see the answer without starting to add somebody and then abandoning the
     form. One piece of logic, two screens. */
  const decision = useMemo(
    () =>
      decideInviteRole({
        savedRoleId: readNewPersonRole((companyDefaults as any)?.settings?.[NEW_PERSON_ROLE_KEY]),
        roles: roleList,
      }),
    [companyDefaults, roleList],
  );

  /* Three counts worth knowing before reading anything else: how many people
     there are, how many of them can change everything, and how many cannot be
     reached from outside. */
  const counts = useMemo(() => {
    const people = Array.isArray(roster) ? roster : [];
    const roleOf = (person: any) =>
      String(
        person?.custom_role_data?.name || person?.role_data?.name || person?.role || '',
      ).toUpperCase();
    return {
      total: people.length,
      admins: people.filter((person: any) => roleOf(person) === 'ADMIN').length,
      withoutNumber: people.filter((person: any) => !String(person?.caller_id || '').trim()).length,
    };
  }, [roster]);

  const loading = rosterLoading || rolesLoading || defaultsLoading;

  return (
    <AdminPage
      className="jal-theme"
      section="People"
      title={
        <span className="flex items-center gap-2">
          <span className="dir-serif-heading">Joining and leaving</span>
          <CustomTooltip
            text={
              <>
                What somebody receives when you add them, what
                <br />
                they start out able to do, and what happens to
                <br />
                their number, data and account when they go.
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
        <Button type="button" variant="outline" onClick={() => navigate('/admin-settings/people')}>
          Open the people list
        </Button>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
        {loading ? (
          <Loader />
        ) : (
          <>
            <SettingCard
              title="Where you stand today"
              icon={<Users className="h-4 w-4" />}
              description="Read from the people list, not stored here."
            >
              <SettingRow
                label="People on the account"
                description="Everybody the platform will let you see. Somebody who has been removed is not counted — removed people are hidden everywhere."
                control={<span className="text-lg font-semibold">{counts.total}</span>}
              />
              <SettingRow
                label="Administrators"
                description="People who can change anything, buy numbers and reach the billing screen. Worth keeping to as few as the company can manage with — and worth checking, because the platform's own fallback for a person created without a role is administrator."
                control={<span className="text-lg font-semibold">{counts.admins}</span>}
              />
              <SettingRow
                label="People with no number of their own"
                description="They can still be reached on their extension from inside the company, and can still make calls. Nobody outside can dial them directly."
                control={<span className="text-lg font-semibold">{counts.withoutNumber}</span>}
              />
            </SettingCard>

            <SettingCard
              title="Adding somebody"
              icon={<UserPlus className="h-4 w-4" />}
              description="What the person receives, and what they can do the moment they sign in."
              status="active"
              note="All of this happens as described. There is nothing here waiting on work."
            >
              <SettingRow
                label="The role they start on"
                description={
                  <>
                    {decision.reason}
                    {decision.role ? ` ${describeRole(decision.role)}` : ''}
                    {decision.warning ? ` ${decision.warning}` : ''}
                  </>
                }
                status="active"
                control={
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/admin-settings/default-permissions')}
                  >
                    {decision.source === 'company-choice' ? 'Change it' : 'Choose one'}
                  </Button>
                }
              />
              <SettingRow
                label="How they get in"
                description="There is no invitation to accept. You set a password when you add them, the platform emails it to them along with the sign-in address, and their account works straight away. Nobody sits waiting in a pending state, so nothing needs chasing — but the password does travel by email, so it is worth asking people to change it once they are in."
                status="active"
              />
              <SettingRow
                label="How many at a time"
                description="Up to ten people in one go, all into the same location. Each one needs their own email address, phone number and extension — the form now says so before you send it rather than after."
                status="active"
              />
              <SettingRow
                label="Licences"
                description="Everybody added uses a licence. If there are not enough spare, the form asks for payment before it will create anybody, rather than creating some of them and stopping."
                status="active"
              />
            </SettingCard>

            <SettingCard
              title="Somebody who is already here"
              icon={<Users className="h-4 w-4" />}
              description="What happens when the person you are adding turns out to exist."
              status="active"
            >
              <SettingRow
                label="One person, one location"
                description="A person belongs to exactly one location. Their extension, their number, their opening hours and their clock all come from it, and somebody in two locations would have two of each. So there is no way to add a person a second time to move them: open them on the people list and change their location instead. Nothing is charged twice, because nothing is created twice."
                status="active"
              />
              <SettingRow
                label="When the check says the address is taken but you cannot find them"
                description="The platform checks an email address against every company it hosts, not only yours. An address belonging to a completely different organisation comes back the same way as your own colleague's. The Add person form now tells the two apart: if the person is one of yours it names them and says where they sit, and if they are not it says so plainly, so nobody goes hunting for a colleague who was never here."
                status="active"
              />
            </SettingCard>

            <SettingCard
              title="Removing somebody"
              icon={<LogOut className="h-4 w-4" />}
              description="What is checked first, what goes, and what stays."
              status="active"
              note="Everything in this card is what the platform actually does today, except the two rows marked below."
            >
              <SettingRow
                label="What is checked before it happens"
                description="Whether they are the last person answering a queue, whether a menu key sends callers to them, whether a number forwards to their extension, and whether they are the last person in a group. Anything found is listed in the confirmation, in terms of what a caller would experience."
                status="active"
              />
              <SettingRow
                label="Administrators cannot be removed"
                description="The platform refuses to remove anybody whose role is administrator — not just the last one. Change their role to something else first, then remove them. The confirmation now says this before you press the button rather than after."
                status="active"
              />
              <SettingRow
                label="Their number"
                description="It stays on the account and stops being assigned to anybody, so it turns up under Unused numbers and can be given to somebody else. You keep paying for it either way, so a number nobody needs is worth releasing separately."
                status="active"
                control={
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/admin-settings/numbers/inventory')}
                  >
                    Unused numbers
                  </Button>
                }
              />
              <SettingRow label="Who held a number last, and when it was freed" />
              <SettingRow
                label="Calls that were forwarded to them"
                description="Anybody whose calls were being sent to the removed person has their forwarding repointed at you — the administrator doing the removing. That is the platform's own behaviour and it is not optional, so it is worth checking those people afterwards rather than discovering it through their call history."
                status="active"
              />
              <SettingRow label="Getting somebody back" />
              <SettingRow
                label="Their data"
                description="Call history stays for your records. Voicemail, recordings and messages go with them."
                status="active"
              />
            </SettingCard>

            <SettingCard
              title="Changing the address somebody signs in with"
              icon={<Mail className="h-4 w-4" />}
              description="People marry, companies rebrand, and the address on an account stops matching the person."
            >
              <SettingRow label="What to do in the meantime" />
            </SettingCard>

            <SettingCard
              title="One person handling another's calls"
              icon={<CalendarClock className="h-4 w-4" />}
              description="An assistant answering on somebody else's behalf, seeing their voicemail, and taking their calls on their direct line."
            >
              <SettingRow
                label="What works today instead"
                description="Forwarding one person's calls to another, and putting both people in the same group so either can answer. Neither is the same thing — the assistant answers as themselves rather than on the other person's line, and there is no way to give one person sight of another's voicemail — but between them they cover the everyday case."
                status="active"
                control={
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/admin-settings/people')}
                  >
                    Set up forwarding
                  </Button>
                }
              />
            </SettingCard>

            <SettingCard
              title="Taking the list away"
              icon={<KeyRound className="h-4 w-4" />}
              description="The whole roster as a spreadsheet — names, addresses, roles, locations, extensions, numbers, groups and the day each person was added."
              status="active"
              note="Built here in the browser from the list on screen, because the platform has no export for people. What comes out is what the people list is showing, so clear the filters first if you want everybody."
            >
              <SettingRow
                label="Export the people list"
                description="Downloads straight away. Nothing is emailed and nothing is queued."
                status="active"
                control={
                  <Button type="button" variant="primary" onClick={() => navigate('/admin-settings/people')}>
                    Go to the list
                  </Button>
                }
              />
              {/* The columns an established system exports and this one cannot,
                  each with the reason. Somebody who notices a gap in a
                  spreadsheet otherwise assumes the data was lost. */}
              {EXPORT_LIMITS.map((limit) => (
                <SettingRow key={limit.id} label={limit.label} />
              ))}
            </SettingCard>
          </>
        )}
      </div>
    </AdminPage>
  );
};

export default JoiningAndLeaving;
