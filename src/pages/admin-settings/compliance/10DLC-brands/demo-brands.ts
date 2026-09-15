/**
 * Demo rows for 10DLC Brands — design preview only.
 *
 * This workspace has not registered a brand yet, so the table was
 * permanently on its empty state with no way to judge the seven columns
 * against real content — the ID format, how a long entity type or a
 * two-status pair sit next to each other, what the row action does with a
 * populated table instead of nothing to point at.
 *
 * Shapes match what the columns actually read (see index.tsx): `entityType`
 * is one of the raw enum values the create-brand form itself offers
 * (constant.ts's `entityTypes`), `country` is the ISO code the form's
 * country select stores, and `brandId` follows TCR's own format — a `B`
 * followed by seven uppercase alphanumerics.
 *
 * REMOVE THIS FILE (and the `staticData` swap in index.tsx) before release.
 */

export const DEMO_BRANDS = [
  {
    brandId: 'BQZ2K9M',
    isDemo: true,
    displayName: 'Acepeak Communications',
    entityType: 'PRIVATE_PROFIT',
    country: 'US',
    identityStatus: 'VERIFIED',
    status: 'REGISTERED',
    createdAt: '2026-06-02T14:12:00Z',
  },
  {
    brandId: 'BN4X7YT',
    isDemo: true,
    displayName: 'Acepeak Support Desk',
    entityType: 'PRIVATE_PROFIT',
    country: 'US',
    identityStatus: 'VETTED_VERIFIED',
    status: 'REGISTERED',
    createdAt: '2026-07-18T09:40:00Z',
  },
  {
    brandId: 'BW8H1RC',
    /* Not yet approved — the one row that exercises the pending state
       instead of every row landing on the same "done" status. */
    isDemo: true,
    displayName: 'Northbound Realty Group',
    entityType: 'SOLE_PROPRIETOR',
    country: 'CA',
    identityStatus: 'SELF_DECLARED',
    status: 'PENDING',
    createdAt: '2026-08-27T17:05:00Z',
  },
  {
    brandId: 'BF3L6QD',
    /* A brand TCR rejected — the failure state, and the one row where the
       delete action is the only thing worth doing with it. */
    isDemo: true,
    displayName: 'Riverside Youth Foundation',
    entityType: 'NON_PROFIT',
    country: 'US',
    identityStatus: 'UNVERIFIED',
    status: 'FAILED',
    createdAt: '2026-05-11T11:22:00Z',
  },
];
