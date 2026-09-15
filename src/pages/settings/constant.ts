export const NOTIFICATION_SETTINGS_INITIAL = {
  notification_settings: {
    voicemail: {
      email: false,
      socket: false,
      sms: false,
      push: false,
    },
    missed: {
      email: false,
      socket: false,
      sms: false,
      push: false,
    },
    sms: {
      email: false,
      socket: false,
      sms: false,
      push: false,
    },
    forgot_password: {
      email: true,
      socket: false,
      sms: true,
      push: false,
    },
  },
};

export const NOTIFICATION_SETTINGS_BREADCRUM = [{ label: 'Settings' }, { label: 'Notification' }];

/* Each channel gets a plain description of where the alert actually lands —
   "Web Alert" and "Mobile Alert" are the stored names and say nothing about
   that on their own. */
export const NOTIFICATION_SETTINGS_LIST = [
  { label: 'Email', value: 'email', hint: 'Send to your account email address.' },
  { label: 'Web Alert', value: 'socket', hint: 'Appears while this site is open in a browser.' },
  { label: 'SMS', value: 'sms', hint: 'Text message to the number below. Charged per message.' },
  { label: 'Mobile Alert', value: 'push', hint: 'Push notification on the mobile app.' },
];

/* Was a standalone yellow warning banner above these sections; moved into
   each section's own info tooltip instead so it's still one hover away
   without permanently occupying page space. Same text on all three, as
   requested — the underlying issue it describes (see NOTIFICATION_TYPES_LIST
   usage) is unchanged either way. */
const ALERTS_NOT_SENT_NOTICE =
  ' Voicemail and missed-call alerts have stopped. Saved here, but not sent since Aug 24 — SMS alerts have never gone out.';

export const NOTIFICATION_TYPES_LIST = [
  {
    id: 1,
    name: 'Voicemail Notifications',
    description: 'When someone leaves a voicemail.' + ALERTS_NOT_SENT_NOTICE,
    value: 'voicemail',
    settingsType: NOTIFICATION_SETTINGS_LIST,
  },
  {
    id: 2,
    name: 'Missed Calls Notifications',
    description: 'When a call goes unanswered.' + ALERTS_NOT_SENT_NOTICE,
    value: 'missed',
    settingsType: NOTIFICATION_SETTINGS_LIST,
  },
  {
    id: 3,
    name: 'SMS Notifications',
    description: 'When a text message arrives.' + ALERTS_NOT_SENT_NOTICE,
    value: 'sms',
    settingsType: NOTIFICATION_SETTINGS_LIST,
  },
] as const;
