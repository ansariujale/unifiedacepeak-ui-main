import { yupResolver } from '@hookform/resolvers/yup';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CloseIcon } from '@/assets/icons';
import { DialogDescription } from '@/components/ui/dialog';
import { initialState, validationSchema, webhookEventTypes } from '../../constant';
import { useEffect } from 'react';
import CustomSelect from '@/components/custom/custom-select';

const AddPathModal = ({
  handleClose,
  editForm,
}: {
  handleClose: () => void;
  editForm: { isEdit: boolean; formData: any };
}) => {
  const { isEdit = false, formData = {} } = editForm || {};

  const formInstance = useForm<any>({
    defaultValues: initialState,
    resolver: yupResolver(validationSchema),
    mode: 'onSubmit',
  });
  const {
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = formInstance;

  // const { mutateAsync: hubspotCRMMutation, isPending } = useMutation({
  //   mutationKey: ['crmIntegration'],
  //   mutationFn: hubspotCRM,
  // });
  useEffect(() => {
    if (isEdit) {
      const { type, path } = formData || {};
      /* `reset` takes one object of values; this was called as
         `reset(type, path)` with two strings, so edit mode never populated
         the form. Unreachable until the row action existed, so it never
         surfaced. */
      reset({ type, path });
    } else {
      reset(initialState);
    }
  }, [isEdit, formData, reset]);

  const onSubmit = async (values: { path: string; type: string }) => {
    return values;
  };

  return (
    <form className="mcm-modal" onSubmit={handleSubmit(onSubmit)}>
      {/* Title and the one-line explanation sit together in a header band,
          separated from the fields by a rule. They used to be two loose
          paragraphs stacked above the first label, so the dialog opened with
          three lines of grey text and no structure. */}
      <div className="mcm-modal-head">
        <div className="mcm-modal-titlerow">
          {/* The dialog is reused for editing and still said "Add". */}
          <h2 className="mcm-modal-title">{isEdit ? 'Edit webhook' : 'New webhook'}</h2>
          <button type="button" onClick={handleClose} className="mcm-modal-close" aria-label="Close">
            <CloseIcon className="w-3 h-3" />
          </button>
        </div>
        <p className="mcm-modal-lede">
          We&apos;ll send a POST request to your URL each time the event you pick happens.
        </p>
      </div>
      {/* asChild: DialogDescription renders a <p>, and the fields inside it
          are <div>s — invalid nesting that React reported as a hydration
          error. This keeps the aria wiring while emitting a <div>. */}
      <DialogDescription asChild>
        <div className="mcm-modal-body">
          {/* The select's own border and outline are pinned by !important
              rules (ours in a layer, react-select's emotion class outside
              one), so the accent focus ring is drawn on this wrapper. */}
          <div className="w-full mcm-selectring">
            <CustomSelect
              inputClass="mcm-select"
              label={'Event'}
              options={webhookEventTypes}
              handleChange={(e) => setValue(`type`, e)}
              value={watch('type')}
              placeholder="Choose an event"
              error={(errors.type?.message as string) || undefined}
            />
          </div>
          <div className="w-full">
            <Input
              label="Endpoint URL"
              {...register('path')}
              placeholder="https://hooks.example.com/webhooks/calls"
              error={errors?.path?.message}
              /* The shared Input focuses to `--primary` (the tenant colour);
                 this dialog follows the console accent like the select above. */
              className="hover:border-[#dc2626] focus:border-[#dc2626]"
            />
            {/* Only shown while the field is valid — an error message and a
                hint stacked together is two things shouting at once. */}
            {!errors?.path?.message ? (
              <p className="mcm-modal-hint">
                Must be a public HTTPS address we can reach. Include the full path.
              </p>
            ) : null}
          </div>
        </div>
      </DialogDescription>
      <div className="mcm-modal-foot">
        <Button variant={'transparent'} onClick={handleClose} type="button">
          Cancel
        </Button>
        <Button
          variant={'primary'}
          type="submit"
          /* acepeak's black CTA (#171717) — the primary variant is the tenant
             colour, and this dialog portals outside the page scope that
             carries the black override. */
          className="border-[#171717] bg-[#171717] hover:border-[#2e2e2e] hover:bg-[#2e2e2e]"
        >
          {/* {isPending ? 'Loading...' : 'Submit'} */}
          {isEdit ? 'Save changes' : 'Create webhook'}
        </Button>
      </div>
    </form>
  );
};

export default AddPathModal;
