import { Controller, UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import CustomSelect from '@/components/custom/custom-select';
import { entityTypes, stockExchangeArr, usStates, verticalArr } from '../../constant';
import { getObjectLength } from '@/lib/utils';
import PhoneInput from 'react-phone-input-2';
import { Label } from '@/components/ui/label';
import ErrorTooltip from '@/components/custom/error-tooltip';
import { Req, req } from '@/pages/admin-settings/compliance/required-mark';

/* Same treatment the create-brand form gives its own enum values: split the
   underscore, title-case. PRIVATE_PROFIT read as a database constant. */
const prettyEnum = (value: string) =>
  value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const BrandDetails = ({ formMethods }: { formMethods: UseFormReturn<any> }) => {
  const {
    setValue,
    register,
    control,
    watch,
    formState: { errors },
  } = formMethods;

  const [wAltBusinessIdType, wCountry, wEntityType] = watch([
    'altBusinessIdType',
    'country',
    'entityType',
  ]);

  const entityTypeValue = wEntityType?.value;
  const isSoleProprietor = entityTypeValue === 'SOLE_PROPRIETOR';
  const isPublicProfit = entityTypeValue === 'PUBLIC_PROFIT';
  const altIdKind = getObjectLength(wAltBusinessIdType) ? wAltBusinessIdType?.value : '';

  return (
    <div className="flex flex-col gap-2 h-[calc(100vh_-_16rem)] overflow-auto pr-1 dlc-wizard-step-scroll">
      {/* Four short groups instead of one eighteen-field grid. Every field,
          condition and handler is unchanged -- only the order and the headings
          are new. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 w-full gap-x-4 gap-y-5">
        <div className="dlc-wizard-section">Company</div>

        <Controller
          name="companyName"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              label={req('Legal company name')}
              placeholder="Enter legal company name"
              onChange={(e) => {
                field.onChange(e.target.value);
                setValue('displayName', e.target.value, { shouldValidate: true });
              }}
              error={errors?.companyName?.message}
            />
          )}
        />

        <Input
          label={req('DBA or brand name')}
          placeholder="Enter DBA or brand name"
          {...register('displayName')}
          error={errors?.displayName?.message}
        />

        <Controller
          name="entityType"
          control={control}
          render={({ field }) => (
            <CustomSelect
              inputClass="mcm-select"
              label={req('Legal form of the organisation')}
              placeholder="Select an entity"
              value={field.value}
              handleChange={(v) => {
                field.onChange(v);
                const newEntityType = v?.value;

                // Clear PUBLIC_PROFIT specific fields if not PUBLIC_PROFIT
                if (newEntityType !== 'PUBLIC_PROFIT') {
                  setValue('stockSymbol', '');
                  setValue('stockExchange', null);
                }

                // Clear SOLE_PROPRIETOR specific fields if not SOLE_PROPRIETOR
                if (newEntityType !== 'SOLE_PROPRIETOR') {
                  setValue('firstName', '');
                  setValue('lastName', '');
                  setValue('mobilePhone', '');
                }

                // Clear non-SOLE_PROPRIETOR fields if SOLE_PROPRIETOR
                if (newEntityType === 'SOLE_PROPRIETOR') {
                  setValue('companyName', '');
                  setValue('ein', '');
                  setValue('einIssuingCountry', null);
                }
              }}
              options={entityTypes.map((v) => ({ value: v, label: prettyEnum(v) }))}
              error={errors?.entityType?.message}
            />
          )}
        />

        <Controller
          name="country"
          control={control}
          render={({ field }) => (
            <CustomSelect
              inputClass="mcm-select"
              label={req('Country of registration')}
              placeholder="Select a country"
              value={field.value}
              handleChange={(v) => {
                field.onChange(v);
                setValue('einIssuingCountry', v);
              }}
              options={[{ value: 'US', label: 'United States' }]}
              error={errors?.country?.message}
            />
          )}
        />

        {isSoleProprietor && (
          <>
            <Input
              label={req('First name')}
              {...register('firstName')}
              error={errors?.firstName?.message}
            />
            <Input
              label={req('Last name')}
              {...register('lastName')}
              error={errors?.lastName?.message}
            />
            <div className="flex flex-col gap-1.5 w-full">
              <div className="flex items-center justify-between">
                <Label>
                  Mobile phone
                  <Req />
                  <span className="ml-1 font-normal text-gray-500">(for OTP)</span>
                </Label>
                <div className="flex items-start ">
                  {errors?.mobilePhone?.message && (
                    <ErrorTooltip text={errors?.mobilePhone?.message} />
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <Controller
                  name="mobilePhone"
                  control={control}
                  render={({ field }) => (
                    <PhoneInput
                      {...field}
                      country={'us'}
                      countryCodeEditable={false}
                      containerClass={errors?.mobilePhone?.message ? 'phone-error' : ''}
                    />
                  )}
                />
              </div>
            </div>
          </>
        )}

        <div className="dlc-wizard-section">Tax &amp; identifiers</div>

        {!isSoleProprietor && (
          <>
            {/* Text, not number. An EIN is written 12-3456789, and a number
                input refuses the hyphen -- worse, a number input holding a
                value the browser considers invalid reports an empty string,
                so a correctly typed EIN registered as a missing field and
                the step could never be completed. The schema wants a 9-21
                character string, which is what this now provides. */}
            <Input
              label={req('Tax number / EIN')}
              placeholder="12-3456789"
              inputMode="numeric"
              {...register('ein')}
              error={errors?.ein?.message}
              type="text"
            />

            <Controller
              name="einIssuingCountry"
              control={control}
              render={({ field }) => (
                <CustomSelect
                  inputClass="mcm-select"
                  label="EIN issuing country"
                  placeholder="Select issuing country"
                  value={field.value}
                  handleChange={field.onChange}
                  options={[{ value: 'US', label: 'United States' }]}
                  error={errors?.einIssuingCountry?.message}
                />
              )}
            />
          </>
        )}

        <Controller
          name="altBusinessIdType"
          control={control}
          render={({ field }) => (
            <CustomSelect
              inputClass="mcm-select"
              label="DUNS, GIIN or LEI"
              placeholder="Select option"
              value={field.value}
              handleChange={field.onChange}
              options={[
                { value: 'DUNS', label: 'DUNS' },
                { value: 'GIIN', label: 'GIIN' },
                { value: 'LEI', label: 'LEI' },
              ]}
              error={errors?.altBusinessIdType?.message}
            />
          )}
        />

        {/* Required only once a type is chosen (schema), and the label says
            which -- it used to read as a bare " Number" until then. */}
        {/* Also text: of the three types this field accepts, only DUNS is
            digits. A GIIN is written 98Q96B.00000.LE.250 and an LEI is 20
            alphanumeric characters, neither of which a number input will
            take. */}
        <Input
          label={altIdKind ? req(`${altIdKind} number`) : 'ID number'}
          placeholder={altIdKind ? `Enter ${altIdKind} number` : 'Choose a type first'}
          {...register('altBusinessId')}
          type="text"
          error={errors?.altBusinessId?.message}
        />

        <Input
          label={isSoleProprietor ? req('Reference ID') : 'Reference ID'}
          placeholder="Enter reference ID"
          {...register('referenceId')}
          error={errors?.referenceId?.message}
        />

        <div className="dlc-wizard-section">Address</div>

        <Input
          label={req('Street address')}
          placeholder="Enter street address"
          {...register('street')}
          error={errors?.street?.message}
        />

        <Input
          label={req('City')}
          placeholder="Enter city"
          {...register('city')}
          error={errors?.city?.message}
        />

        <Controller
          name="state"
          control={control}
          render={({ field }) => (
            <CustomSelect
              inputClass="mcm-select"
              label={req('State')}
              placeholder="Select state"
              value={field.value}
              handleChange={field.onChange}
              options={Object?.entries(usStates)?.map((v) => ({
                value: v[0],
                label: v[1],
              }))}
              error={errors?.state?.message}
            />
          )}
        />

        <Input
          label={req('ZIP code')}
          placeholder="12345 or 12345-6789"
          {...register('postalCode')}
          error={errors?.postalCode?.message}
        />

        <Input label="Country" value={wCountry?.label} disabled error={errors?.country?.message} />

        <div className="dlc-wizard-section">Online presence</div>

        <Input
          label={isPublicProfit ? req('Website') : 'Website'}
          placeholder="Enter website URL"
          {...register('website')}
          error={errors?.website?.message}
        />

        {/* Only a publicly traded company has these, so they appear only for
            PUBLIC_PROFIT rather than sitting there greyed out. Shown but
            disabled, they read as broken fields -- nothing on screen said
            they were waiting on the entity type. Hiding them is also what
            this form already does for the sole-proprietor and EIN fields. */}
        {isPublicProfit && (
          <>
            <Controller
              name="stockExchange"
              control={control}
              render={({ field }) => (
                <CustomSelect
                  inputClass="mcm-select"
                  label={req('Stock exchange')}
                  placeholder="Select stock exchange"
                  value={field.value}
                  handleChange={field.onChange}
                  options={stockExchangeArr.map((v) => ({ label: v, value: v }))}
                  error={errors?.stockExchange?.message}
                />
              )}
            />

            <Input
              label={req('Stock symbol')}
              placeholder="Enter stock symbol"
              {...register('stockSymbol')}
              error={errors?.stockSymbol?.message}
            />
          </>
        )}

        {!isSoleProprietor && (
          <Controller
            name="vertical"
            control={control}
            render={({ field }) => (
              <CustomSelect
                inputClass="mcm-select"
                label={req('Vertical')}
                placeholder="Select"
                value={field.value}
                handleChange={field.onChange}
                options={verticalArr}
                error={errors?.vertical?.message}
              />
            )}
          />
        )}
      </div>
    </div>
  );
};

export default BrandDetails;
