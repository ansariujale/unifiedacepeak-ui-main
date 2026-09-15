import { Button } from '@/components/ui/button';
import { Icon } from '@/assets/icons/icon';
import { CloseIcon } from '@/assets/icons';
import { Info } from 'lucide-react';
import CustomTooltip from '@/components/custom/custom-tooltip';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Fragment, ReactNode, useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import CampaignDetails from './campaign-details';
import CarrierTermsPreview from './carrier-terms-preview';
import CampaignUseCase from './campaign-use-case';
import PaymentAndConfirmation from './payment-and-confirmation';
import {
  campaignDetailSchema,
  CAMPAINGN_INITIALS,
  paymentSchema,
  TermsPreviewSchema,
  useCaseSchema,
} from '../constant';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addCampaign } from '@/services/api';
import { handleAlert } from '@/lib/utils';
import { yupResolver } from '@hookform/resolvers/yup';
import { AnyObjectSchema } from 'yup';
import AlertConfirm from '@/components/custom/alert-confirm';

export const DLC_CAMPAIGN_CONST = {
  'use-case': 'Campaign Use Case',
  terms: 'Carrier Terms Preview',
  details: 'Campaign Details',
  payment: 'Payment and Confirmation',
};

type TabKey = 'use-case' | 'terms' | 'details' | 'payment';

const tabOrder: TabKey[] = ['use-case', 'terms', 'details', 'payment'];

const nextTabMap: Record<TabKey, TabKey | null> = {
  'use-case': 'terms',
  terms: 'details',
  details: 'payment',
  payment: null,
};

const schemaLookUp: Record<TabKey, any> = {
  'use-case': useCaseSchema,
  terms: TermsPreviewSchema,
  details: campaignDetailSchema,
  payment: paymentSchema,
};

/* Schema keys are what yup reports; these are what the form calls them on
   screen, so a refusal can name the field the user is looking for rather
   than `mnoIds`. */
const FIELD_LABELS: Record<string, string> = {
  brand_type: 'Brand',
  usecase: 'Use case',
  subUsecases: 'Sub use cases',
  referenceId: 'Reference ID',
  resellerId: 'Reseller',
  description: 'Campaign description',
  messageFlow: 'Message flow',
  sample1: 'Sample message',
  mnoIds: 'Carriers',
  amount: 'Amount',
  autoRenewal: 'Auto renewal',
  cnp: 'Upstream CNP',
  payment_terms: 'Payment terms',
};

const Create10DLCCampaign = ({ setDrawerState }: { drawerState: boolean; setDrawerState: any }) => {
  const queryClient: any = useQueryClient();

  const [currentStep, setCurrentStep] = useState<TabKey>('use-case');
  const [open, setOpen] = useState(false);

  const activeSchema = useMemo(() => {
    return schemaLookUp[currentStep] as AnyObjectSchema;
  }, [currentStep]);

  const formInstance = useForm<any>({
    defaultValues: CAMPAINGN_INITIALS,
    resolver: yupResolver(activeSchema),
    mode: 'onChange',
  });

  const { handleSubmit } = formInstance;

  const stepLookUp: Record<TabKey, ReactNode> = {
    'use-case': <CampaignUseCase {...{ formInstance }} />,
    terms: <CarrierTermsPreview {...{ formInstance }} />,
    details: <CampaignDetails {...{ formInstance }} />,
    payment: <PaymentAndConfirmation {...{ formInstance }} />,
  };

  const { mutate, isPending } = useMutation({
    mutationFn: addCampaign,
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries(['getUsersDetails'], {
        exact: true,
      });
      handleAlert({
        text: data?.data?.message,
        type: 'success',
      });
      setDrawerState(false);
    },
  });

  const currentIndex = tabOrder.indexOf(currentStep);

  /* Why a move was refused. `goNext` used to just `return` on an invalid
     step, so pressing Next on an incomplete form did nothing visible. */
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);

  useEffect(() => {
    const sub = formInstance.watch(() => setBlockedMsg(null));
    return () => sub.unsubscribe();
  }, [formInstance]);

  /* Ask the schema directly rather than reading `formState.errors` -- that is
     a Proxy which only stays current for components that read it during
     render, and a read straight after `trigger()` comes back empty. */
  const findProblems = async (): Promise<{ key: string; message: string }[]> => {
    try {
      await activeSchema.validate(formInstance.getValues(), { abortEarly: false });
      return [];
    } catch (err: any) {
      const seen = new Set<string>();
      const out: { key: string; message: string }[] = [];
      for (const e of err?.inner ?? []) {
        const key = String(e?.path || '').split(/[.[]/)[0];
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push({ key, message: String(e?.message || '') });
      }
      return out;
    }
  };

  const describeProblems = (problems: { key: string; message: string }[]) => {
    if (!problems.length) return `Finish ${DLC_CAMPAIGN_CONST[currentStep]} to continue.`;
    /* Lead with the first problem in the schema's own words, then say how
       many others are waiting. Listing bare labels -- "Still to fix: Campaign
       description, Message flow" -- had the same defect the single-field case
       was already fixed for: a field that is filled but too short is named
       exactly like one that is empty, so you go back to a field that looks
       done and nothing on screen says what is wrong with it. */
    const [first, ...rest] = problems;
    const label = FIELD_LABELS[first.key] || first.key;
    /* Some messages already open with the field's own name -- yup's defaults
       use the schema key ("mnoIds must be..."), and several of the custom
       ones name the field too ("Description must be at least 40 characters").
       Those get the name swapped for the label rather than a second copy of
       it bolted on the front, which is how "Campaign description: Description
       must be..." happened. Messages that do not name a field keep the
       "label: message" shape, since on their own they say nothing about
       where to look. */
    const raw = String(first.message || '').trim();
    const leads = raw.toLowerCase().startsWith(first.key.toLowerCase());
    const head = leads ? `${label}${raw.slice(first.key.length)}` : `${label}: ${raw}`;
    if (!rest.length) return head;
    return `${head} (and ${rest.length} other field${rest.length > 1 ? 's' : ''} on this step)`;
  };

  const refuse = async () => {
    const problems = await findProblems();
    setBlockedMsg(describeProblems(problems));
    const first = problems[0]?.key;
    if (!first) return;
    try {
      formInstance.setFocus(first);
    } catch {
      document
        .querySelector(`[name="${first}"]`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  };

  const goNext = async () => {
    const isValid = await formInstance.trigger();

    if (!isValid) {
      await refuse();
      return;
    }
    setBlockedMsg(null);

    const nextTab = nextTabMap[currentStep];

    if (nextTab) {
      setCurrentStep(nextTab);
    } else {
      setOpen(true);
    }
  };

  const goPrev = () => {
    setBlockedMsg(null);
    if (currentIndex > 0) {
      setCurrentStep(tabOrder[currentIndex - 1]);
    }
  };
  const handleTabChange = async (targetTab: TabKey) => {
    const currentIndex = tabOrder.indexOf(currentStep);
    const targetIndex = tabOrder.indexOf(targetTab);

    // Allow moving backward freely
    if (targetIndex < currentIndex) {
      setCurrentStep(targetTab);
      return;
    }

    // For forward movement, validate current tab
    const isValid = await formInstance.trigger();
    if (!isValid) {
      /* Same refusal the Next button gives. The tab used to fail silently,
         which is indistinguishable from a dead control. */
      await refuse();
      return;
    }
    setBlockedMsg(null);
    setCurrentStep(targetTab);
  };

  const onSubmit = (data: any) => {
    const { brand_type, resellerId, cnp, payment_terms: _, ...rest } = data || {};
    console.log(_);
    const payload = {
      ...rest,
      brandId: brand_type?.value,
      resellerId: resellerId?.value,
      cnp: cnp?.value,
    };

    mutate(payload);
  };

  return (
    <>
      {/* Head, scrolling body, footer -- the same three bands as the Create
          brand wizard. The drawer used to supply the title; in a centred
          dialog the form paints its own. */}
      <div className="mcm-modal dlc-wizard">
        <div className="mcm-modal-head">
          <div className="mcm-modal-titlerow">
            <div className="min-w-0">
              <div className="mcm-modal-eyebrow">10DLC Compliance</div>
              <div className="flex items-center gap-2">
                <h2 className="mcm-modal-title">Create 10DLC Campaign</h2>
                <CustomTooltip
                  side="bottom"
                  sideOffset={8}
                  className="mcm-tooltip-info"
                  text="The message programme you register against a brand before carriers will deliver its A2P traffic."
                >
                  <Info className="mcm-intpage-info" />
                </CustomTooltip>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDrawerState(false)}
              className="mcm-modal-close"
              aria-label="Close"
            >
              <CloseIcon className="w-3 h-3" />
            </button>
          </div>

          <Tabs
            value={currentStep}
            onValueChange={(val) => handleTabChange(val as TabKey)}
            className="dlc-wizard-tabs flex w-full min-h-0 flex-col"
          >
            <div className="w-full dlc-wizard-tabs-header">
            {/* The same stepper the brand wizard uses: numbered nodes joined
                by a line, done steps checked, the current one filled. These
                were four underline tabs in the tenant blue, which read as
                interchangeable views rather than an order to work through. */}
            <TabsList className="dlc-wizard-tabs-list flex w-full p-0 rounded-none bg-transparent min-h-10">
              {tabOrder.map((key, index) => {
                const done = index < currentIndex;
                return (
                  <Fragment key={key}>
                    {index > 0 && <span aria-hidden="true" className="dlc-wizard-tab-line" />}
                    <TabsTrigger
                      className={`dlc-wizard-tab-trigger ${done ? 'is-done' : ''}`}
                      value={key}
                    >
                      <span className="dlc-wizard-tab-num">
                        {done ? <Icon name="VerifiedCheck" className="h-3 w-3" /> : index + 1}
                      </span>
                      <span className="dlc-wizard-tab-label">{DLC_CAMPAIGN_CONST[key]}</span>
                    </TabsTrigger>
                  </Fragment>
                );
              })}
            </TabsList>

            {/* Next to the control that refused, not down by the buttons. */}
            {blockedMsg ? (
              <p className="dlc-wizard-blocked" role="status">
                <Icon name="InfoIcon" className="h-3.5 w-3.5 shrink-0" />
                {blockedMsg}
              </p>
            ) : null}
            </div>
          </Tabs>
        </div>

        <FormProvider {...formInstance}>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="dlc-wizard-form min-h-0 w-full flex flex-1 flex-col justify-between overflow-hidden"
          >
            <div className="mcm-modal-body dlc-wizard-step-content min-h-0 flex-1 overflow-y-auto">
              {stepLookUp?.[currentStep]}
            </div>
            <div className="mcm-modal-foot dlc-wizard-footer">
              {/* Where you are in the wizard, so Prev/Next have a frame. */}
              <span className="dlc-wizard-step">
                Step {currentIndex + 1} of {tabOrder.length}
              </span>
              <Button
                variant="transparent"
                type="button"
                onClick={() => setDrawerState(false)}
                className="dlc-wizard-footer-btn shrink-0"
              >
                Cancel
              </Button>

              <Button
                variant="outline"
                type="button"
                onClick={goPrev}
                disabled={currentIndex === 0}
                className="dlc-wizard-footer-btn shrink-0"
              >
                Prev
              </Button>

              {/* The step that moves you forward is the primary action, so it
                  is the black pill the rest of the console uses. Prev and Next
                  were both `outline`, which gave the row two identical
                  buttons and no answer to "what do I press". */}
              <Button
                variant="outline"
                type="button"
                onClick={goNext}
                disabled={isPending}
                className="dlc-wizard-footer-btn dlc-wizard-footer-btn--primary shrink-0"
              >
                {currentStep === 'payment' ? (isPending ? 'Creating...' : 'Create campaign') : 'Next'}
              </Button>
            </div>
            {/* <div className="flex justify-end gap-2">
              <Button variant={'transparent'} type="button" onClick={() => setDrawerState(false)}>
                Cancel
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant={'outline'}
                  type="button"
                  onClick={handlePrev}
                  disabled={currentStep === TABS_ORDER[0]}
                >
                  Prev
                </Button>
                {currentStep !== DLC_CAMPAIGN_CONST.PAYMENT_AND_CONFIRMATION && (
                  <Button variant={'outline'} type="button" onClick={handleNext}>
                    Next
                  </Button>
                )}
                {currentStep === DLC_CAMPAIGN_CONST.PAYMENT_AND_CONFIRMATION && (
                  <Button variant={'primary'} type="submit" disabled={isPending} >
                    {isPending ? 'Submiting...' : 'Submit'}
                  </Button>
                )}
              </div>
            </div> */}
          </form>
        </FormProvider>
      </div>

      {/* AlertConfirm is shared by some thirty pages, so the black pill goes
          on through its own `confirmBtnClassName` hook rather than into the
          component -- this is the wizard's primary action and should look
          like the Create campaign button that opened it, but nothing else in
          the app should change. `dlc-wizard-footer-btn` is deliberately
          unscoped for exactly this: the dialog portals to <body>. */}
      <AlertConfirm
        {...{
          apiLoading: isPending,
          onConfirm: () => {
            formInstance.handleSubmit(onSubmit)();
          },
          open,
          setOpen,
          confirmBtnText: 'Create campaign',
          confirmBtnClassName: 'dlc-wizard-footer-btn dlc-wizard-footer-btn--primary',
          descriptionTextComp: (
            <span className="text-md">
              Are you sure you want to proceed with creating the campaign? The amount $20 will be
              deducted from your wallet.
            </span>
          ),
        }}
      />
    </>
  );
};

export default Create10DLCCampaign;
