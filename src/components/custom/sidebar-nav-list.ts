export interface NavItem {
  id: number;
  name: string;
  link: string;
  isActive?: boolean;
  icon?: string;
  enabled?: boolean;
  visible?: boolean;
}

export const navList = (features: any, IS_ADMIN: boolean): NavItem[] =>
  [
    {
      id: 1,
      name: 'Home',
      link: '/dashboard',
      icon: 'Home',
    },
    {
      id: 14,
      name: 'Performance',
      link: '/performance',
      icon: 'BarChart2',
    },
    {
      id: 2,
      name: 'Phone',
      link: '/phone',
      icon: 'Phone',
    },
    {
      id: 8,
      name: 'Chat',
      link: '/messenger',
      icon: 'MessageSquare',
      enabled: Boolean(features?.plan_features?.chat?.IS_SHOW),
      visible: Boolean(features?.plan_features?.chat?.action?.view),
    },
    {
      id: 12,
      name: 'Agent Chat',
      link: '/agent-chat',
      icon: 'Bot',
      enabled: Boolean(features?.plan_features?.ai?.IS_SHOW),
      visible: Boolean(features?.plan_features?.ai?.action?.agent?.view),
    },

    {
      id: 4,
      name: 'Video',
      link: '/video',
      icon: 'Video',
      enabled: Boolean(features?.plan_features?.video?.IS_SHOW),
      visible: Boolean(features?.plan_features?.video?.action?.view),
    },
    {
      id: 5,
      name: 'Inbox',
      link: '/inbox',
      icon: 'Inbox',
      enabled: Boolean(features?.plan_features?.messages?.IS_SHOW),
      visible:
        Boolean(features?.plan_features?.messages?.action?.send_fax) ||
        Boolean(features?.plan_features?.messages?.action?.send_message) ||
        Boolean(features?.plan_features?.messages?.action?.send_mms),
    },
    {
      id: 6,
      name: 'Contact',
      link: '/contact',
      icon: 'BookUser',
      enabled: Boolean(features?.plan_features?.contact?.IS_SHOW),
      visible: Boolean(features?.plan_features?.contact?.action?.view),
    },

    {
      id: 7,
      name: 'Groups',
      link: '/department/extension',
      icon: 'Users',
      enabled:
        Boolean(features?.plan_features?.phone_system_action?.access?.DEPARTMENT) ||
        Boolean(features?.plan_features?.account_setting?.access?.USER?.action?.view),
      visible:
        Boolean(features?.plan_features?.account_setting?.access?.USER?.action?.view) ||
        (Boolean(features?.plan_features?.phone_system_action?.access?.DEPARTMENT) &&
          Boolean(features?.plan_features?.phone_system_action?.action?.view)),
    },
    {
      id: 9,
      name: 'Campaign',
      link: '/campaign/all-campaigns',
      icon: 'Megaphone',
      enabled: Boolean(features?.plan_features?.campaign?.IS_SHOW),
      visible: Boolean(features?.plan_features?.campaign?.action?.view),
    },
    {
      id: 10,
      name: 'Reports',
      link: '/reports',
      icon: 'FileBarChart',
      enabled: Boolean(features?.plan_features?.reports?.IS_SHOW),
      visible: true,
    },
  ]
    ?.filter(Boolean)
    ?.filter((item) => {
      if (IS_ADMIN) return true;
      return item?.visible !== false && item?.enabled !== false;
    });

export const navListBottom = (features: any, IS_ADMIN: boolean): NavItem[] => {
  const permissions = features?.plan_features;
  const hasAdminAccess =
    IS_ADMIN ||
    Boolean(permissions?.account_setting?.access?.SITE?.action?.view) ||
    Boolean(permissions?.account_setting?.access?.USER?.action?.view) ||
    Boolean(permissions?.virtual_numbers?.action?.view) ||
    Boolean(permissions?.phone_system_action?.action?.view) ||
    Boolean(permissions?.ai?.IS_SHOW) ||
    Boolean(permissions?.billing?.action?.view) ||
    Boolean(permissions?.calling_rates?.action?.view) ||
    Boolean(permissions?.omni_channel?.action?.view);

  return [
    hasAdminAccess && {
      id: 13,
      name: 'Admin',
      link: '/admin-settings',
      icon: 'ShieldCheck',
    },
  ].filter(Boolean) as NavItem[];
};
