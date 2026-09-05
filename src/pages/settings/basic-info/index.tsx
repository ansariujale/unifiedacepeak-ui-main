import FileCropper from '@/components/custom/file-cropper';
import Loader from '@/components/custom/loader';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Info, Lock } from 'lucide-react';
import { useCompanyFeatures } from '@/hooks/rbac';
import { requiredString } from '@/lib/schema';
import { Icon } from '@/assets/icons/icon';
import { handleAlert, MAX_FILE_SIZE, validateFileSize } from '@/lib/utils';
import { invalidateGlobalUsersDirectory } from '@/lib/invalidate-global-users-directory';
import { basicInitialState } from '@/pages/admin-settings/constants';
import BasicInformation from '@/pages/admin-settings/people/update-forwarding/basic-information';
import '@/components/mcm/mcm-page.css';
import { getUserDetails, mediaUploadUrl, userProfileUpdate } from '@/services/api';
import { yupResolver } from '@hookform/resolvers/yup';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as yup from 'yup';
import CustomAvatar from '@/components/custom/custom-avatar';
import CallSetupGuide from './call-setup-guide';
import { buildProfileUpdatePayload } from './profile-update-payload';

export const BasicInfoSettingSchema = yup.object().shape({
  basic: yup.object().shape({
    first_name: requiredString('First name', 2, 50),
    last_name: requiredString('Last name', 2, 50),
  }),
});

const BasicInfoSettings = () => {
  const [image, setImage] = useState<any>(null);
  const [fileName, setFileName] = useState<any>(null);
  const [modalState, setModalState] = useState(false);
  const [loader, setLoader] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isImageRemoved, setIsImageRemoved] = useState(false);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  /* First Name / Last Name / Job Title are read-only until "Edit Profile"
     is clicked, then editable with Save/Cancel in its place. */
  const [isEditing, setIsEditing] = useState(false);
  const cropperUploadRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient: any = useQueryClient();
  /* Surfaces the page's info tooltip on its own, briefly, on first load — a
     hint that it's there before anyone has thought to hover it. Controlled
     for the reveal only: once the timer clears, `open` goes back to
     `undefined` and Radix reverts to its normal hover/focus behaviour. */
  const [showHeaderHint, setShowHeaderHint] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setShowHeaderHint(false), 700);
    return () => clearTimeout(timer);
  }, []);
  const { features } = useCompanyFeatures();
  const basicInfoAccess =
    features?.plan_features?.account_setting?.USER?.action ||
    features?.plan_features?.account_setting?.access?.USER?.action;

  const methods = useForm<any>({
    mode: 'all',
    defaultValues: { basic: basicInitialState },
    resolver: yupResolver(BasicInfoSettingSchema),
  });

  const {
    handleSubmit,
    setValue,
    watch,
    formState: { isDirty },
  } = methods;

  const { data: userInfoData, isPending: PendingUserData } = useQuery({
    queryKey: ['getUserDetailsQueryFn'],
    queryFn: getUserDetails,
    select: (data) => data?.data?.data?.result,
  });

  const { mutate: mutateProfileUpdate, isPending: PendingProfileUpdate } = useMutation({
    mutationFn: userProfileUpdate,
    onSuccess: (data: any) => {
      handleAlert({
        text: data?.data?.message || 'Profile updated successfully!',
        type: 'success',
      });
      queryClient.invalidateQueries(['getUsersDetails', 'getUserDetailsQueryFn'], {
        exact: true,
      });
      invalidateGlobalUsersDirectory(queryClient);
      setLoader(false);
      setIsEditing(false);
    },
  });

  const handleChangeFile = (e: any) => {
    const file = e.target?.files?.[0];
    const fileSizeValid = validateFileSize(MAX_FILE_SIZE, file);
    if (!fileSizeValid) return;
    if (!file) return alert('something went wrong');
    if (!file?.type.startsWith('image/')) {
      return handleAlert({
        text: 'File type is invalid. Only jpg, jpeg and png file types are accepted.',
        type: 'error',
      });
    }
    setFileName(file?.name);
    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result);
      setLoader(false);
    };
    reader.readAsDataURL(e.target.files[0]);
    setModalState(true);
  };
  const { mutateAsync: uploadMediaMutate, isPending: uploadMediaLoad } = useMutation({
    mutationFn: mediaUploadUrl,
  });

  const handleUpload = async () => {
    if (loader) return;
    if (!cropperUploadRef?.current) return;
    const blobUrl = cropperUploadRef?.current?.getCropData();
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    const file = new File([blob], fileName, { type: blob.type });

    setImagePreview(blobUrl);
    if (file) {
      try {
        const uploadMediaResponse = await uploadMediaMutate({
          uuid: userInfoData?.company_info?.uuid,
          type: 'profile',
          file_name: file?.name,
        });
        const result = uploadMediaResponse?.data?.data?.result;
        if (result?.file_name && result?.url) {
          setLoader(true);
          const { url = '', file_name = '' } = result || {};
          const uploadFileResponse = await fetch(url, {
            method: 'PUT',
            body: file,
          });
          if (uploadFileResponse.status === 200) {
            setValue('profile', file_name);
            /* A new picture undoes an earlier removal in the same session —
               without this the save would still send the removal. */
            setIsImageRemoved(false);
            setModalState(false);
          }
        }
      } catch (error) {
        console.log(error);
        setLoader(false);
      }
    }
  };

  const onSubmit = () => {
    mutateProfileUpdate(
      buildProfileUpdatePayload({
        userInfoData,
        basic: {
          first_name: watch('basic.first_name'),
          last_name: watch('basic.last_name'),
          job_title: watch('basic.job_title'),
        },
        uploadedProfile: watch('profile'),
        isImageRemoved,
      }),
    );
  };

  const handleCancelEdit = () => {
    const user = userInfoData?.user_info;
    if (user) {
      setValue('basic.first_name', user.first_name || '');
      setValue('basic.last_name', user.last_name || '');
      setValue('basic.job_title', user.job_title || '');
    }
    setIsEditing(false);
  };

  useEffect(() => {
    if (userInfoData?.user_info) {
      const user = userInfoData?.user_info;
      setValue('basic', {
        email: user.email || '',
        site: {
          label: user.site_detail?.name || 'Select',
          value: user.site_uuid || '',
        },
        extension: user.extension,
        phone: user.phone,
        caller_id: user.caller_id,
        job_title: user.job_title,
        first_name: user.first_name,
        last_name: user.last_name,
        profile: user.profile,
      });

      setIsImageRemoved(false);
    }
  }, [userInfoData]);

  const userInfo = userInfoData?.user_info;
  const fullName = `${userInfo?.first_name || ''} ${userInfo?.last_name || ''}`.trim();

  return (
    <>
      <section className="acepeak-profile flex h-full w-full flex-col overflow-hidden bg-[#efefef]">
        {/* Brand tokens and the fixes this page needs — a clean neutral border on
            the form fields instead of the app-wide primary-colour focus ring,
            no shadows, no gradients, and headings that read as this app's own
            rather than the shared console's. Scoped to this page so nothing
            else in the app is affected. */}
        <style>{`
          .acepeak-profile {
            font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
            --ap-primary: #DC2626;
            --ap-primary-hover: #B91C1C;
            --ap-secondary: #EF4444;
            --ap-secondary-2: #F87171;
            --ap-soft-bg: #FFF1F2;
          }
          .acepeak-profile .mcm-page {
            --accent: var(--ap-primary);
            --accent-ink: var(--ap-primary-hover);
            --accent-wash: var(--ap-soft-bg);
            --accent-edge: #FCA5A5;
            --sans: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
          }
          .acepeak-profile .acepeak-heading,
          .acepeak-profile .mcm-fsec-t,
          .acepeak-profile .mcm-setupguide h2 {
            color: #000;
            font-style: normal;
            font-weight: 700;
          }
          /* The page's own main heading only — not .acepeak-heading above,
             which this page also puts on the person's name in the avatar
             block; that one keeps its own look untouched. */
          .acepeak-profile .acepeak-page-title {
            font-family: 'Instrument Serif', serif;
            font-style: italic;
            font-weight: 400;
            font-size: 27px;
            line-height: 41px;
            color: #171717;
          }
          /* Info-tooltip popovers on this page. Rendered through a portal, so
             they land outside .acepeak-profile in the real DOM — this class is
             what reaches them instead of ancestor scoping. Unique enough to the
             page's own markup that it never matches a tooltip anywhere else.
             Capped to a narrow column so the description wraps into a short
             paragraph (a handful of words per line) instead of one long row. */
          .acepeak-tooltip-content {
            background: #fdf7f5 !important;
            color: #000 !important;
            border: none !important;
            width: max-content !important;
            max-width: 340px !important;
            white-space: normal !important;
            line-height: 1.5 !important;
            box-shadow: 0 6px 20px rgba(17, 17, 17, 0.18) !important;
          }
          .acepeak-tooltip-content svg {
            fill: #fdf7f5 !important;
          }
          /* The photo menu is also portaled outside .acepeak-profile — same
             reason the tooltip needs its own class rather than ancestor
             scoping. Flattened to match the page's no-shadow chrome. */
          .acepeak-popover-content {
            box-shadow: none !important;
            border-color: #E5E7EB !important;
            border-radius: 10px !important;
          }
          /* No shadows on this page's own chrome. Scoped to elements rather
             than a blanket '*' rule so it cannot strip a sprite background
             (e.g. the disabled phone field's flag icon) along with it. */
          .acepeak-profile,
          .acepeak-profile [data-slot='input'],
          .acepeak-profile [data-slot='button'],
          .acepeak-profile .mcm-fsec,
          .acepeak-profile .rounded-xl,
          .acepeak-profile .rounded-lg {
            box-shadow: none !important;
          }
          /* Identity / Workplace / Contact get a very light gray fill so they
             read as distinct cards against the page, while the fields inside
             them (below) stay white so they don't blend into it. */
          .acepeak-profile .mcm-fsec {
            background: #F8F9FA !important;
          }
          /* The Location field is read-only on this page, and the shared
             stylesheet's disabled-select gray is close enough to the card's
             own light gray to lose its edge — kept white so it still reads
             as a distinct field, matching the other read-only inputs. */
          .acepeak-profile .custom-react-select__control--is-disabled {
            background-color: #fff !important;
          }
          /* Neutral borders on the editable text fields — no colour shift on
             hover or focus. */
          .acepeak-profile [data-slot='input']:not(:disabled) {
            border-color: #D1D5DB !important;
          }
          .acepeak-profile [data-slot='input']:not(:disabled):hover,
          .acepeak-profile [data-slot='input']:not(:disabled):focus {
            border-color: #9CA3AF !important;
            outline: none !important;
          }
          /* Each label+field pair sits in a ".mcm-field" wrapper that is meant
             to be a plain flex column, but the same class name is also a
             standalone "bordered settings box" utility elsewhere in the shared
             stylesheet — its border/padding/hover-accent bleed onto this
             wrapper too, drawing a second box (gray, red on hover) around the
             label and field together. Zeroed out here for just this page. */
          .acepeak-profile .mcm-fgrid > .mcm-field {
            border: none !important;
            padding: 0 !important;
            min-height: 0 !important;
            background: transparent !important;
          }
          .acepeak-profile .mcm-fgrid > .mcm-field:hover,
          .acepeak-profile .mcm-fgrid > .mcm-field:focus-visible,
          .acepeak-profile .mcm-fgrid > .mcm-field:focus-within {
            border-color: transparent !important;
            outline: none !important;
          }
          /* First Name / Last Name / Job Title get their label from the
             shared Input component, which styles it with its own default
             (14px, medium weight, dark). Location / Extension / Phone / Email
             build their label by hand inside ".mcm-field-h", which the shared
             stylesheet styles differently (12px, bold, ink-2) — the mismatch
             the two field styles above made visible. Matched here so every
             field label in this form reads the same. */
          .acepeak-profile .mcm-fgrid [data-slot='label'] {
            font-size: 12px;
            font-weight: 700;
            color: var(--ink-2, #3d4a63);
          }
          .acepeak-profile .acepeak-info-trigger:hover {
            color: var(--ap-primary);
          }
          /* The avatar's edit badge rides the app-wide tenant accent
             (--primary, set per-tenant); pinned to the brand red instead so
             it doesn't drift with whatever colour the tenant happens to be
             branded. */
          .acepeak-profile .bg-primary {
            background-color: var(--ap-primary) !important;
          }
          /* The Save action stays black; the brand red is reserved for
             accents. Targeted by its own class rather than [type='submit']
             since it now lives outside the <form>, beside Edit Profile. */
          .acepeak-profile .acepeak-save-btn {
            background: #000 !important;
            border-color: #000 !important;
            color: #fff !important;
          }
          .acepeak-profile .acepeak-save-btn:hover {
            background: #1a1a1a !important;
            border-color: #1a1a1a !important;
          }
          .acepeak-profile .acepeak-edit-btn {
            background: #171717 !important;
            border-color: #171717 !important;
            color: #FFFFFF !important;
          }
          .acepeak-profile .acepeak-edit-btn:hover {
            background: #2b2b2b !important;
            border-color: #2b2b2b !important;
          }
          /* Edit Profile / Save / Cancel read smaller and squarer than the
             app's default "sm" button. */
          .acepeak-profile .acepeak-profile-actionbtn {
            font-size: 11.5px !important;
            border-radius: 6px !important;
          }
          /* "How your calls reach you" becomes its own card in the right rail
             instead of a section stacked under the form — kept visually
             lighter and more compact than the details cards on the left so
             attention stays on the form. */
          .acepeak-profile .mcm-setupguide {
            margin-top: 0;
            padding: 16px;
            border: 1px solid #E5E7EB;
            border-radius: 12px;
            background: #FFF1F2;
            gap: 12px;
          }
          /* The real cause of the misalignment: this column is
             position: sticky with its nearest scrolling ancestor being
             the page's own overflow-y-auto container, not the viewport —
             so a top offset here isn't just a scroll-pinning threshold,
             it's an active floor on this card's rest position too, and no
             amount of margin can push it above that floor. Zeroed in the
             className itself (lg:top-0) rather than here, so the card's
             natural grid position (already flush with the profile card,
             now that .mcm-setupguide's own margin-top is 0 above) is free
             to render exactly where "items-start" puts it — no margin
             hack needed on top of that. */
          .acepeak-profile .mcm-setupguide h2 {
            font-size: 14px;
          }
          .acepeak-profile .mcm-setupguide header p {
            font-size: 11.5px;
          }
          .acepeak-profile .mcm-setupguide li {
            padding: 9px 0;
            border-bottom-color: #E5E7EB;
          }
          .acepeak-profile .mcm-setupguide-explain {
            margin-top: 1px;
          }
          /* The action link used to sit in its own grid column beside the
             body text, which let it land mid-description once the column
             narrowed and the text wrapped. It now lives beside the item's
             title itself, inside the body, so status/description keep
             reading as their own lines underneath. */
          .acepeak-profile .mcm-setupguide li {
            grid-template-columns: 22px 1fr;
          }
          .acepeak-profile .acepeak-setupguide-titlerow {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
          }
          .acepeak-profile .mcm-setupguide-action {
            color: var(--ap-primary) !important;
            border-color: #FECDD3 !important;
            background: #FFE4E6 !important;
          }
          .acepeak-profile .mcm-setupguide-action:hover {
            color: var(--ap-primary-hover) !important;
            background: #FECDD3 !important;
            border-color: #FDA4AF !important;
          }
          .acepeak-profile .mcm-setupguide-action svg {
            color: inherit !important;
          }
          /* At narrow widths the shared stylesheet nudges the action link
             down with margin-top, a leftover from when it sat below the
             description; it now sits beside the title instead. */
          @media (max-width: 640px) {
            .acepeak-profile .mcm-setupguide-action {
              margin-top: 0 !important;
              grid-column: auto !important;
              justify-self: auto !important;
            }
          }
        `}</style>
        {/* <Breadcrumb breadcrumbs={breadcrumbData} /> */}
        <div className="flex h-[65px] min-h-0 shrink-0 items-center justify-between gap-2 overflow-hidden px-4 py-3 border-b border-gray-200 bg-white">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="acepeak-page-title text-gray-900 font-semibold text-xl">Basic Info</p>
              <Tooltip open={showHeaderHint || undefined}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="acepeak-info-trigger inline-flex h-4 w-4 items-center justify-center rounded-full text-gray-400"
                    aria-label="About this page"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="acepeak-tooltip-content" side="right" align="center">
                  Your name, job title and photo are visible to colleagues across the console.
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
        {PendingUserData ? (
          <div className="flex items-center justify-center p-5">
            <Loader variant="blue" size="sm" />
          </div>
        ) : (
          <div className="w-full flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6">
            <div className="mx-auto w-full max-w-[1180px]">
              <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-6">
                {/* LEFT — profile summary, then the form itself */}
                <div className="flex min-w-0 flex-col gap-4">
                  <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-gray-200 bg-white px-5 py-3.5">
                    <div className="flex min-w-0 items-center gap-5">
                      <div className="w-20 h-20 shrink-0">
                        <div className="relative w-20 h-20 rounded-full">
                          {imagePreview || watch('profile') ? (
                            <img
                              src={imagePreview || watch('profile')}
                              alt="Preview"
                              className="w-full h-full rounded-full border"
                              loading="lazy"
                            />
                          ) : (
                            <CustomAvatar
                              size="80"
                              name={fullName}
                              showPresence={false}
                              extension={userInfo?.extension}
                              image={
                                isImageRemoved
                                  ? null
                                  : imagePreview || watch('profile') || userInfo?.profile
                              }
                              isActivityInfo={false}
                            />
                          )}

                          <Popover open={photoMenuOpen} onOpenChange={setPhotoMenuOpen}>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                title="Edit photo"
                                className="absolute bottom-0 right-0 w-4 h-4 bg-primary rounded-full p-1"
                              >
                                <Icon name="EditIcon" className="text-white w-full h-full" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              align="end"
                              sideOffset={6}
                              className="acepeak-popover-content w-40 p-1"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setPhotoMenuOpen(false);
                                  fileInputRef.current?.click();
                                }}
                                className="w-full rounded-md px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                              >
                                Upload photo
                              </button>
                              {(imagePreview || watch('profile')) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPhotoMenuOpen(false);
                                    setImagePreview(null);
                                    setValue('profile', '');
                                    setIsImageRemoved(true);
                                  }}
                                  className="w-full rounded-md px-2 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                                >
                                  Remove photo
                                </button>
                              )}
                            </PopoverContent>
                          </Popover>
                        </div>

                        <input
                          ref={fileInputRef}
                          id="file-upload"
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handleChangeFile}
                        />
                      </div>
                      <div className="min-w-0 flex flex-col justify-center">
                        <p className="acepeak-heading truncate text-lg text-gray-900">
                          {fullName || '—'}
                        </p>
                      </div>
                    </div>
                    {basicInfoAccess?.edit && (
                      <div className="flex shrink-0 items-center gap-2">
                        {isEditing ? (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="acepeak-profile-actionbtn"
                              onClick={handleCancelEdit}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              className="acepeak-save-btn acepeak-profile-actionbtn"
                              disabled={PendingProfileUpdate}
                              onClick={() => handleSubmit(onSubmit)()}
                            >
                              {PendingProfileUpdate ? 'Saving...' : 'Save'}
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            className="acepeak-edit-btn acepeak-profile-actionbtn"
                            onClick={() => setIsEditing(true)}
                          >
                            Edit Profile
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  <div
                    className="mcm-page"
                    style={
                      {
                        display: 'block',
                        height: 'auto',
                        minHeight: 0,
                        overflow: 'visible',
                        background: 'transparent',
                        fontFamily: 'inherit',
                        fontSize: 'inherit',
                        lineHeight: 'inherit',
                        '--sans': 'inherit',
                        '--mono': 'inherit',
                      } as CSSProperties
                    }
                  >
                    <FormProvider {...methods}>
                      <form onSubmit={handleSubmit(onSubmit)} className="flex w-full flex-col gap-4">
                        <BasicInformation
                          isChooseTemplate={false}
                          isSiteDisabled={true}
                          customClass=""
                          compactDescriptions
                          identityDisabled={!isEditing}
                        />
                      </form>
                    </FormProvider>
                  </div>

                  {isDirty && (
                    <div className="flex items-center gap-2 rounded-lg border border-[#FCA5A5] bg-[#FFF1F2] px-4 py-3 text-sm text-[#B91C1C]">
                      <Lock className="h-4 w-4 shrink-0" />
                      You have unsaved changes
                    </div>
                  )}
                </div>

                {/* RIGHT — the checklist that says what happens when someone
                    calls, pinned alongside the form on desktop and stacked
                    below it on narrower screens. */}
                <div className="min-w-0 lg:sticky lg:top-0">
                  <CallSetupGuide userInfo={userInfoData} />
                </div>
              </div>
            </div>
          </div>
        )}
        {modalState && (
          <FileCropper
            {...{
              image,
              handleUpload,
              modalState,
              setModalState,
              uploadMediaLoad,
              setLoader,
              loader,
            }}
            ref={cropperUploadRef}
          />
        )}
      </section>
    </>
  );
};

export default BasicInfoSettings;