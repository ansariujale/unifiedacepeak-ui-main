import { useUser } from '@/hooks/use-user';
import { useState } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import { Icon } from '@/assets/icons/icon';
import { useNavigate } from 'react-router-dom';
import { useSocketEvents } from '@/hooks/use-socket-events';
import { useCompanyFeatures } from '@/hooks/rbac';
import { useMyPresence } from '@/hooks/use-my-presence';
import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { presenceStatusArray, statusImageLookup } from '../constants';
import CustomAvatar from '../../custom-avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import packageJson from '../../../../../package.json';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logout, updateMemberForwading, userUpdateStatus } from '@/services/api';
import { invalidateGlobalUsersDirectory } from '@/lib/invalidate-global-users-directory';
import { getRoutePrefetchHandlers } from '@/router/route-prefetch';
import { mergeCallForwarding } from '@/lib/call-forwarding-record';

const AvatarContent = ({ setProfileState }: any) => {
  const { user, handleRemoveUser } = useUser();
  const [showPresence, setShowPresence] = useState(false);
  const firstName = user?.user_info?.first_name || '';
  const lastName = user?.user_info?.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim();
  const phone = user?.user_info?.phone ? String(user.user_info.phone) : '';
  const queryClient: any = useQueryClient();

  const { socketEventsManager, disconnectSocket } = useSocketEvents();
  const navigate = useNavigate();
  const { features } = useCompanyFeatures();
  // Resolved in one place so the header chip and this menu always agree.
  const { status: effectiveSocketStatus } = useMyPresence();

  const { mutate: mutateUpdateMember } = useMutation({
    mutationFn: updateMemberForwading,
    onSuccess: () => {
      invalidateGlobalUsersDirectory(queryClient);
    },
  });

  function statusChangeEvent(status: string, timeObj: any = undefined) {
    socketEventsManager?.emit(
      'user-presence-update',
      {
        doc: {
          userId: user?.user_info?.extension,
          domain: user?.sip_credentials?.domain,
          uuid: user?.uuid,
          status: status,
          onCall: false,
          timeObj,
        },
      },
      (response: any) => {
        console.log('User-presence-update:', response);
      },
    );
  }

  const { mutate: mutateUserUpdateStatus } = useMutation({
    mutationFn: userUpdateStatus,
    onSuccess: (data, variables) => {
      console.log('data', data, variables);
      queryClient.invalidateQueries(['getUsersDetails']);
      statusChangeEvent(variables?.socket_status, {
        holiday_start_date: null,
        holiday_end_date: null,
      });
    },
  });

  const handleUserCallRules = (status: string) => {
    const userInfo = user?.user_info || {};
    /* Presence is the only key this menu owns. The rest of the record — the
       forwarding rules and the do-not-disturb flag — is carried through, so
       changing your availability does not delete it. */
    const callRuleRequest = mergeCallForwarding(user?.call_forwarding, { status });
    const rolePayloadKey = userInfo?.custom_role_uuid ? 'custom_role_uuid' : 'role_uuid';
    const payload = {
      first_name: userInfo?.first_name || '',
      last_name: userInfo?.last_name || '',
      job_title: userInfo?.job_title || '',
      caller_id: userInfo?.caller_id || '',
      site_uuid: userInfo?.site_uuid || '',
      profile: userInfo?.profile || '',
      [rolePayloadKey]: userInfo?.custom_role_uuid || userInfo?.role_uuid || null,
      call_forwarding: callRuleRequest,
      uuid: user?.uuid,
      userID: user?.uuid,
    };
    mutateUpdateMember(payload);
  };

  // const myStatus =
  //   usersOnlineStatus?.find((item: any) => item?.userId === user?.user_info?.extension)?.status ||
  //   'online';

  const handleStatusChange = async (status: string) => {
    if (effectiveSocketStatus === status) return;
    handleUserCallRules(status);
    mutateUserUpdateStatus({ socket_status: status });
    setShowPresence(false);
    setProfileState(false);
  };

  const handleAddFunds = () => {
    navigate('/admin-settings/billing/purchase');
    setProfileState(false);
  };

  const { mutate: logoutMutate } = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // Disconnect socket first to prevent any socket events from firing
      disconnectSocket();
      // Small delay to ensure socket cleanup completes before clearing user data
      setTimeout(() => {
        handleRemoveUser();
      }, 100);
    },
  });

  const logoutDevice = async () => {
    const payload = {
      type: 'single',
      device_securities: [user?.device_token],
      user_uuid: user?.uuid,
    };
    logoutMutate(payload);
  };
  return (
    <div className="flex flex-col gap-1 px-1 pb-1">
      {/* Identity */}
      <div className="flex flex-col items-center gap-2 pt-1 pb-3">
        <CustomAvatar
          name={fullName}
          size="72"
          extension={user?.user_info?.extension}
          image={user?.user_info?.profile}
          isActivityInfo={false}
        />
        <h3 className="max-w-full truncate text-[14px] font-bold text-gray-900 dark:text-gray-100">
          {fullName}
        </h3>
      </div>

      {/* Contact details */}
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[12.5px] text-gray-600 dark:text-gray-400">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500 dark:bg-[#262626] dark:text-gray-400">
            <Icon name="LetterLine" className="h-3.5 w-3.5" />
          </span>
          <span className="truncate">{user?.user_info?.email || ''}</span>
        </div>
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[12.5px] text-gray-600 dark:text-gray-400">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500 dark:bg-[#262626] dark:text-gray-400">
            <Icon name="Grid" className="h-3.5 w-3.5" />
          </span>
          <span className="truncate">Ext. {user?.user_info?.extension}</span>
        </div>
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[12.5px] text-gray-600 dark:text-gray-400">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500 dark:bg-[#262626] dark:text-gray-400">
            <Icon name="PhoneLine" className="h-3.5 w-3.5" />
          </span>
          <span className="truncate">
            {phone.startsWith('+') ? phone : phone ? `+${phone}` : ''}
          </span>
        </div>
      </div>

      <div className="my-1.5 border-t border-gray-100 dark:border-[#262626]" />

      <Popover open={showPresence} onOpenChange={(val) => setShowPresence(val)}>
        <PopoverTrigger className="group flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 hover:bg-ucass-primary-200">
          <span className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100 dark:bg-[#262626]">
              {statusImageLookup[effectiveSocketStatus] ?? statusImageLookup['online']}
            </span>
            <span className="text-[12.5px] font-semibold capitalize text-gray-700 group-hover:text-foreground dark:text-gray-300">
              {effectiveSocketStatus === 'dnd' ? 'DND' : effectiveSocketStatus}
            </span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform group-data-[state=open]:rotate-180" />
        </PopoverTrigger>
        <PopoverContent className="p-1 flex flex-col gap-1" side="left" align="start">
          {presenceStatusArray.map((status) => {
            const isActive = effectiveSocketStatus === status?.value;
            return (
              <div
                key={status.value}
                className={`flex items-center gap-2 w-full cursor-pointer px-2 rounded-md ${isActive ? 'bg-ucass-active-bg' : 'hover:bg-gray-200'}`}
                onClick={() => handleStatusChange(status.value)}
              >
                <div className="w-4 h-4">{statusImageLookup[status.value]}</div>
                <div className="p-2 ">
                  <div className="text-sm">{status.title}</div>
                  <div className="text-xs">{status.description}</div>
                </div>
              </div>
            );
          })}
        </PopoverContent>
      </Popover>

      <div className="my-1.5 border-t border-gray-100 dark:border-[#262626]" />

      {/* Menu */}
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[13px] font-semibold text-gray-700 hover:bg-ucass-primary-200 hover:text-foreground dark:text-gray-300"
          {...getRoutePrefetchHandlers('/admin-settings/account/basic-info')}
          onClick={() => {
            navigate('/admin-settings/account/basic-info');
            setProfileState(false);
          }}
        >
          <Icon name="UserLine" className="h-4 w-4 text-gray-400" />
          My Profile
        </button>
        <button
          type="button"
          className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[13px] font-semibold text-gray-700 hover:bg-ucass-primary-200 hover:text-foreground dark:text-gray-300"
          onClick={(val) => setProfileState(val ? 'changePassword' : null)}
        >
          <Icon name="LockFilled" className="h-4 w-4 text-gray-400" />
          Change Password
        </button>
        {features?.plan_features?.billing?.action?.view && (
          <button
            type="button"
            className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[13px] font-semibold text-gray-700 hover:bg-ucass-primary-200 hover:text-foreground dark:text-gray-300"
            {...getRoutePrefetchHandlers('/admin-settings/billing/purchase')}
            onClick={handleAddFunds}
          >
            <Icon name="DollarSign" className="h-4 w-4 text-gray-400" />
            Add Funds
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            logoutDevice();
          }}
          className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[13px] font-semibold text-red-600 hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>

      <DropdownMenuSeparator />
      <p className="px-2 pb-1 text-right text-[10.5px] text-gray-400">v{packageJson.version}</p>
    </div>
  );
};

export default AvatarContent;
