import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { getObjectLength } from '@/lib/utils';
import { getTermsPreview } from '@/services/api';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import TermsModal from './term.modal';
import { UseFormReturn } from 'react-hook-form';

const CarrierTermsPreview = ({ formInstance }: { formInstance: UseFormReturn<any> }) => {
  const {
    watch,
    getValues,
    setValue,
    formState: { errors },
  } = formInstance || {};

  const { usecase } = watch();
  const selectedMnoIds = watch('mnoIds') || [];
  const [open, setOpen] = useState(false);

  const handleMnoToggle = (key: string) => {
    const numericKey = Number(key);

    const current: number[] = getValues('mnoIds') || [];

    const updated = current.includes(numericKey)
      ? current.filter((id) => id !== numericKey)
      : [...current, numericKey];

    setValue('mnoIds', updated, { shouldValidate: true });
  };

  const { data: previewData } = useQuery({
    queryKey: ['getTermsPreview', usecase],
    queryFn: () =>
      getTermsPreview({
        //  brand_type?.value,
        brandId: 'BX0DJX9',
        usecase: usecase,
      }),
    select: (data) => data?.data?.data?.result?.mnoMetadata,
    enabled: Boolean(usecase),
  });

  useEffect(() => {
    if (getObjectLength(previewData)) {
      const ids = Object.keys(previewData)?.map(Number);
      setValue('mnoIds', ids, { shouldValidate: true });
      setOpen(true);
    }
  }, [previewData, setValue]);

  return (
    <div className="dlc-wizard-step-scroll h-full w-full overflow-auto pr-1">
      {/* Section rule and lede, as on the steps either side of it -- this was
          a semibold heading over a grey sentence, a third heading style in a
          four-step form. */}
      <div className="dlc-wizard-section">Carrier terms</div>
      <p className="mcm-modal-lede dlc-terms-para">
        Qualification results and terms for each mobile network operator. Untick any carrier this
        campaign should not be registered with.
      </p>

      <div className="w-full grid gap-2 mt-3">
        {errors?.mnoIds?.message ? (
          <p className="dlc-wizard-blocked">{errors?.mnoIds?.message as any}</p>
        ) : null}

        {getObjectLength(previewData) &&
          Object.entries(previewData)?.map(([key, item]: any) => {
            /* The six terms, as data. They were six copies of the same
               three-element div, which is how "Message Class" ended up
               deriving its Yes from a different expression than its
               neighbours without anything drawing attention to it. */
            const terms = [
              { label: 'Qualify', on: Boolean(item?.qualify) },
              { label: 'MNO review', on: Boolean(item?.mnoReview) },
              { label: 'TPM scope', on: Boolean(item?.tpmScope) },
              { label: 'SMS TPM', on: Boolean(item?.tpm) },
              { label: 'MMS TPM', on: Boolean(item?.mmsTpm) },
              { label: 'Message class', on: item?.msgClass !== 'N' },
            ];

            return (
              <div className="dlc-mno" key={key}>
                {/* The whole band is the target, not just the box. */}
                <label className="dlc-mno-head">
                  <Checkbox
                    checked={selectedMnoIds?.includes(Number(key))}
                    onCheckedChange={() => handleMnoToggle(key)}
                  />
                  <Label className="dlc-mno-name">{item?.mno || ''}</Label>
                </label>
                <div className="dlc-mno-terms">
                  {terms.map(({ label, on }) => (
                    <div className="dlc-mno-term" key={label}>
                      <span className="dlc-mno-term-label">{label}</span>
                      <span className={`dlc-mno-term-val ${on ? 'is-yes' : 'is-no'}`}>
                        {on ? 'Yes' : 'No'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

        {/* <div className="flex items-center w-full">
          <div className="bg-gray-100 border border-r-0 border-gray-200 p-4 rounded-l-lg h-full min-w-[172px]">
            <div className="flex items-center gap-2 whitespace-nowrap h-full">
              <Checkbox />
              <Label>T-Mobile</Label>
            </div>
          </div>
          <div className="border border-l-0 border-gray-200 p-4 rounded-r-lg w-full flex items-center justify-around gap-1  whitespace-nowrap ">
            <div className="flex items-center flex-col gap-1">
              <h3 className="text-gray-900 font-medium text-sm">Qualify</h3>
              <p className="text-gray-500 text-sm">{item?.mnoSupport ? "Yes" : "No"}</p>
            </div>
            <div className="flex items-center flex-col gap-1">
              <h3 className="text-gray-900 font-medium text-sm">MNO Review</h3>
              <p className="text-gray-500 text-sm">{item?.mnoSupport ? "Yes" : "No"}</p>
            </div>
            <div className="flex items-center flex-col gap-1">
              <h3 className="text-gray-900 font-medium text-sm">Brand Tier</h3>
              <p className="text-gray-500 text-sm">Yes</p>
            </div>
            <div className="flex items-center flex-col gap-1">
              <h3 className="text-gray-900 font-medium text-sm">Brand Daily Cap</h3>
              <p className="text-gray-500 text-sm">Yes</p>
            </div>
            <div className="flex items-center flex-col gap-1">
              <h3 className="text-gray-900 font-medium text-sm">MMS TPM</h3>
              <p className="text-gray-500 text-sm">Yes</p>
            </div>
            <div className="flex items-center flex-col gap-1">
              <h3 className="text-gray-900 font-medium text-sm">Message Class</h3>
              <p className="text-gray-500 text-sm">Yes</p>
            </div>
          </div>
        </div>

        <div className="flex items-center w-full">
          <div className="bg-gray-100 border border-r-0 border-gray-200 p-4 rounded-l-lg h-full min-w-[172px]">
            <div className="flex items-center gap-2 whitespace-nowrap h-full">
              <Checkbox />
              <Label>Verizon Wireless</Label>
            </div>
          </div>
          <div className="border border-l-0 border-gray-200 p-4 rounded-r-lg w-full flex items-center justify-around gap-1  whitespace-nowrap ">
            <div className="flex items-center flex-col gap-1">
              <h3 className="text-gray-900 font-medium text-sm">Qualify</h3>
              <p className="text-gray-500 text-sm">Yes</p>
            </div>
            <div className="flex items-center flex-col gap-1">
              <h3 className="text-gray-900 font-medium text-sm">MNO Review</h3>
              <p className="text-gray-500 text-sm">Yes</p>
            </div>
            <div className="flex items-center flex-col gap-1">
              <h3 className="text-gray-900 font-medium text-sm">TPM Scope</h3>
              <p className="text-gray-500 text-sm">Yes</p>
            </div>
            <div className="flex items-center flex-col gap-1">
              <h3 className="text-gray-900 font-medium text-sm">SMS TPM</h3>
              <p className="text-gray-500 text-sm">Yes</p>
            </div>
            <div className="flex items-center flex-col gap-1">
              <h3 className="text-gray-900 font-medium text-sm">MMS TPM</h3>
              <p className="text-gray-500 text-sm">Yes</p>
            </div>
            <div className="flex items-center flex-col gap-1">
              <h3 className="text-gray-900 font-medium text-sm">Message Class</h3>
              <p className="text-gray-500 text-sm">Yes</p>
            </div>
          </div>
        </div>

        <div className="flex items-center w-full">
          <div className="bg-gray-100 border border-r-0 border-gray-200 p-4 rounded-l-lg h-full min-w-[172px]">
            <div className="flex items-center gap-2 whitespace-nowrap h-full">
              <Checkbox />
              <Label>US Cellular</Label>
            </div>
          </div>
          <div className="border border-l-0 border-gray-200 p-4 rounded-r-lg w-full flex items-center justify-around gap-1  whitespace-nowrap ">
            <div className="flex items-center flex-col gap-1">
              <h3 className="text-gray-900 font-medium text-sm">Qualify</h3>
              <p className="text-gray-500 text-sm">Yes</p>
            </div>
            <div className="flex items-center flex-col gap-1">
              <h3 className="text-gray-900 font-medium text-sm">MNO Review</h3>
              <p className="text-gray-500 text-sm">Yes</p>
            </div>
            <div className="flex items-center flex-col gap-1">
              <h3 className="text-gray-900 font-medium text-sm">TPM Scope</h3>
              <p className="text-gray-500 text-sm">Yes</p>
            </div>
            <div className="flex items-center flex-col gap-1">
              <h3 className="text-gray-900 font-medium text-sm">SMS TPM</h3>
              <p className="text-gray-500 text-sm">Yes</p>
            </div>
            <div className="flex items-center flex-col gap-1">
              <h3 className="text-gray-900 font-medium text-sm">MMS TPM</h3>
              <p className="text-gray-500 text-sm">Yes</p>
            </div>
            <div className="flex items-center flex-col gap-1">
              <h3 className="text-gray-900 font-medium text-sm">Message Class</h3>
              <p className="text-gray-500 text-sm">Yes</p>
            </div>
          </div>
        </div>

        <div className="flex items-center w-full">
          <div className="bg-gray-100 border border-r-0 border-gray-200 p-4 rounded-l-lg h-full min-w-[172px]">
            <div className="flex items-center gap-2 whitespace-nowrap h-full">
              <Checkbox />
              <Label>ClearSKY</Label>
            </div>
          </div>
          <div className="border border-l-0 border-gray-200 p-4 rounded-r-lg w-full flex items-center justify-around gap-1  whitespace-nowrap ">
            <div className="flex items-center flex-col gap-1">
              <h3 className="text-gray-900 font-medium text-sm">Qualify</h3>
              <p className="text-gray-500 text-sm">Yes</p>
            </div>
            <div className="flex items-center flex-col gap-1">
              <h3 className="text-gray-900 font-medium text-sm">MNO Review</h3>
              <p className="text-gray-500 text-sm">Yes</p>
            </div>
            <div className="flex items-center flex-col gap-1">
              <h3 className="text-gray-900 font-medium text-sm">TPM Scope</h3>
              <p className="text-gray-500 text-sm">Yes</p>
            </div>
            <div className="flex items-center flex-col gap-1">
              <h3 className="text-gray-900 font-medium text-sm">SMS TPM</h3>
              <p className="text-gray-500 text-sm">Yes</p>
            </div>
            <div className="flex items-center flex-col gap-1">
              <h3 className="text-gray-900 font-medium text-sm">MMS TPM</h3>
              <p className="text-gray-500 text-sm">Yes</p>
            </div>
            <div className="flex items-center flex-col gap-1">
              <h3 className="text-gray-900 font-medium text-sm">Message Class</h3>
              <p className="text-gray-500 text-sm">Yes</p>
            </div>
          </div>
        </div>

        <div className="flex items-center w-full">
          <div className="bg-gray-100 border border-r-0 border-gray-200 p-4 rounded-l-lg h-full min-w-[172px]">
            <div className="flex items-center gap-2 whitespace-nowrap h-full">
              <Checkbox />
              <Label>Interop</Label>
            </div>
          </div>
          <div className="border border-l-0 border-gray-200 p-4 rounded-r-lg w-full flex items-center justify-around gap-1  whitespace-nowrap ">
            <div className="flex items-center flex-col gap-1">
              <h3 className="text-gray-900 font-medium text-sm">Qualify</h3>
              <p className="text-gray-500 text-sm">Yes</p>
            </div>
            <div className="flex items-center flex-col gap-1">
              <h3 className="text-gray-900 font-medium text-sm">MNO Review</h3>
              <p className="text-gray-500 text-sm">Yes</p>
            </div>
            <div className="flex items-center flex-col gap-1">
              <h3 className="text-gray-900 font-medium text-sm">TPM Scope</h3>
              <p className="text-gray-500 text-sm">Yes</p>
            </div>
            <div className="flex items-center flex-col gap-1">
              <h3 className="text-gray-900 font-medium text-sm">SMS TPM</h3>
              <p className="text-gray-500 text-sm">Yes</p>
            </div>
            <div className="flex items-center flex-col gap-1">
              <h3 className="text-gray-900 font-medium text-sm">MMS TPM</h3>
              <p className="text-gray-500 text-sm">Yes</p>
            </div>
            <div className="flex items-center flex-col gap-1">
              <h3 className="text-gray-900 font-medium text-sm">Message Class</h3>
              <p className="text-gray-500 text-sm">Yes</p>
            </div>
          </div>
        </div> */}
      </div>
      {/* <TableManager
        {...{
          columns,
          showPagination: false,
          customClass: 'h-full',
        }}
      /> */}

      <TermsModal
        {...{
          apiLoading: false,
          onConfirm: () => {
            setOpen(false);
          },
          confirmBtnText: 'OK',
          open,
          setOpen,
        }}
      />
    </div>
  );
};

export default CarrierTermsPreview;
