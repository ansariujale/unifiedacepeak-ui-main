import { CloseIcon } from '@/assets/icons';
import ErrorTooltip from '@/components/custom/error-tooltip';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Controller, useForm } from 'react-hook-form';
import PhoneInput from 'react-phone-input-2';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { resellerCreate } from '@/services/api';
import { handleAlert } from '@/lib/utils';
import { Req, req } from '@/pages/admin-settings/compliance/required-mark';

const validationSchema = yup.object().shape({
  companyName: yup.string().required('Company name is required'),
  email: yup.string().email('Invalid email').required('Email is required'),

  phone: yup.string().required('Mobile phone required').min(6, 'Phone number too short'),
});

const CreateReseller = ({
  modalOpen,
  handleClose,
  setModalOpen,
}: {
  modalOpen: boolean;
  handleClose: () => void;
  setModalOpen: (val: boolean) => void;
}) => {
  const queryClient: any = useQueryClient();

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<any>({
    defaultValues: {
      companyName: '',
      email: '',
      phone: '',
    },
    resolver: yupResolver(validationSchema),
    mode: 'onChange',
  });

  const { mutate, isPending } = useMutation({
    mutationFn: resellerCreate,
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries(['getUsersDetails'], {
        exact: true,
      });
      handleAlert({
        text: data?.data?.message,
        type: 'success',
      });
      handleClose();
    },
  });
  const onSubmit = (values: any) => {
    // API CALL HERE
    mutate(values);
  };

  return (
    <Dialog open={!!modalOpen} onOpenChange={(val) => !val && setModalOpen(false)}>
      <DialogContent
        className="w-[calc(100vw_-_2rem)] max-w-xl p-0"
        showCloseButton={false}
      >
        {/* The wizard's own head/body/foot shell. This was a semibold line of
            text over a bare two-column grid and a red Submit -- the only
            dialog in the flow that did not look like the flow. `dlc-wizard`
            also carries the field styling and the flattened phone control,
            which the modal was missing entirely. */}
        <div className="mcm-modal dlc-wizard">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="mcm-modal-head">
              <div className="mcm-modal-titlerow">
                <div className="min-w-0">
                  <div className="mcm-modal-eyebrow">10DLC Compliance</div>
                  <h2 className="mcm-modal-title">Reseller Details</h2>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="mcm-modal-close"
                  aria-label="Close"
                >
                  <CloseIcon className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="mcm-modal-body">
              <div className="grid grid-cols-1 sm:grid-cols-2 w-full gap-x-4 gap-y-5">
                <Input
                  label={req('Legal company name')}
                  placeholder="Enter legal company name"
                  {...register('companyName')}
                  error={errors?.companyName?.message}
                />

                <Input
                  label={req('Email')}
                  placeholder="name@company.com"
                  {...register('email')}
                  error={errors?.email?.message}
                />

                {/* PHONE INPUT FIELD */}
                <div className="flex flex-col gap-1.5 w-full">
                  <div className="flex items-center justify-between">
                    <Label>
                      Mobile phone
                      <Req />
                    </Label>

                    <div className="flex items-start">
                      {errors?.phone?.message && <ErrorTooltip text={errors?.phone?.message} />}
                    </div>
                  </div>

                  <div className="flex gap-1">
                    <Controller
                      name="phone"
                      control={control}
                      render={({ field }) => (
                        <PhoneInput
                          {...field}
                          country={'us'}
                          countryCodeEditable={false}
                          containerClass={errors?.phone?.message ? 'phone-error' : ''}
                          onChange={(value) => field.onChange(value)}
                        />
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mcm-modal-foot dlc-wizard-footer">
              <Button
                variant="transparent"
                type="button"
                onClick={handleClose}
                className="dlc-wizard-footer-btn shrink-0"
              >
                Cancel
              </Button>

              <Button
                variant="outline"
                type="submit"
                disabled={isPending}
                className="dlc-wizard-footer-btn dlc-wizard-footer-btn--primary shrink-0"
              >
                {isPending ? 'Adding...' : 'Add reseller'}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateReseller;
