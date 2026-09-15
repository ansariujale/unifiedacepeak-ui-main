import { useFieldArray, useFormContext } from 'react-hook-form';
import CustomSelect from '@/components/custom/custom-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUser } from '@/hooks/use-user';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { userInitialState } from '../../../constants';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getRoleList, getUserList, validateUser } from '@/services/api';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import type { ISELECTVALUE } from '@/interfaces/api-interfaces';
import { Plus, TrashBin } from '@/assets/icons';
import { useGetSite } from '@/hooks/common';
import OrderSummary from '../order-summary';
import { Label } from '@/components/ui/label';
import ErrorTooltip from '@/components/custom/error-tooltip';
import { generateRandomExtension, handleAlert } from '@/lib/utils';
import { Icon } from '@/assets/icons/icon';
import CustomTooltip from '@/components/custom/custom-tooltip';
import { Check, ChevronDown, InfoIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { COMPANY_DEFAULTS_QUERY_KEY, fetchCompanyDefaults } from '@/lib/company-defaults';
import { NEW_PERSON_ROLE_KEY, readNewPersonRole } from '@/lib/role-permission-defaults';
import {
  decideInviteRole,
  describeRole,
  roleWarning,
  toRoleChoice,
} from '@/lib/invite-role';
import {
  blocksInvite,
  clashForField,
  explainTakenEmail,
  findInviteClashes,
  summariseClashes,
} from '@/lib/invite-duplicates';

type User = typeof userInitialState;
type ValidationErrorMap = {
  [index: number]: {
    email?: string;
    phone?: string;
    extension?: string;
  };
};
/** Same normalisation invite-duplicates.ts uses for extensions — digits only. */
const normaliseExtensionDigits = (value: unknown): string =>
  String(value ?? '').replace(/\D+/g, '');

const debounce = (fn: any, delay: any) => {
  let timer: any;
  return (...args: any) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

const AddUserInfo = forwardRef(function AddUserInfo(
  {
    setIspaymentRequired,
    setOrderSummary,
    setIsUserValidatorError,
    dataGetMyPlanDetails,
    setPaymentCalculation,
  }: any,
  ref: any,
) {
  const {
    register,
    watch,
    setValue,
    control,
    trigger,
    formState: { errors },
  }: any = useFormContext<any>();
  /* Which row the form on screen is showing — a freshly appended blank one,
     or an existing row somebody opened "Edit" on. Everything else in `fields`
     renders as a compact row below instead of its own full form, and "Add
     User" (in the header) files the row on screen away into that list and
     opens a new blank one in its place. */
  const [activeIndex, setActiveIndex] = useState(0);
  const { user } = useUser();
  // const [errorType, setErrorType] = useState(null);
  // const [errIndex, setErrIndex] = useState(null);
  // const [validatorErrors, setValidatorErrors] = useState(null);

  const [validationErrors, setValidationErrors] = useState<ValidationErrorMap>({});
  const formFieldArrayInstance = useFieldArray({
    control: control,
    name: 'users',
  });

  const { data: companySiteList } = useGetSite();

  const { data: roleList = [], isPending } = useQuery({
    queryKey: ['useRolesList', false],
    queryFn: () => getRoleList(),
    select: (data) => data?.data?.data?.result?.rows || [],
  });

  /* The role a new person should start on, if the company has chosen one under
     Admin > People > Default permissions. Without it this box opens empty and
     whoever is adding somebody has to remember which of the roles is right. */
  const { data: companyDefaults } = useQuery({
    queryKey: COMPANY_DEFAULTS_QUERY_KEY,
    queryFn: fetchCompanyDefaults,
  });
  const defaultRoleId = readNewPersonRole(
    (companyDefaults as any)?.settings?.[NEW_PERSON_ROLE_KEY],
  );

  /* Everybody already on the account, read under the key the People page
     already uses so opening this form from there costs nothing extra.
     It is what lets a clash say "Amara Osei, at London" instead of the
     platform's four words, "Email already exists!". */
  const { data: roster = [] } = useQuery({
    queryKey: ['directoryPeople'],
    queryFn: () => getUserList({ page: 1, limit: 500 }),
    select: (res: any) => res?.data?.data?.result?.rows || [],
  });

  /* Which role a new person starts on, and why that one. The company's own
     answer wins; with no answer the narrowest role on the account is used, and
     an administrator is never chosen for somebody automatically. The reasoning
     and its tests live in lib/invite-role.ts, so this form and the Default
     permissions screen cannot drift apart. */
  const roleDecision = useMemo(
    () => decideInviteRole({ savedRoleId: defaultRoleId, roles: roleList }),
    [defaultRoleId, roleList],
  );

  /* Which rows have already been offered that answer, held by the row's own id
     rather than its position — removing the first row renumbers every other
     one, and a set of positions would then re-fill a row somebody had
     deliberately cleared. A row is filled in once and never again. */
  const seededRows = useRef<Set<string>>(new Set());

  const { fields, append, remove } = formFieldArrayInstance;

  const users = watch('users') as User[];

  useEffect(() => {
    const picked = roleDecision.role;
    if (!picked || !Array.isArray(users)) return;

    fields.forEach((field: any, index: number) => {
      const rowId = String(field?.id || index);
      if (seededRows.current.has(rowId)) return;
      seededRows.current.add(rowId);
      // Never overwrite a row somebody has already answered.
      if ((users as any[])[index]?.role?.value) return;

      setValue(`users.${index}.role`, { label: picked.name, value: picked.id });
      setValue(`users.${index}.role_uuid`, picked.custom ? '' : picked.id);
      setValue(`users.${index}.custom_role_uuid`, picked.custom ? picked.id : '');
    });
  }, [roleDecision, fields, users, setValue]);

  /* The role showing on one row right now, whether it was filled in for the
     admin or picked by hand. Used to say underneath what that role actually
     allows, because the names alone do not. */
  const chosenRoleOf = (index: number) => {
    const value = (users as any[])?.[index]?.role?.value;
    if (!value) return null;
    return toRoleChoice(
      roleList.find((item: any) => (item?.type === 'custom' ? item?.uuid : item?.role_uuid) === value),
    );
  };

  /* The same person typed twice, or somebody who is already here. The platform
     cannot find either — two unsaved rows are not "taken" yet, and its check
     spans every company it hosts rather than just this one. */
  const clashes = useMemo(() => findInviteClashes({ rows: users, roster }), [users, roster]);
  const { plan_info, user_info = {}, company_info } = user || {};
  const isPlanExpired = company_info?.plan_status === 'EXPIRED';
  const isTrial = company_info?.is_trial === 'Y';

  const planCost = dataGetMyPlanDetails?.current_plan_details?.discount_enabled
    ? dataGetMyPlanDetails?.current_plan_details?.discount_price || 0
    : dataGetMyPlanDetails?.current_plan_details?.original_price || 0;

  const licenseInfo = useMemo(() => {
    const licenseDetail = dataGetMyPlanDetails?.license_detail || {};

    /* What this screen used to show on its own: spare licences + licences freed
       by revoked users. */
    const reportedFree =
      (licenseDetail?.free_licenses || 0) + (licenseDetail?.free_revoked_licenses || 0);

    /* What the API actually enforces when it decides whether to charge:
       licences owned minus licences already in use. If either field is missing
       we fall back to the old number rather than guess. */
    const totalLicenses = Number(licenseDetail?.total_licenses);
    const usedLicenses = Number(licenseDetail?.used_licenses);
    const enforcedFree =
      Number.isFinite(totalLicenses) && Number.isFinite(usedLicenses)
        ? Math.max(0, totalLicenses - usedLicenses)
        : null;

    /* Trust the smaller of the two. Promising a free seat the API then refuses
       to create is what dead-ends the admin, so we would rather show the
       payment step they can actually complete. */
    const available = enforcedFree === null ? reportedFree : Math.min(reportedFree, enforcedFree);
    const hasLicenseMismatch = enforcedFree !== null && enforcedFree !== reportedFree;

    const currentUserCount = users?.length || 0;
    const extraUnits = Math.max(0, currentUserCount - available);

    const extraCharge = extraUnits > 0;
    const cost = extraUnits * planCost;

    return {
      available,
      reportedFree,
      enforcedFree,
      hasLicenseMismatch,
      currentUserCount,
      extraUnits,
      extraCharge,
      cost,
    };
  }, [users, dataGetMyPlanDetails, planCost]);
  const { mutate: mutateValidateUser } = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mutationFn: ({ index, ...payload }: any) => validateUser(payload),

    onSuccess: (_, variables) => {
      const { index, type } = variables;

      setValidationErrors((prev) => ({
        ...prev,
        [index]: {
          ...prev[index],
          [type]: undefined,
        },
      }));
    },

    onError: (err: any, variables) => {
      const { index, type } = variables;
      const errMsg = err?.response?.data?.message;

      setValidationErrors((prev) => ({
        ...prev,
        [index]: {
          ...prev[index],
          [type]: errMsg,
        },
      }));
    },
  });

  /* Whether the platform has rejected anything still on the form.
     It used to be set straight from each reply, which meant a successful check
     on row two's phone cleared the flag row one's rejected email had raised —
     and the Continue button came back on with a known-bad row on screen. Read
     from the errors themselves and that cannot happen: the flag is true exactly
     while a rejection is showing. */
  const apiRejected = useMemo(
    () =>
      Object.values(validationErrors).some(
        (row: any) => row && Object.values(row).some((message) => Boolean(message)),
      ),
    [validationErrors],
  );

  /* Continue is off while anything on this form would be refused — by the
     platform, or by the duplicate checks it cannot make. */
  useEffect(() => {
    setIsUserValidatorError(apiRejected || blocksInvite(clashes));
  }, [apiRejected, clashes, setIsUserValidatorError]);

  /* What to show under a field, worst first: a clash we can explain properly
     beats the platform's wording, and the platform's wording beats nothing.
     "Email already exists!" is turned into a sentence naming the colleague, or
     saying plainly that the address belongs outside this company — which the
     platform's own answer never distinguishes. */
  const emailProblem = (index: number) => {
    const clash = clashForField(clashes, index, 'email');
    if (clash) return clash.message;
    const fromApi = validationErrors?.[index]?.email;
    if (fromApi) {
      return /already exists/i.test(String(fromApi))
        ? explainTakenEmail((users as any[])?.[index]?.email, roster) || fromApi
        : fromApi;
    }
    return errors?.users?.[index]?.email?.message;
  };

  const extensionProblem = (index: number) =>
    clashForField(clashes, index, 'extension')?.message ||
    errors?.users?.[index]?.extension?.message ||
    validationErrors?.[index]?.extension;

  // const { mutate: mutateValidateUser } = useMutation({
  //   mutationFn: validateUser,
  //   onSuccess: () => {
  //     setErrorType(null);
  //     setErrIndex(null);
  //     setIsUserValidatorError(false);
  //     setValidatorErrors(null);
  //   },
  //   onError: (err: any) => {
  //     const errMsg = err?.response?.data?.message;
  //     setIsUserValidatorError(true);
  //     setValidatorErrors(errMsg);
  //   },
  // });

  // const useDebouncedValidateUser = (mutateValidateUser: any, delay = 500) => {
  //   return useCallback(
  //     debounce((value: any, index: any) => {
  //       setErrIndex(index);
  //       setErrorType(value?.type);
  //       mutateValidateUser({ ...value });
  //     }, delay),
  //     [mutateValidateUser, delay],
  //   );
  // };
  // const handleValidateUser = useDebouncedValidateUser(mutateValidateUser);

  const useDebouncedValidateUser = (mutateFn: any, delay = 500) => {
    return useCallback(
      debounce((value: any, index: number) => {
        mutateFn({ ...value, index });
      }, delay),
      [mutateFn, delay],
    );
  };

  const handleValidateUser = useDebouncedValidateUser(mutateValidateUser);

  const MAX_USERS = 10;

  /* One row per click — the quantity box this used to read from is gone, so
     this simply adds a single row, still behind the same plan/trial/licence
     guards as before. Files the row currently on screen away (it stays in
     `users`, so it is still submitted either way) and opens a fresh blank
     row in its place. */
  const handleAddUser = async () => {
    if (isPlanExpired) {
      handleAlert({
        text: 'You cannot add users until your subscription is renewed.',
        type: 'error',
      });
      return;
    }

    if (isTrial) {
      handleAlert({
        text: 'This feature is not available in your current plan. Please upgrade',
        type: 'error',
      });
      return;
    }

    const currentCount = users?.length;

    const availableLicensesToPurchase =
      plan_info?.dataValues?.licenses !== 0
        ? (plan_info?.dataValues?.licenses || 0) -
          (dataGetMyPlanDetails?.license_detail?.total_licenses || 0)
        : 'Unlimited';

    const maxAllowed =
      availableLicensesToPurchase !== 'Unlimited'
        ? Math.min(MAX_USERS, availableLicensesToPurchase)
        : MAX_USERS;

    if (currentCount >= maxAllowed) {
      handleAlert({
        text:
          availableLicensesToPurchase !== 'Unlimited' && currentCount >= availableLicensesToPurchase
            ? `You have reached the maximum limit of available licenses.`
            : `Maximum of 10 users can be added at once.`,
        type: 'warning',
      });
      return;
    }

    const isRowValid = await trigger(`users.${activeIndex}`);
    if (!isRowValid) return;

    append({ ...userInitialState });
    setActiveIndex(currentCount);
  };

  /* Opens an already-added row back up in the form instead of its row below. */
  const handleEditRow = (index: number) => setActiveIndex(index);

  /* Removing a row above the one on screen shifts every later index down by
     one — following that shift here is what keeps the open form pointed at
     the same row instead of silently jumping to whatever now sits at its old
     index. */
  const handleDeleteRow = (index: number) => {
    remove(index);
    setActiveIndex((prev) => (prev > index ? prev - 1 : prev));
  };

  /* Called from the wizard's own "Save & Continue" before it submits. A
     trailing row nobody has touched (opened by "Add User" for a second person
     who was then never filled in) has to go through `remove` here rather than
     a plain `setValue` in the parent — react-hook-form keeps a ref registry
     for uncontrolled inputs per array index, and shrinking the array any other
     way leaves it out of sync, so the next row appended at that same index can
     silently inherit the previous row's stale field values (passwords
     included) instead of starting blank. */
  useImperativeHandle(ref, () => ({
    pruneTrailingBlankRow: () => {
      const lastIndex = fields.length - 1;
      if (lastIndex <= 0) return;
      const lastRow = users?.[lastIndex];
      const isUntouched =
        !lastRow?.first_name && !lastRow?.last_name && !lastRow?.email && !lastRow?.phone;
      if (!isUntouched) return;
      remove(lastIndex);
      setActiveIndex((prev) => (prev >= lastIndex ? lastIndex - 1 : prev));
    },
  }));

  // const handleAddUser = () => {
  //   const count = Math.min(userAddCount, 10 - users.length);

  //   if (count <= 0) return;

  //   for (let i = 0; i < count; i++) {
  //     append({ ...userInitialState });
  //   }
  //   setValue('user_add_count', '');
  // };

  /* A pure-random draw collided with an already-taken extension often enough
     to leave the form silently blocked (Save & Continue disabled, only a
     small red flag on the field to say why) the moment it opened. Retries
     against both the roster and this batch's other rows until it lands on
     one that's actually free, so the auto-filled value doesn't start the
     form in a broken state. */
  const generateNewExtension = (index: number) => {
    const takenByRoster = new Set(
      (roster as any[])
        .map((person) => normaliseExtensionDigits(person?.extension))
        .filter(Boolean),
    );
    const takenInBatch = new Set(
      (users || [])
        .map((u, i) => (i === index ? '' : normaliseExtensionDigits(u?.extension)))
        .filter(Boolean),
    );

    let newExtension = generateRandomExtension();
    let attempts = 0;
    while (
      (takenByRoster.has(newExtension) || takenInBatch.has(newExtension)) &&
      attempts < 25
    ) {
      newExtension = generateRandomExtension();
      attempts += 1;
    }

    setValue(`users.[${index}].extension`, newExtension, { shouldValidate: true });
    handleValidateUser({ value: newExtension, type: 'extension' }, index);
  };

  useEffect(() => {
    if (user_info) {
      const obj = {
        label: user_info?.site_detail?.name,
        value: user_info?.site_uuid,
      };
      setValue('site', obj);
    }
  }, [user_info]);

  useEffect(() => {
    setIspaymentRequired(licenseInfo.extraCharge);
  }, [licenseInfo.extraCharge]);

  useEffect(() => {
    setOrderSummary({
      watchUserLength: users.length,
      availableLicenses: licenseInfo?.available,
      totalPayableUnit: licenseInfo?.extraUnits,
    });
  }, [users.length, licenseInfo?.available, licenseInfo?.extraUnits]);

  useEffect(() => {
    fields.forEach((_, index) => {
      if (!watch(`users.[${index}].extension`)) {
        generateNewExtension(index);
      }
    });
  }, [fields?.length]);

  return (
    <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
      <div className="flex flex-col gap-1 mt-1 pr-0 md:pr-3">
        <div className="ppl-invite-actions flex flex-wrap items-center justify-end gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant={'outline'} size={'sm'} type="button" className="ppl-invite-btn">
                Branches
                <ChevronDown size={14} className="text-gray-700" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border-transparent">
              {companySiteList?.map((site: { name: string; uuid: string }) => (
                <DropdownMenuItem
                  key={site.uuid}
                  className="ppl-row-menu-item justify-between"
                  onSelect={() =>
                    setValue(
                      'site',
                      { label: site.name, value: site.uuid },
                      { shouldValidate: true },
                    )
                  }
                >
                  {site.name}
                  {watch('site')?.value === site.uuid ? <Check size={14} /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {errors?.site?.value?.message ? (
            <ErrorTooltip text={errors?.site?.value?.message} />
          ) : null}
        </div>

        {/* {licenseInfo.extraCharge && (
        <p className="text-grey-700 text-center text-sm">
          Additional licenses to purchase: {licenseInfo.extraUnits}
        </p>
      )} */}
        <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-transparent bg-white p-2 shadow-sm">
            <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-gray-500">
              Available to purchase
            </div>
            <div className="mt-0.5 text-lg font-bold leading-none text-gray-900">
              {plan_info?.dataValues?.licenses !== 0
                ? plan_info?.dataValues?.licenses -
                  dataGetMyPlanDetails?.license_detail?.total_licenses
                : 'Unlimited'}
            </div>
          </div>
          <div className="rounded-lg border border-transparent bg-white p-2 shadow-sm">
            <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-gray-500">
              Unused licenses
              <CustomTooltip text="License purchased" side="right">
                <InfoIcon className="w-3 h-3 text-gray-500 cursor-pointer" />
              </CustomTooltip>
            </div>
            <div className="mt-0.5 text-lg font-bold leading-none text-gray-900">
              {licenseInfo?.available || 0}
            </div>
          </div>
          <div className="rounded-lg border border-transparent bg-white p-2 shadow-sm">
            <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-gray-500">
              New licenses purchased
            </div>
            <div className="mt-0.5 text-lg font-bold leading-none text-gray-900">
              {licenseInfo?.extraUnits || 0}
            </div>
          </div>
        </div>
        {licenseInfo?.hasLicenseMismatch ? (
          <p className="text-amber-600 text-center text-xs">
            Your plan lists {licenseInfo?.reportedFree} unused licence
            {licenseInfo?.reportedFree === 1 ? '' : 's'}, but billing can only confirm{' '}
            {licenseInfo?.enforcedFree}. We use the lower number so you are not blocked at checkout.
          </p>
        ) : null}

        {/* Which role everybody on this form starts on, and why that one. Said
            once at the top rather than repeated on every row: it is the same
            answer for all of them, and it is a company-wide setting somebody
            can go and change. */}
        {roleDecision.reason ? (
          <p className="mx-auto mt-3 flex max-w-3xl items-center justify-center gap-1 text-center text-xs text-gray-600">
            {roleDecision.role ? (
              <>
                Starting role: <strong>&ldquo;{roleDecision.role.name}&rdquo;</strong>
              </>
            ) : (
              'Starting role not set'
            )}
            <CustomTooltip
              text={roleDecision.reason}
              side="right"
              className="max-w-[240px] whitespace-normal text-left leading-snug"
            >
              <InfoIcon className="w-3.5 h-3.5 text-gray-500 cursor-pointer" />
            </CustomTooltip>
          </p>
        ) : null}
        {roleDecision.warning ? (
          <p className="mx-auto max-w-3xl text-center text-xs font-medium text-amber-600">
            {roleDecision.warning}
          </p>
        ) : null}

        {/* One line saying what is wrong with the list as a whole, so somebody
            scrolling ten rows knows there is something to find. */}
        {clashes.length ? (
          <p
            role="status"
            className="mx-auto mt-2 max-w-3xl rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-800"
          >
            {summariseClashes(clashes)}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col my-2 gap-3 pr-0 md:pr-3 lg:gap-2">
        {/* The one open form — a fresh blank row, or whichever row "Edit"
            below was clicked on. */}
        <div
          key={activeIndex}
          className="mcm-invitee grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-3 md:grid-cols-2 xl:grid-cols-3"
        >
          <div className="w-full">
            <Input
              label="First Name"
              type="text"
              placeholder="First Name"
              {...register(`users.${activeIndex}.first_name`)}
              error={errors?.users?.[activeIndex]?.first_name?.message}
              maxLength={50}
            />
          </div>
          <div className="w-full">
            <Input
              label="Last Name"
              type="text"
              placeholder="Last Name"
              {...register(`users.${activeIndex}.last_name`)}
              error={errors?.users?.[activeIndex]?.last_name?.message}
              maxLength={50}
            />
          </div>
          <div className="w-full">
            <Input
              label="Email"
              type="email"
              placeholder="Email"
              {...register(`users.${activeIndex}.email`)}
              error={emailProblem(activeIndex)}
              onChange={(e) => {
                const value = e.target.value;
                setValue(`users.[${activeIndex}].email`, value, {
                  shouldValidate: true,
                });
                handleValidateUser({ value, type: 'email' }, activeIndex);
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5 w-full">
            <Label>Phone</Label>
            <div className="flex w-full gap-1">
              <PhoneInput
                country={'us'}
                value={watch(`users.${activeIndex}.phone`)}
                onChange={(value) => {
                  setValue(`users.[${activeIndex}].phone`, value, {
                    shouldValidate: true,
                  });
                  handleValidateUser({ value, type: 'phone' }, activeIndex);
                }}
                containerClass={`w-full ${errors?.users?.[activeIndex]?.phone?.message ? 'phone-error' : ''}`}
                enableSearch={true}
              />
            </div>
          </div>

          <div className="w-full">
            <CustomSelect
              label="Role"
              value={watch(`users.${activeIndex}.role`)}
              options={roleList.map(
                (role: { name: string; role_uuid: string; type: string; uuid: string }) => ({
                  label: role?.name,
                  value: role?.type === 'custom' ? role?.uuid : role?.role_uuid,
                }),
              )}
              handleChange={(e: ISELECTVALUE | null) => {
                setValue(`users.${activeIndex}.role`, e || { label: '', value: '' }, {
                  shouldValidate: true,
                });
                /* Branch on the role's `type`, not on its display name: a custom
                   role may legitimately be called "ADMIN", and the old test
                   would then have written it into role_uuid. Both fields are
                   set every time — one to the id, the other cleared — because
                   leaving the previous one behind meant switching from a custom
                   role back to a system role silently kept the custom role, the
                   backend checking custom_role_uuid first. */
                const picked = roleList.find(
                  (item: any) =>
                    (item?.type === 'custom' ? item?.uuid : item?.role_uuid) === e?.value,
                );
                const isCustomRole = picked?.type === 'custom';
                setValue(`users.${activeIndex}.role_uuid`, isCustomRole ? '' : e?.value || '', {
                  shouldValidate: true,
                });
                setValue(
                  `users.${activeIndex}.custom_role_uuid`,
                  isCustomRole ? e?.value || '' : '',
                  { shouldValidate: true },
                );
              }}
              error={errors?.users?.[activeIndex]?.role?.value?.message}
              isLoading={isPending}
              /* Rendered inline rather than portaled to <body> — a portaled
                 menu can't inherit this page's red accent (its own scoped
                 colour vars don't reach across the portal boundary), so it
                 would always show the platform's default blue no matter
                 what --primary is set to here. */
              menuPortalTarget={false}
            />
          </div>

          <div className="flex w-full items-end gap-2">
            <div className="w-full">
              <Input
                label="Extension"
                type="text"
                placeholder="Extension"
                value={watch(`users.[${activeIndex}].extension`)}
                error={extensionProblem(activeIndex)}
                onChange={(e) => {
                  const value = e.target.value;
                  setValue(`users.[${activeIndex}].extension`, value, {
                    shouldValidate: true,
                  });
                  handleValidateUser({ value, type: 'extension' }, activeIndex);
                }}
                maxLength={5}
              />
            </div>
            <Button
              type="button"
              variant={'outline'}
              className="h-10 w-10 shrink-0 rounded-full border-0 bg-[#f5f5f5] text-[#171717] hover:bg-[#fef2f2] hover:text-[#dc2626]"
              onClick={() => generateNewExtension(activeIndex)}
            >
              <Icon name="Refresh" className="w-5 h-5" />
            </Button>
          </div>

          <div className="ppl-invite-actions col-span-2 flex flex-wrap items-center justify-end gap-2 xl:col-span-3">
            <Button
              variant={'outline'}
              size={'sm'}
              type="button"
              className="ppl-invite-btn"
              onClick={handleAddUser}
            >
              <Plus className="w-3 h-3 text-gray-700" />
              Add User
            </Button>
          </div>

          {/* What that role actually allows. The names the platform ships
              with — AGENT, MANAGER, SUB-ADMIN — do not say, and the
              permissions behind them barely differ, so the box on its own is
              a guess dressed up as a decision. The words come from the same
              place the Default permissions screen reads them, so the two
              screens describe a role identically. Spans the full row (not
              just the Role column) and stays on one line. */}
          {(() => {
            const chosen = chosenRoleOf(activeIndex);
            if (!chosen) return null;
            const caution = roleWarning(chosen);
            const description = describeRole(chosen);
            return (
              <p
                className={`ppl-role-note col-span-2 truncate text-[10px] leading-snug ${caution ? 'font-medium text-amber-600' : 'text-gray-500'}`}
              >
                {caution || description}
              </p>
            );
          })()}
        </div>

        {/* Everyone already filed away — added via "Add User" above, or
            sitting here since the form opened on a fresh blank row. */}
        {fields.length > 1 ? (
          <div className="flex flex-col gap-2">
            {fields.map((field: any, index: number) => {
              if (index === activeIndex) return null;
              const rowUser = users?.[index] || {};
              const fullName =
                [rowUser?.first_name, rowUser?.last_name].filter(Boolean).join(' ') ||
                'Unnamed person';
              return (
                <div
                  key={field.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3"
                >
                  <div className="min-w-0 flex-1 basis-40">
                    <div className="truncate text-sm font-semibold text-gray-900">{fullName}</div>
                    <div className="truncate text-xs text-gray-500">
                      {rowUser?.email || 'No email'}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 basis-32 text-xs text-gray-600">
                    {rowUser?.phone ? `+${rowUser.phone}` : '—'}
                  </div>
                  <div className="min-w-0 flex-1 basis-28 text-xs text-gray-600">
                    {rowUser?.role?.label || '—'}
                  </div>
                  <div className="min-w-0 basis-20 text-xs text-gray-600">
                    Ext {rowUser?.extension || '—'}
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      title="Edit"
                      aria-label={`Edit ${fullName}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                      onClick={() => handleEditRow(index)}
                    >
                      <Icon name="EditIcon" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      aria-label={`Delete ${fullName}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-500 hover:bg-red-500 hover:text-white"
                      onClick={() => handleDeleteRow(index)}
                    >
                      <TrashBin className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {licenseInfo.extraCharge ? (
        <OrderSummary
          customClass="w-full"
          orderSummary={{
            watchUserLength: users?.length,
            availableLicenses: licenseInfo?.available,
            totalPayableUnit: licenseInfo?.extraUnits,
          }}
          dataGetMyPlanDetails={dataGetMyPlanDetails}
          onCalculationChange={setPaymentCalculation}
        />
      ) : null}
    </div>
  );
});

export default AddUserInfo;
