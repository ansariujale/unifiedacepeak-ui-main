/**
 * Demo rows for 10DLC Resellers -- design preview only.
 *
 * No reseller record exists on this workspace, so the table sat on its
 * empty state. Shapes follow what the columns read (see index.tsx);
 * `resellerId` follows TCR's format (an `R` and seven uppercase
 * alphanumerics). The first row is the reseller the demo campaign on the
 * SMS Campaigns page names, so the two screens agree.
 *
 * REMOVE THIS FILE (and the `staticData` swap in index.tsx) before release.
 */

export const DEMO_RESELLERS = [
  {
    resellerId: 'R7K2QZM',
    isDemo: true,
    companyName: 'Acepeak Resale LLC',
    email: 'compliance@acepeak.ai',
    phone: '+1 415 555 0182',
  },
  {
    resellerId: 'RN4X8TY',
    isDemo: true,
    companyName: 'Northbound Comms Ltd',
    email: 'ops@northbound.example',
    phone: '+1 604 555 0147',
  },
  {
    resellerId: 'RB3L6QD',
    isDemo: true,
    companyName: 'Harbor Point Telecom',
    email: 'hello@harborpoint.example',
    phone: '+1 212 555 0199',
  },
];
