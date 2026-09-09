import { FC, useEffect, useMemo, useState } from 'react';
import { CAMPAIGN_UPSERT_TAB_CONSTANT } from '../const';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import BasicInformation from './basic-info';
import Settings from './settings';
import AgentsList from './agents-list';
import { FormProvider, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { CAMPAIGN_SCEHAM } from './schema';
import { CAMPAIGN_TYPE_LIST, DIALER_TYPE, PREVIW_INITIALS } from './consts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { allNumbersList, createCampaign, getCallScript, getCampaignDetail } from '@/services/api';
import { handleAlert } from '@/lib/utils';
import { useGetGroupList, useGetSite } from '@/hooks/common';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import DispositionModal from '../../dispositions/add-edit-dispositions';
import CustomTooltip from '@/components/custom/custom-tooltip';
import SettingsAndPermission from './settings-and-permission';
import { useUser } from '@/hooks/use-user';
import GreetingNotification from './greetings';
import Spin from '@/components/spin';
import moment from 'moment';
import { buildCampaignUpsertPayload, mapCampaignToFormDefaults } from './campaign-mappers';
import { ChevronRight, Eye, Gauge, X, Zap } from 'lucide-react';
import './campaign-form.css';

/** One icon per dialling mode, keyed by the values the form already stores. */
const TYPE_ICON: Record<string, typeof Eye> = {
  [DIALER_TYPE.PREVIEW]: Eye,
  [DIALER_TYPE.NORMAL]: Gauge,
  [DIALER_TYPE.PREDICTIVE]: Zap,
};

/** Step order the wizard pages through, one at a time, behind Next/Prev. */
const TABS_ORDER = [
  CAMPAIGN_UPSERT_TAB_CONSTANT.BASIC_INFORMATION,
  CAMPAIGN_UPSERT_TAB_CONSTANT.SETTING_PERMISSION,
  CAMPAIGN_UPSERT_TAB_CONSTANT.SETTING,
  CAMPAIGN_UPSERT_TAB_CONSTANT.AGENTS,
  CAMPAIGN_UPSERT_TAB_CONSTANT.MEDIA,
];

const collectFormErrorMessages = (errorNode: any): string[] => {
  if (!errorNode) return [];
  if (typeof errorNode === 'string') return [errorNode];
  if (Array.isArray(errorNode)) {
    return errorNode.flatMap((item) => collectFormErrorMessages(item));
  }
  if (typeof errorNode === 'object') {
    const directMessage = typeof errorNode.message === 'string' ? [errorNode.message] : [];
    const nestedMessages = Object.values(errorNode).flatMap((value) =>
      collectFormErrorMessages(value),
    );
    return [...directMessage, ...nestedMessages];
  }
  return [];
};

const AddEditCampaign: FC<any> = ({ setDrawerState, selectedCampaign }) => {
  const [activeTab, setActiveTab] = useState<string>(
    CAMPAIGN_UPSERT_TAB_CONSTANT.BASIC_INFORMATION,
  );
  const { user } = useUser();
  const { user_info } = user || {};
  const isEditMode = Boolean(selectedCampaign?._id);
  const queryClient: any = useQueryClient();
  const { data: dataSiteList = [] } = useGetSite();
  const { data: groupList = [] } = useGetGroupList({ type: 'LEAD', generatedBy: null });
  const [dialMethod, setDialMethod] = useState<string>();

  const [schemaContext, setSchemaContext] = useState(null);
  const [modalState, setModalState] = useState<boolean>(false);
  const [isFormInitialized, setIsFormInitialized] = useState(false);

  const {
    data: campaignDetail,
    isLoading: isLoadingCampaignDetail,
    isFetching: isFetchingCampaignDetail,
  } = useQuery({
    queryKey: ['campaignDetail', selectedCampaign?._id],
    queryFn: () => getCampaignDetail({ campaignId: selectedCampaign?._id }),
    select: (data) => data?.data?.data?.result,
    enabled: isEditMode,
    refetchOnWindowFocus: false,
  });
  const campaignData = campaignDetail || selectedCampaign;
  const { campaignStatus = 'NEW' } = campaignData || {};

  const { data: inventoryNumberList = [], isLoading: isLoadingInventoryNumber } = useQuery({
    queryKey: ['allNumbersListInInventory'],
    queryFn: () =>
      allNumbersList({
        page: 1,
        limit: 1000,
      }),
    select: (data) => data?.data?.data?.result?.rows,
  });

  const { data: scriptList = [], isLoading: isLoadingScriptListing } = useQuery({
    queryKey: ['getScriptListAccToType', dialMethod],
    queryFn: () =>
      getCallScript({
        page: 1,
        limit: 200,
        filters: [],
        sort: {
          key: 'createdAt',
          desc: true,
        },
      }),
    select: (data) => data?.data?.data?.result?.rows || [],
  });
  const formInstance = useForm<any>({
    defaultValues: useMemo(
      () => ({
        ...PREVIW_INITIALS,
        startDate: moment().format('YYYY-MM-DD'),
        endDate: moment().add(1, 'month').format('YYYY-MM-DD'),
      }),
      [],
    ),
    resolver: yupResolver(CAMPAIGN_SCEHAM[activeTab]),
    mode: 'onChange',
    context: { schemaContext },
  });
  const {
    trigger,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = formInstance;

  const notifyValidationErrors = (fallback?: string) => {
    const messages = collectFormErrorMessages(errors).filter(Boolean);
    handleAlert({
      text: messages[0] || fallback || 'Please fix validation errors before continuing.',
      type: 'warning',
    });
  };

  const { mutate: mutateAddCampaign, isPending: isPendingAddCampaign } = useMutation({
    mutationFn: createCampaign,
    onSuccess: () => {
      handleAlert({
        text: isEditMode ? 'Campaign updated successfully!' : 'Campaign created successfully!',
        type: 'success',
      });
      queryClient.invalidateQueries({
        queryKey: ['getCampaignListForPreview'],
        exact: false,
      });
      setDrawerState(false);
    },
  });
  useEffect(() => {
    if (user_info && !watch('siteId')?.value && !isEditMode) {
      const obj = {
        label: user_info?.site_detail?.name,
        value: user_info?.site_uuid,
      };
      setValue('siteId', obj);
    }
  }, [user_info, selectedCampaign, isEditMode]);

  const handleTabChange = async (nextTab: string) => {
    const currentIndex = TABS_ORDER.indexOf(activeTab);
    const nextIndex = TABS_ORDER.indexOf(nextTab);

    if (nextIndex <= currentIndex) {
      setActiveTab(nextTab);
      return;
    }
    const values = formInstance.getValues();

    for (let i = currentIndex; i < nextIndex; i++) {
      const tabKey = TABS_ORDER[i];
      const schema = CAMPAIGN_SCEHAM[tabKey];

      try {
        await schema.validate(values, {
          abortEarly: false,
        });
      } catch (err: any) {
        if (err?.inner) {
          err.inner.forEach((validationError: any) => {
            if (validationError.path) {
              formInstance.setError(validationError.path as any, {
                type: 'manual',
                message: validationError.message,
              });
            }
          });
        }
        notifyValidationErrors(err?.inner?.[0]?.message || err?.message);

        return;
      }
    }

    setActiveTab(nextTab);
  };

  const handleNext = async () => {
    const currentIndex = TABS_ORDER.indexOf(activeTab);
    const isValid = await trigger();

    if (!isValid) {
      notifyValidationErrors();
      return;
    }

    if (currentIndex < TABS_ORDER.length - 1) {
      setActiveTab(TABS_ORDER[currentIndex + 1]);
    }
  };

  const handlePrev = () => {
    const currentIndex = TABS_ORDER.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(TABS_ORDER[currentIndex - 1]);
    }
  };

  const stepLookUp: any = useMemo(
    () => ({
      [CAMPAIGN_UPSERT_TAB_CONSTANT.BASIC_INFORMATION]: (
        <BasicInformation {...{ dataSiteList, groupList, inventoryNumberList, campaignStatus }} />
      ),
      [CAMPAIGN_UPSERT_TAB_CONSTANT.SETTING_PERMISSION]: (
        <SettingsAndPermission campaignStatus={campaignStatus} />
      ),
      [CAMPAIGN_UPSERT_TAB_CONSTANT.SETTING]: (
        <Settings
          dialMethod={dialMethod}
          setModalState={setModalState}
          campaignStatus={campaignStatus}
        />
      ),
      [CAMPAIGN_UPSERT_TAB_CONSTANT.AGENTS]: (
        <AgentsList scriptList={scriptList} dialMethod={dialMethod} />
      ),
      [CAMPAIGN_UPSERT_TAB_CONSTANT.MEDIA]: <GreetingNotification />,
    }),
    [
      dataSiteList,
      groupList,
      inventoryNumberList,
      campaignStatus,
      dialMethod,
      scriptList,
      setModalState,
    ],
  );

  const onSubmit = () => {
    const payload = buildCampaignUpsertPayload({
      formValues: getValues(),
      dialMethod,
      campaignStatus,
      selectedCampaignId: campaignData?._id,
      fallbackDomain: user?.sip_credentials?.domain || '',
    });
    mutateAddCampaign(payload);
  };
  useEffect(() => {
    if (scriptList?.length > 0 && campaignData?._id) {
      const scriptLabel = scriptList?.find((item: any) => item._id === campaignData?.script)?.name;
      setValue('script', { label: scriptLabel || '', value: campaignData?.script || '' });
    }
  }, [scriptList, campaignData, setValue]);

  useEffect(() => {
    setIsFormInitialized(false);
    if (!isEditMode) {
      setDialMethod(DIALER_TYPE.PREVIEW);
    } else setDialMethod(campaignData?.dialMethod || DIALER_TYPE.PREVIEW);
  }, [selectedCampaign?._id, isEditMode, campaignData?.dialMethod]);

  useEffect(() => {
    if (
      !isFormInitialized &&
      campaignData &&
      (!isEditMode || (campaignDetail && !isFetchingCampaignDetail))
    ) {
      const prefilledValues = mapCampaignToFormDefaults({
        selectedCampaign: campaignData,
        dataSiteList,
        groupList,
        inventoryNumberList,
      });

      setValue('name', prefilledValues.name);
      setValue('description', prefilledValues.description);
      setValue('dialerSetting', prefilledValues.dialerSetting);
      setValue('greetings', prefilledValues.greetings);
      setValue('agentDisposition', prefilledValues.agentDisposition);
      setValue('allowSkipping', prefilledValues.allowSkipping);
      setValue('agentScripting', prefilledValues.agentScripting);
      setValue('members', prefilledValues.members);
      setValue('startDate', prefilledValues.startDate);
      setValue('endDate', prefilledValues.endDate);
      setValue('settings', prefilledValues.settings);
      setValue('settings.display_number.masking.type', prefilledValues.maskingType);
      setValue('siteId', prefilledValues.siteId);
      setValue('groupId', prefilledValues.groupId);
      setValue('callerId', prefilledValues.callerId);
      setIsFormInitialized(true);
    }
  }, [
    isFormInitialized,
    campaignData,
    campaignDetail,
    isFetchingCampaignDetail,
    inventoryNumberList,
    groupList,
    dataSiteList,
    setValue,
    isEditMode,
  ]);

  useEffect(() => {
    const subscription = watch((value) => {
      setSchemaContext(value);
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  return (
    <>
      <Spin
        loading={
          isLoadingInventoryNumber ||
          isLoadingScriptListing ||
          isLoadingCampaignDetail ||
          isFetchingCampaignDetail
        }
      >
        <div className="acp-form">
          <div className="acp-head">
            <div className="min-w-0 flex-1">
              <DialogTitle className="acp-title">
                {isEditMode ? 'Update Campaign' : 'Add Campaign'}
              </DialogTitle>
              {isEditMode && (
                <DialogDescription className="acp-sub">
                  {`Editing ${selectedCampaign?.name || 'this campaign'}.`}
                </DialogDescription>
              )}
            </div>
            {!isEditMode && (
              /* TEMP: lets this account fill Basic Information with
                 placeholder values so the later steps can be reached and
                 reviewed while there's no real caller ID/lead data yet.
                 Doesn't touch the form's own defaultValues, so a fresh
                 "New campaign" still opens empty for everyone else.
                 Remove this button once real data exists. */
              <button
                type="button"
                className="acp-fill-demo"
                onClick={() => {
                  setValue('name', 'Sample Outreach Campaign', { shouldValidate: true });
                  setValue(
                    'callerId',
                    [{ label: '+14422129610', value: '+14422129610' }],
                    { shouldValidate: true },
                  );
                  setValue('groupId', [{ label: 'Sample Lead Group', value: 'demo-group' }], {
                    shouldValidate: true,
                  });
                }}
              >
                Fill sample data
              </button>
            )}
            <button
              type="button"
              className="acp-close"
              aria-label="Close"
              onClick={() => setDrawerState(false)}
            >
              <X size={15} />
            </button>
          </div>

          <RadioGroup
            value={dialMethod}
            disabled={isEditMode}
            onValueChange={(val) => {
              setDialMethod(val);
              setValue('dialMethod', val);
              setValue('script', { label: '', value: '' });
            }}
            className="acp-types"
          >
            {CAMPAIGN_TYPE_LIST.map((item, index) => {
              const id = `dial-option-${index}`;
              const Icon = TYPE_ICON[item.value] || Eye;
              const isOn = dialMethod === item?.value;
              return (
                <CustomTooltip
                  key={index}
                  side="top"
                  text={item.description}
                  className="bg-gray-500 text-white"
                >
                  <label
                    htmlFor={id}
                    className={`acp-type${isOn ? ' is-on' : ''}${
                      isEditMode ? ' is-locked' : ' cursor-pointer'
                    }`}
                  >
                    <span className="acp-type-ico">
                      <Icon size={17} />
                    </span>
                    <span className="acp-type-body">
                      <span className="acp-type-title block">{item.label}</span>
                    </span>
                    <RadioGroupItem
                      id={id}
                      value={item.value}
                      className="peer mt-0.5 cursor-pointer"
                    />
                  </label>
                </CustomTooltip>
              );
            })}
          </RadioGroup>

          {/* Breadcrumb-style step nav: step names in a single trail,
              separated by a chevron, current step bolded. Still drives the
              same handleTabChange, so the validation gate on moving
              forward is unchanged. */}
          <nav className="acp-crumbs" role="tablist" aria-label="Campaign steps">
            {TABS_ORDER.map((value, index) => {
              const current = TABS_ORDER.indexOf(activeTab);
              const state = index === current ? 'on' : index < current ? 'done' : 'off';
              return (
                <span className={`acp-crumb-item is-${state}`} key={value}>
                  {index > 0 && <ChevronRight className="acp-crumb-sep" size={14} />}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={index === current}
                    className="acp-crumb-btn"
                    onClick={() => handleTabChange(value)}
                  >
                    {value}
                  </button>
                </span>
              );
            })}
          </nav>

          <FormProvider {...formInstance}>
            <form onSubmit={formInstance.handleSubmit(onSubmit)} className="acp-formbody">
              <div className="acp-scroll">{stepLookUp?.[activeTab]}</div>
              <div className="acp-actions flex flex-row items-center justify-between gap-2">
                <Button
                  variant={'transparent'}
                  className="acp-cancel"
                  type="button"
                  onClick={() => setDrawerState(false)}
                >
                  Cancel
                </Button>
                <div className="flex flex-row items-center gap-2">
                  <Button
                    variant={'outline'}
                    className="acp-prev"
                    type="button"
                    onClick={handlePrev}
                    disabled={activeTab === TABS_ORDER[0]}
                  >
                    Prev
                  </Button>
                  {activeTab !== CAMPAIGN_UPSERT_TAB_CONSTANT.MEDIA && (
                    <Button
                      variant={'primary'}
                      className="acp-next"
                      type="button"
                      onClick={handleNext}
                    >
                      Next
                    </Button>
                  )}
                  {activeTab === CAMPAIGN_UPSERT_TAB_CONSTANT.MEDIA && (
                    <Button
                      variant={'primary'}
                      className="acp-next"
                      type="submit"
                      disabled={isPendingAddCampaign}
                    >
                      {isPendingAddCampaign ? 'Submitting...' : 'Submit'}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </FormProvider>
        </div>
      </Spin>
      {modalState && (
        <DispositionModal modalState={modalState} setModalState={() => setModalState(false)} />
      )}
    </>
  );
};

export default AddEditCampaign;
