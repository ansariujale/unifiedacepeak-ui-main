import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Identities from './Identities';
import Addresses from './addresses';
import Verification from './verification';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import useDebounce from '@/hooks/use-debounce';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CreateNewAddress from './addresses/create-new-address';
import { useSlidingTabIndicator } from '@/components/custom/use-sliding-tab-indicator';
import CreateIdentity from '../all-numbers/add-number-new/create-identity';
import { GETSCHEMA, initialState } from '../all-numbers/constants';
import {
  createAddress,
  createIdentity,
  uploadAddressProof,
  uploadIdentityProof,
  uploadIdentitySupportingDocuments,
} from '@/services/api';
import { parsePhoneNumber } from 'libphonenumber-js/max';
import { handleAlert } from '@/lib/utils';
import Loader from '@/components/custom/loader';
import { AdminPage } from '@/pages/admin-settings/page-shell';
import CustomTooltip from '@/components/custom/custom-tooltip';
import {
  Building2,
  CheckCircle2,
  Clock,
  FileCheck2,
  Globe2,
  IdCard,
  Info,
  MapPin,
  Plus,
  ShieldCheck,
  User,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { DUMMY_IDENTITIES } from './Identities';
import { DUMMY_ADDRESSES } from './addresses';
import { DUMMY_VERIFICATIONS } from './verification';

const routeObj = {
  identities: '/admin-settings/numbers/identities',
  addresses: '/admin-settings/numbers/addresses',
  verifications: '/admin-settings/numbers/verifications',
};
const tabList = [
  { label: 'Identities', value: 'identities', icon: IdCard },
  { label: 'Addresses', value: 'addresses', icon: MapPin },
  { label: 'Verifications', value: 'verifications', icon: ShieldCheck },
];

/* Shown as a tooltip off the title's info icon rather than a line under it —
   see AdminPage's `titleSuffix` prop. */
const PAGE_DESCRIPTION =
  'Identities and addresses your numbers are issued against, created when buying a number that needs one. Review and edit them here.';

/* A quick census for each tab, matching the design mockup's KPI row.
   Recomputed from the same dummy array each tab's own table renders
   rather than kept as separate numbers, so the two can't drift. */
const identityStats = [
  {
    label: 'Total Identities',
    value: DUMMY_IDENTITIES.length,
    caption: 'Identities on this account',
    icon: Users,
    tone: 'rose',
  },
  {
    label: 'Businesses',
    value: DUMMY_IDENTITIES.filter((row) => row.identity_type === 'Business').length,
    caption: 'Registered as a business',
    icon: Building2,
    tone: 'blue',
  },
  {
    label: 'Individuals',
    value: DUMMY_IDENTITIES.filter((row) => row.identity_type === 'Individual').length,
    caption: 'Registered as an individual',
    icon: User,
    tone: 'green',
  },
  {
    label: 'Verifications',
    value: DUMMY_IDENTITIES.length,
    caption: 'Identities verified so far',
    icon: ShieldCheck,
    tone: 'amber',
  },
];

const addressStats = [
  {
    label: 'Total Addresses',
    value: DUMMY_ADDRESSES.length,
    caption: 'Addresses on this account',
    icon: MapPin,
    tone: 'rose',
  },
  {
    label: 'Countries',
    value: new Set(DUMMY_ADDRESSES.map((row) => row.address.country)).size,
    caption: 'Countries represented',
    icon: Globe2,
    tone: 'blue',
  },
  {
    label: 'Cities',
    value: new Set(DUMMY_ADDRESSES.map((row) => row.address.city)).size,
    caption: 'Distinct cities on file',
    icon: Building2,
    tone: 'green',
  },
  {
    label: 'Total Proofs',
    value: DUMMY_ADDRESSES.reduce((sum, row) => sum + row.address_proof.length, 0),
    caption: 'Proof documents uploaded',
    icon: FileCheck2,
    tone: 'amber',
  },
];

const verificationStats = [
  {
    label: 'Total Verifications',
    value: DUMMY_VERIFICATIONS.length,
    caption: 'Verification records',
    icon: ShieldCheck,
    tone: 'rose',
  },
  {
    label: 'Pending',
    value: DUMMY_VERIFICATIONS.filter((row) => row.awaiting_registration === 'Pending').length,
    caption: 'Awaiting a decision',
    icon: Clock,
    tone: 'blue',
  },
  {
    label: 'Approved',
    value: DUMMY_VERIFICATIONS.filter((row) => row.awaiting_registration === 'Approved').length,
    caption: 'Cleared verifications',
    icon: CheckCircle2,
    tone: 'green',
  },
  {
    label: 'Rejected',
    value: DUMMY_VERIFICATIONS.filter((row) => row.awaiting_registration === 'Rejected').length,
    caption: 'Declined verifications',
    icon: XCircle,
    tone: 'amber',
  },
];

const StatsRow = ({ stats }: { stats: typeof identityStats }) => (
  <div className="ident-stats-row">
    {stats.map(({ label, value, caption }) => (
      <div className="ident-stat-card" key={label}>
        <div className="ident-stat-label">{label}</div>
        <div className="ident-stat-value">{value}</div>
        <div className="ident-stat-caption">{caption}</div>
      </div>
    ))}
  </div>
);

const IdentitiesAndAddressesPageLayout = () => {
  /* Portal target for the "per page" select's menu (see TableManager's
     perPageMenuPortalTarget): it needs to sit inside this page's coral
     theme scope to inherit --accent, but outside the table card's
     overflow:hidden so the menu isn't clipped. This wrapper — the whole
     page's root, no overflow of its own — is both. */
  const [menuPortalTarget, setMenuPortalTarget] = useState<HTMLDivElement | null>(null);
  const [search, setSearch] = useState<string>('');
  const debouncedSearch = useDebounce(search, 800);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const getActiveTab = pathname?.split('/')[pathname?.split('/')?.length - 1];
  const activeTab = getActiveTab?.toLocaleLowerCase();
  const { navRef: tabsNavRef, indicatorStyle: tabsIndicatorStyle } = useSlidingTabIndicator(activeTab);
  const [drawerState, setDrawerState] = useState({
    addNewAddress: false,
    addNewIdentity: false,
  });
  const handleClose = (drawerName: string) =>
    setDrawerState((prev) => ({ ...prev, [drawerName]: false }));

  const handleTabChange = (route: string) => {
    navigate(routeObj[route as keyof typeof routeObj]);
    setSearch('');
  };

  const queryClient = useQueryClient();

  /* Both "Add identity" and "Add address" used to render buttons with no
     onClick at all — clicking them did nothing. The forms they need
     (CreateIdentity / CreateNewAddress) are the same ones the "Add Number"
     wizard uses, driven entirely by the `formInstance` prop it hands them,
     so a standalone form instance here is what actually makes them work
     outside that wizard. The wizard's step-2 schema only requires these
     fields when `groupId.needs_registration` is true (set from the number
     being bought); opened from this page there is no number in play, so
     that flag is forced on to keep the same required-field validation. */
  const identityForm = useForm<any>({
    defaultValues: initialState,
    resolver: yupResolver(GETSCHEMA[2]),
    /* The wizard's step-2 schema only requires these fields when
       `schemaContext.current.groupId.needs_registration` is true (set from
       the number being bought). Opened standalone from this page there is
       no number in play, so that flag is forced on here to keep the same
       required-field validation. */
    context: { schemaContext: { current: { groupId: { needs_registration: true } } } },
    mode: 'onChange',
  });

  const addressForm = useForm<any>({
    defaultValues: initialState,
    mode: 'onChange',
  });

  const { mutateAsync: mutateUploadIdentityProof } = useMutation({
    mutationFn: uploadIdentityProof,
  });
  const { mutateAsync: mutateUploadSupportingDocs } = useMutation({
    mutationFn: uploadIdentitySupportingDocuments,
  });
  const { mutate: mutateCreateIdentity, isPending: isCreatingIdentity } = useMutation({
    mutationFn: createIdentity,
    onSuccess: async ({ data }: any) => {
      const identityId = data?.data?.result?.rows?.identity_id;
      const files = identityForm.getValues('proofs') || [];
      const supportingDocs = identityForm.getValues('supporting_documents') || [];
      const uploadTasks: Promise<any>[] = [];

      if (files?.some((item: any) => item?.file)) {
        const formData = new FormData();
        files.forEach((item: any) => {
          if (item?.file) {
            formData.append('identity_proof', item.file);
            formData.append('proof_type_id[]', item.proof_type_id?.value);
          }
        });
        formData.append('identity_id', identityId);
        formData.append('type', 'identity');
        uploadTasks.push(mutateUploadIdentityProof(formData));
      }
      if (supportingDocs?.some((item: any) => item?.file)) {
        const formData = new FormData();
        supportingDocs.forEach((item: any) => {
          if (item?.file) {
            formData.append('identity_supporting_document', item.file);
            formData.append(
              'supporting_document_template_id[]',
              item.supporting_document_template_id?.value,
            );
          }
        });
        formData.append('identity_id', identityId);
        formData.append('type', 'supporting_document');
        uploadTasks.push(mutateUploadSupportingDocs(formData));
      }

      try {
        await Promise.all(uploadTasks);
        handleAlert({ text: 'Identity created successfully.', type: 'success' });
        identityForm.reset(initialState);
        setDrawerState((prev) => ({ ...prev, addNewIdentity: false }));
        queryClient.invalidateQueries({ queryKey: ['identityList'] });
      } catch {
        handleAlert({
          text: 'Identity was created, but one or more proof files failed to upload.',
          type: 'error',
        });
      }
    },
    onError: (error: any) => {
      handleAlert({
        text: error?.response?.data?.message || 'Could not create this identity.',
        type: 'error',
      });
    },
  });

  const submitIdentity = identityForm.handleSubmit((values: any) => {
    const {
      type,
      company_name,
      company_registration_number,
      vat_number,
      website,
      firstname,
      lastname,
      email,
      phone,
      tax_id,
      id_number,
      country,
      birth_place,
      day,
      month,
      year,
      description,
      requirements_type,
      requirements_country,
      number_type,
    } = values || {};
    const parsedNumber = phone ? parsePhoneNumber(`+${phone}`) : undefined;
    const paddedDay = String(day).padStart(2, '0');
    const isBirthDateValid = year && month && paddedDay && ![year, month, paddedDay].includes('--');

    mutateCreateIdentity({
      type: type?.value,
      company_name,
      company_registration_number,
      vat_number,
      website,
      firstname,
      lastname,
      email,
      prefix: parsedNumber ? `+${parsedNumber.countryCallingCode}` : '',
      phone: parsedNumber?.nationalNumber,
      tax_id,
      id_number,
      country: country?.value,
      birth_place: birth_place?.value,
      birth_date: isBirthDateValid ? `${year}-${month?.value}-${paddedDay}` : '',
      description,
      requirements_type: requirements_type?.value,
      requirements_country,
      number_type,
    });
  });

  const { mutateAsync: mutateUploadAddressProof } = useMutation({
    mutationFn: uploadAddressProof,
  });
  const { mutate: mutateCreateAddress, isPending: isCreatingAddress } = useMutation({
    mutationFn: createAddress,
    onSuccess: async ({ data }: any) => {
      const { identity_id = '', address_id = '' } = data?.data?.result?.rows ?? {};
      const files = addressForm.getValues('addressProofs') || [];

      try {
        if (files?.some((item: any) => item?.file)) {
          const formData = new FormData();
          files.forEach((item: any) => {
            if (item?.file) {
              formData.append('identity_address_proof', item.file);
              formData.append('proof_type_id[]', item.proof_type_id?.value);
            }
          });
          formData.append('type', 'address');
          formData.append('address_id', address_id);
          formData.append('identity_id', identity_id);
          await mutateUploadAddressProof(formData);
        }
        handleAlert({ text: 'Address created successfully.', type: 'success' });
        addressForm.reset(initialState);
        setDrawerState((prev) => ({ ...prev, addNewAddress: false }));
        queryClient.invalidateQueries({ queryKey: ['getAddressesList'] });
      } catch {
        handleAlert({
          text: 'Address was created, but the proof file failed to upload.',
          type: 'error',
        });
      }
    },
    onError: (error: any) => {
      handleAlert({
        text: error?.response?.data?.message || 'Could not create this address.',
        type: 'error',
      });
    },
  });

  const submitAddress = addressForm.handleSubmit((values: any) => {
    const {
      identity_id,
      country,
      city,
      zipcode,
      address,
      address_state,
      addressProofs,
      addressDescription,
      requirements_type,
      requirements_country,
      number_type,
    } = values || {};

    mutateCreateAddress({
      identity_id: identity_id?.value,
      country: country?.value,
      city,
      zipcode,
      address,
      state: address_state,
      proofs: addressProofs,
      description: addressDescription,
      requirements_type: requirements_type?.value,
      requirements_country,
      number_type,
    });
  });

  const RenderTabComponents = {
    identities: (
      <Identities
        search={debouncedSearch}
        liveSearch={search}
        setSearch={setSearch}
        menuPortalTarget={menuPortalTarget}
      />
    ),
    addresses: (
      <Addresses
        search={debouncedSearch}
        liveSearch={search}
        setSearch={setSearch}
        menuPortalTarget={menuPortalTarget}
      />
    ),
    verifications: (
      <Verification
        search={debouncedSearch}
        liveSearch={search}
        setSearch={setSearch}
        menuPortalTarget={menuPortalTarget}
      />
    ),
  };

  const StatsRowByTab: Record<string, ReactNode> = {
    identities: <StatsRow stats={identityStats} />,
    addresses: <StatsRow stats={addressStats} />,
    verifications: <StatsRow stats={verificationStats} />,
  };

  return (
    <div
      ref={setMenuPortalTarget}
      className="ident-coral-theme flex min-h-0 w-full flex-1 flex-col"
    >
      <AdminPage
        section="Numbers"
        title="Identities & addresses"
        titleSuffix={
          <CustomTooltip
            text={PAGE_DESCRIPTION}
            side="right"
            className="w-fit max-w-[300px] whitespace-normal [text-wrap:wrap]! border-0 bg-[#fdf7f5] text-black shadow-[0_6px_20px_rgba(17,17,17,0.18)] [&_svg]:fill-[#fdf7f5]"
          >
            <Info className="h-4 w-4 text-gray-500! transition-colors hover:text-red-600! active:text-red-600! data-[state=delayed-open]:text-red-600! data-[state=instant-open]:text-red-600!" />
          </CustomTooltip>
        }
        headerTabs={
          <nav ref={tabsNavRef} className="mcm-segmented" role="group" aria-label="Numbers views">
            <span className="ident-segmented-indicator" style={tabsIndicatorStyle} aria-hidden="true" />
            {tabList.map(({ label, value }) => (
              <button
                key={value}
                type="button"
                className={activeTab === value ? 'is-active' : ''}
                onClick={() => handleTabChange(value)}
              >
                {label}
              </button>
            ))}
          </nav>
        }
        actions={
          <>
            {activeTab === 'identities' && (
              <button
                type="button"
                className="ident-pill-btn black"
                onClick={() => setDrawerState((prev) => ({ ...prev, addNewIdentity: true }))}
              >
                <Plus className="w-5 h-5 text-white" />
                Add identity
              </button>
            )}
            {activeTab === 'addresses' && (
              <button
                type="button"
                className="ident-pill-btn black"
                onClick={() => setDrawerState((prev) => ({ ...prev, addNewAddress: true }))}
              >
                <Plus className="w-5 h-5 text-white" />
                Add address
              </button>
            )}
          </>
        }
        beforeTable={StatsRowByTab[activeTab] || null}
      >
        {/* Stats render above as their own card (via `beforeTable`, outside
            `panel-card`); the view tabs live in the head bar (see
            `headerTabs`) and search now sits inside each tab's own table
            card (see `customHeader` in Identities/Addresses/Verification),
            so the table is the only content left in `panel-card` here. */}
        {RenderTabComponents[activeTab as keyof typeof RenderTabComponents]}
      </AdminPage>
      {/* Same centered-popup format as "Add Number": icon badge + red title in
          a DialogHeader, a black primary action with a trailing arrow, and a
          plain Cancel — rather than the right-edge SideDrawer these used
          before. */}
      {drawerState.addNewAddress && (
        <Dialog
          open={drawerState.addNewAddress}
          onOpenChange={(open) => !open && handleClose('addNewAddress')}
        >
          <DialogContent
            showCloseButton={false}
            onPointerDownOutside={(e) => e.preventDefault()}
            className="ident-form-popup flex max-h-[88vh] w-full flex-col gap-4 overflow-hidden p-6 sm:max-w-2xl lg:max-w-3xl"
          >
            <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0">
              <DialogTitle className="popup-title">Add Address</DialogTitle>
              <button
                type="button"
                onClick={() => handleClose('addNewAddress')}
                aria-label="Close"
                className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full text-gray-500 hover:bg-red-50 hover:text-black"
              >
                <X className="h-3 w-4" />
              </button>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
              <CreateNewAddress formInstance={addressForm} />
            </div>
            <div className="flex flex-none items-center justify-end gap-2 border-t border-gray-200 pt-3">
              <Button
                variant="outline"
                type="button"
                onClick={() => handleClose('addNewAddress')}
                className="rounded-full border-gray-300 bg-white px-5 text-black hover:bg-gray-100 hover:text-black"
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                type="button"
                disabled={isCreatingAddress}
                onClick={submitAddress}
                className="rounded-full border-black bg-black px-5 text-white hover:bg-gray-800 hover:text-white"
              >
                {isCreatingAddress && <Loader variant="blue" />}Save Address
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {drawerState.addNewIdentity && (
        <Dialog
          open={drawerState.addNewIdentity}
          onOpenChange={(open) => !open && handleClose('addNewIdentity')}
        >
          <DialogContent
            showCloseButton={false}
            onPointerDownOutside={(e) => e.preventDefault()}
            className="ident-form-popup flex max-h-[88vh] w-full flex-col gap-4 overflow-hidden p-6 sm:max-w-2xl lg:max-w-3xl"
          >
            <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0">
              <DialogTitle className="popup-title">Add Identity</DialogTitle>
              <button
                type="button"
                onClick={() => handleClose('addNewIdentity')}
                aria-label="Close"
                className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full text-gray-500 hover:bg-red-50 hover:text-black"
              >
                <X className="h-3 w-4" />
              </button>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
              <CreateIdentity formInstance={identityForm} />
            </div>
            <div className="flex flex-none items-center justify-end gap-2 border-t border-gray-200 pt-3">
              <Button
                variant="outline"
                type="button"
                onClick={() => handleClose('addNewIdentity')}
                className="rounded-full border-gray-300 bg-white px-5 text-black hover:bg-gray-100 hover:text-black"
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                type="button"
                disabled={isCreatingIdentity}
                onClick={submitIdentity}
                className="rounded-full border-black bg-black px-5 text-white hover:bg-gray-800 hover:text-white"
              >
                {isCreatingIdentity && <Loader variant="blue" />}Save Identity
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default IdentitiesAndAddressesPageLayout;
