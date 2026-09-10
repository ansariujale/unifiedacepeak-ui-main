import { Fragment, useEffect, useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { Icon } from '@/assets/icons/icon';
import { CloseIcon } from '@/assets/icons';
import CustomTooltip from '@/components/custom/custom-tooltip';
import {
  BRAND_INITIALS,
  brandDetailsSchema,
  brandRelationshipSchema,
  contactDetailsSchema,
  DLC_BRAND_TABS_CONST,
} from '../constant';
import BrandDetails from './brand-details';
import BrandRelationship from './brand-relationship';
import ContactDetails from './contact-details';
import { useForm } from 'react-hook-form';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { brandCreate } from '@/services/api';
import { handleAlert } from '@/lib/utils';
import { AnyObjectSchema } from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';

/* Schema keys are what react-hook-form reports; these are what the form
   calls them on screen, so a refusal can name the field the user is looking
   for rather than `postalCode`. */
const FIELD_LABELS: Record<string, string> = {
  companyName: 'Legal company name',
  displayName: 'DBA or brand name',
  entityType: 'Legal form of the organisation',
  country: 'Country of registration',
  ein: 'Tax number / EIN',
  einIssuingCountry: 'EIN issuing country',
  altBusinessIdType: 'DUNS, GIIN or LEI',
  altBusinessId: 'ID number',
  street: 'Street address',
  city: 'City',
  state: 'State',
  postalCode: 'ZIP code',
  website: 'Website',
  stockSymbol: 'Stock symbol',
  stockExchange: 'Stock exchange',
  vertical: 'Vertical',
  referenceId: 'Reference ID',
  firstName: 'First name',
  lastName: 'Last name',
  mobilePhone: 'Mobile phone',
  phone: 'Phone',
  email: 'Email',
  businessContactEmail: 'Business contact email',
  brandRelationship: 'Brand relationship',
};

const schemaLookUp = {
  [DLC_BRAND_TABS_CONST.BRAND_DETAILS]: brandDetailsSchema,
  [DLC_BRAND_TABS_CONST.BRAND_RELATIONSHIP]: brandRelationshipSchema,
  [DLC_BRAND_TABS_CONST.CONTACT_DETAILS]: contactDetailsSchema,
};
const Create10DLCBrand = ({ setDrawerState }: any) => {
  const queryClient: any = useQueryClient();

  const steps = [
    DLC_BRAND_TABS_CONST.BRAND_DETAILS,
    DLC_BRAND_TABS_CONST.BRAND_RELATIONSHIP,
    DLC_BRAND_TABS_CONST.CONTACT_DETAILS,
  ];

  const [currentStep, setCurrentStep] = useState(steps[0]);

  const activeSchema = useMemo(() => {
    return schemaLookUp[currentStep] as AnyObjectSchema;
  }, [currentStep]);

  const formMethods = useForm({
    defaultValues: BRAND_INITIALS,
    resolver: yupResolver(activeSchema),
    mode: 'onChange',
  });

  const { mutate, isPending } = useMutation({
    mutationFn: brandCreate,
    onSuccess: ({ data }) => {
      console.log('🚀 ~ Create10DLCBrand ~ data:', data);
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

  const currentIndex = steps.indexOf(currentStep);

  /* Why a move was refused. The gate used to fail silently apart from the
     fields turning red, which on a blank form reads as a dead control rather
     than a blocked one. */
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);

  /* Clear it the moment anything is edited -- a stale "finish this step"
     line sitting under a form the user has since filled in is worse than no
     line at all. */
  useEffect(() => {
    const sub = formMethods.watch(() => setBlockedMsg(null));
    return () => sub.unsubscribe();
  }, [formMethods]);

  /* Ask the schema which fields are failing, rather than reading
     `formState.errors`.
     `formState` is a Proxy that only keeps a property current for components
     that read it during render; this one does not, so a read straight after
     `trigger()` came back EMPTY. That is what produced a refusal naming
     "Tax number / EIN" when the EIN was filled in and the real gaps were
     elsewhere -- it was reporting a stale snapshot. Validating the active
     step's schema against current values is deterministic and owes nothing
     to when React last rendered. */
  const findMissing = async (): Promise<{ key: string; message: string }[]> => {
    try {
      await activeSchema.validate(formMethods.getValues(), { abortEarly: false });
      return [];
    } catch (err: any) {
      const seen = new Set<string>();
      const out: { key: string; message: string }[] = [];
      for (const e of err?.inner ?? []) {
        const key = String(e?.path || '').split('.')[0];
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push({ key, message: String(e?.message || '') });
      }
      return out;
    }
  };

  /* Take the user to the first thing that needs fixing. Without this, a
     refusal looks like nothing happening at all when the offending field has
     scrolled out of view -- and on Brand Details five of the required fields
     sit below the fold. */
  const revealField = (name?: string) => {
    if (!name) return;
    try {
      formMethods.setFocus(name);
    } catch {
      /* Controller-backed selects have no focusable input registered;
         falling back to scrolling their label into view is enough. */
      document
        .querySelector(`[name="${name}"]`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  };

  /* Name what is missing. "Fill in the required fields" is no help when the
     fields in question are the ones you cannot see. */
  const describeMissing = (problems: { key: string; message: string }[]) => {
    if (!problems.length) return `Finish ${currentStep} to continue.`;

    /* Lead with the first problem in the schema's own words, then say how
       many others are waiting. Listing bare labels -- "Still to fix: Campaign
       description, Message flow" -- had the same defect the single-field case
       was already fixed for: a field that is filled but too short is named
       exactly like one that is empty, so you go back to a field that looks
       done and nothing on screen says what is wrong with it. A 7-digit EIN
       was the case that first showed this up. */
    const [first, ...rest] = problems;
    const label = FIELD_LABELS[first.key] || first.key;
    /* Some messages already open with the field's own name -- yup's defaults
       use the schema key ("ein must be..."), and several of the custom ones
       name the field too. Those get the name swapped for the label rather
       than a second copy of it bolted on the front, which is how "Campaign
       description: Description must be..." happened. Messages that do not
       name a field keep the "label: message" shape, since on their own they
       say nothing about where to look. */
    const raw = String(first.message || '').trim();
    const leads = raw.toLowerCase().startsWith(first.key.toLowerCase());
    const head = leads ? `${label}${raw.slice(first.key.length)}` : `${label}: ${raw}`;
    if (!rest.length) return head;
    return `${head} (and ${rest.length} other field${rest.length > 1 ? 's' : ''} on this step)`;
  };

  const refuse = async () => {
    const problems = await findMissing();
    setBlockedMsg(describeMissing(problems));
    revealField(problems[0]?.key);
  };

  const goNext = async () => {
    const valid = await formMethods.trigger();
    if (!valid) {
      await refuse();
      return;
    }

    setBlockedMsg(null);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const goPrev = () => {
    setBlockedMsg(null);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const onSubmit = (data: any) => {
    const {
      entityType,
      country,
      einIssuingCountry,
      altBusinessIdType,
      stockExchange,
      vertical,
      state,
      ...rest
    } = data || {};
    const payload = {
      ...rest,
      entityType: entityType?.value,
      country: country?.value,
      einIssuingCountry: einIssuingCountry?.value,
      altBusinessIdType: altBusinessIdType?.value,
      stockExchange: stockExchange?.value,
      state: state?.value,
      vertical: vertical?.value,
    };
    mutate(payload);
  };

  const stepLookUp = {
    [DLC_BRAND_TABS_CONST.BRAND_DETAILS]: <BrandDetails formMethods={formMethods} />,
    [DLC_BRAND_TABS_CONST.BRAND_RELATIONSHIP]: <BrandRelationship formMethods={formMethods} />,
    [DLC_BRAND_TABS_CONST.CONTACT_DETAILS]: <ContactDetails formMethods={formMethods} />,
  };

  return (
    /* Three bands, the same shell as the New webhook dialog: a header with
       eyebrow, title, one-line lede and the stepper; a scrolling body; a
       footer with the actions. */
    <div className="mcm-modal dlc-wizard">
      <div className="mcm-modal-head">
        <div className="mcm-modal-titlerow">
          <div className="min-w-0">
            <div className="mcm-modal-eyebrow">10DLC Compliance</div>
            {/* Description behind the "i", as on every other screen in this
                section -- as a standing line it cost a row of header height
                that the fields needed. */}
            <div className="flex items-center gap-2">
              <h2 className="mcm-modal-title">Create 10DLC Brand</h2>
              <CustomTooltip
                side="bottom"
                sideOffset={8}
                className="mcm-tooltip-info"
                text="The business identity carriers see before you send A2P text messages in the US."
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
        onValueChange={async (step) => {
          if (step === currentStep) return;

          /* Backwards is always free, which is what the Prev button already
             does -- validating on the way back refused to return you to a
             step you had already passed, so the tab and the button
             disagreed about the same move. */
          if (steps.indexOf(step) < currentIndex) {
            setBlockedMsg(null);
            setCurrentStep(step);
            return;
          }

          const valid = await formMethods.trigger();
          if (!valid) {
            /* Same refusal the Next button gives, scroll included -- the tab
               used to only paint the message and leave you at the top of a
               form whose problems were below the fold. */
            await refuse();
            return;
          }

          setBlockedMsg(null);
          setCurrentStep(step);
        }}
        className="flex w-full dlc-wizard-tabs"
      >
        <div className="w-full dlc-wizard-tabs-header">
          {/* A stepper, not tabs: three numbered nodes joined by a line. Done
              steps show a check and colour the line behind them red, the
              current step is the filled node, the ones ahead are grey. The
              nodes are still Radix tab triggers, so clicking a done step
              jumps back to it and clicking ahead validates first, as before. */}
          <TabsList
            className="flex w-full p-0 rounded-none bg-transparent min-h-10 dlc-wizard-tabs-list"
            aria-label="Steps"
          >
            {steps.map((step, index) => {
              const done = index < currentIndex;
              return (
                <Fragment key={step}>
                  {index > 0 && <span aria-hidden="true" className="dlc-wizard-tab-line" />}
                  <TabsTrigger
                    value={step}
                    className={`dlc-wizard-tab-trigger ${done ? 'is-done' : ''}`}
                  >
                    <span className="dlc-wizard-tab-num">
                      {done ? <Icon name="VerifiedCheck" className="h-3 w-3" /> : index + 1}
                    </span>
                    <span className="dlc-wizard-tab-label">{step}</span>
                  </TabsTrigger>
                </Fragment>
              );
            })}
          </TabsList>

          {/* The refusal belongs next to the thing that refused. It used to
              live only in the footer, ~300px below the stepper -- click a
              step you cannot reach yet, and the explanation appeared off at
              the other end of the dialog, which reads as nothing happening
              at all. */}
          {blockedMsg ? (
            <p className="dlc-wizard-blocked" role="status">
              <Icon name="InfoIcon" className="h-3.5 w-3.5 shrink-0" />
              {blockedMsg}
            </p>
          ) : null}
        </div>
      </Tabs>
      </div>

      <form onSubmit={formMethods.handleSubmit(onSubmit)} className="flex flex-col dlc-wizard-form">
        <div className="mcm-modal-body dlc-wizard-step-content">{stepLookUp[currentStep]}</div>

        <div className="mcm-modal-foot dlc-wizard-footer">
          {/* Where you are in the wizard, so Prev/Next have a frame. The
              refusal is reported up by the stepper instead. */}
          <span className="dlc-wizard-step">
            Step {currentIndex + 1} of {steps.length}
          </span>
          <Button
            variant="transparent"
            type="button"
            onClick={() => setDrawerState(false)}
            className="dlc-wizard-footer-btn"
          >
            Cancel
          </Button>

          <Button
            variant="outline"
            type="button"
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="dlc-wizard-footer-btn"
          >
            Prev
          </Button>

          {/* The step that moves you forward is the primary action, so it is
              the black pill the rest of the console uses for its main CTA.
              Both it and Prev were `outline`, which gave the row two
              identical buttons and no answer to "what do I press". */}
          {currentIndex === steps.length - 1 ? (
            <Button
              type="submit"
              variant="default"
              disabled={isPending}
              className="dlc-wizard-footer-btn dlc-wizard-footer-btn--primary"
            >
              {isPending ? 'Creating...' : 'Create brand'}
            </Button>
          ) : (
            <Button
              variant="outline"
              type="button"
              onClick={goNext}
              className="dlc-wizard-footer-btn dlc-wizard-footer-btn--primary"
            >
              Next
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};

export default Create10DLCBrand;
