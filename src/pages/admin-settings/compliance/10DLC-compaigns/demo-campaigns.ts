/**
 * Demo rows for 10DLC Campaigns -- design preview only.
 *
 * No campaign has been registered on this workspace, so the table sat on
 * its empty state and the eight columns could not be judged against
 * anything. Shapes follow what the columns read (see index.tsx): the
 * `brandId` / `brandName` pairs are the same demo brands the Brands page
 * shows, so the two screens agree with each other; `campaignId` follows
 * TCR's format (a `C` and seven uppercase alphanumerics); `usecase` values
 * are TCR's standard use-case codes, which the create flow itself pulls
 * from the API.
 *
 * REMOVE THIS FILE (and the `staticData` swap in index.tsx) before release.
 */

export const DEMO_CAMPAIGNS = [
  {
    campaignId: 'CQ3KZ8M',
    isDemo: true,
    brandId: 'BQZ2K9M',
    brandName: 'Acepeak Communications',
    usecase: 'CUSTOMER_CARE',
    createdAt: '2026-06-09T10:20:00Z',
    upstreamCnpName: 'Sinch',
    resellerName: '',
    tcrStatus: 'ACTIVE',
  },
  {
    campaignId: 'CX7P2LD',
    isDemo: true,
    brandId: 'BQZ2K9M',
    brandName: 'Acepeak Communications',
    usecase: '2FA',
    createdAt: '2026-06-15T15:41:00Z',
    upstreamCnpName: 'Sinch',
    /* One campaign registered through a reseller, so that column is not a
       full column of dashes. */
    resellerName: 'Acepeak Resale LLC',
    tcrStatus: 'ACTIVE',
  },
  {
    campaignId: 'CM4T9RB',
    isDemo: true,
    brandId: 'BN4X7YT',
    brandName: 'Acepeak Support Desk',
    usecase: 'ACCOUNT_NOTIFICATION',
    createdAt: '2026-07-22T09:05:00Z',
    upstreamCnpName: 'Bandwidth',
    resellerName: '',
    tcrStatus: 'PENDING',
  },
  {
    campaignId: 'CF1H6QW',
    isDemo: true,
    brandId: 'BW8H1RC',
    brandName: 'Northbound Realty Group',
    usecase: 'MARKETING',
    createdAt: '2026-08-30T12:30:00Z',
    upstreamCnpName: 'Sinch',
    resellerName: '',
    /* Lapsed -- the one row that is neither running nor waiting. */
    tcrStatus: 'EXPIRED',
  },
];
