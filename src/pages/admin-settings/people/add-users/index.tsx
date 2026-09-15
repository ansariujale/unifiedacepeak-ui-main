import { useRef, useState, type FC } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { formInitialState } from '../../constants';
import AddUserInfo from './add-user-info';
import SetupOption from './setup-options';
import { Ic } from '@/components/mcm/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addMember } from '@/services/api';
import Loader from '@/components/custom/loader';
import { useUser } from '@/hooks/use-user';
import {
  passwordValidationSchema,
  schemaValidationForAddIndividualPassword,
  schemaValidationForAddUser,
} from './schema';
import { yupResolver } from '@hookform/resolvers/yup';
import AlertConfirm from '@/components/custom/alert-confirm';
import MultipleAssignNumber from './multiple-assign-number';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useGetMyPlanDetails } from '@/hooks/common';
import { invalidateGlobalUsersDirectory } from '@/lib/invalidate-global-users-directory';
import { handleAlert } from '@/lib/utils';
import { TriangleAlert, UserPlus } from 'lucide-react';
import '@/components/mcm/wizard-shell.css';

interface AddUsersProps {
  setDrawerState: (state: boolean) => void;
  onReset?: () => void;
}

const AddUsers: FC<AddUsersProps> = ({ setDrawerState, onReset }) => {
  const { data: dataGetMyPlanDetails } = useGetMyPlanDetails();
  const { user, refetch: refetchUserApi } = useUser();

  const [isPaymentRequired, setIspaymentRequired] = useState<any>(false);
  const [orderSummary, setOrderSummary] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [typeOfPassword, setTypeOfPassword] = useState('email');
  const [isUserValidatorError, setIsUserValidatorError] = useState(false);
  const [alertAssignNumber, setAlertAssignNumber] = useState(false);
  const [showAssignNumber, setShowAssignNumber] = useState(false);
  const [newUsers, setNewUsers] = useState([]);

  const [status, setStatus] = useState('');
  const queryClient: any = useQueryClient();
  const paymentRef = useRef<any>(null);
  const paymentData = useRef<any>(null);
  const addUserInfoRef = useRef<any>(null);

  const [paymentCalculation, setPaymentCalculation] = useState<{
    total_amount: number;
    tax_calculation_id: string | null;
  } | null>(null);

  const { mutate: mutateAddMember, isPending: isPendingAddMember } = useMutation({
    mutationFn: addMember,
    onSuccess: ({ data }) => {
      if (data?.data?.result?.requires_action) {
        paymentRef.current.handle3DSPayment(data?.data?.result?.client_secret);
        return;
      }

      handleSuccess(data);
    },
    onError: (error: any) => {
      /* The API refuses to create users when the company has no licence left,
         even if this screen believed the seats were free. Without this the
         admin is dead-ended: the payment step only renders once payment is
         already known to be required. Open it instead of failing silently. */
      const response = error?.response;
      const body = response?.data || {};
      const errorCode = String(body?.code || body?.error_code || body?.data?.code || '');
      const errorMessage = String(body?.message || '');
      const needsPayment =
        response?.status === 402 ||
        errorCode.toUpperCase() === 'PAYMENT_REQUIRED' ||
        /payment[\s_-]*required/i.test(errorMessage);

      // Anything else already surfaces through the shared axios error toast.
      if (!needsPayment) return;

      paymentRef.current?.resetPaymentState();
      paymentData.current = null;
      setIspaymentRequired(true);
      setOrderSummary((prev: any) => {
        const watchUserLength = watchUsers?.length || 0;
        return {
          ...(prev || {}),
          watchUserLength,
          availableLicenses: prev?.availableLicenses ?? 0,
          totalPayableUnit: prev?.totalPayableUnit || watchUserLength,
        };
      });
      setCurrentStep(2);
      setStatus('show_payment');
    },
  });

  const handleSuccess = (data: any) => {
    paymentRef.current?.resetPaymentState();
    paymentData.current = null;
    setStatus('');
    setPaymentCalculation(null);
    queryClient.invalidateQueries(['fetchUsersList'], { exact: true });
    queryClient.invalidateQueries(['getMyPlanDetails'], { exact: true });
    /* Directory > People reads a differently-keyed query ('directoryPeople')
       than the shared USER_QUERY_KEYS.directoryAll invalidated below, so a
       newly added user never showed up there without also invalidating it
       directly. */
    queryClient.invalidateQueries({ queryKey: ['directoryPeople'] });
    invalidateGlobalUsersDirectory(queryClient);

    refetchUserApi();
    handleAlert({
      text: data?.data?.message || 'Member created successfully',
      type: 'success',
    });

    const users = data?.data?.result?.createdUsers || [];
    if (users?.length > 0) {
      setAlertAssignNumber(true);
      setNewUsers(users);
    }
  };

  const getResolver = (currentStep: any, typeOfPassword: any) => {
    if (currentStep === 1) {
      return yupResolver(schemaValidationForAddUser);
    }

    if (currentStep === 2) {
      if (typeOfPassword === 'common') {
        return yupResolver(passwordValidationSchema);
      }

      if (typeOfPassword === 'individual') {
        return yupResolver(schemaValidationForAddIndividualPassword);
      }
    }
    return undefined;
  };

  const formInstance = useForm<any>({
    defaultValues: formInitialState,
    resolver: getResolver(currentStep, typeOfPassword),
    mode: 'onChange',
  });

  const { handleSubmit, watch } = formInstance;

  const [watchPasswordType, watchPassword, watchUsers, watchSite] = watch([
    'password_type',
    'password',
    'users',
    'site',
  ]);

  /* Named for what you are answering on each one, not for what the form does
     with it — "Setup Options" said nothing about passwords or invite links. */
  const StepContent = [
    {
      number: 1,
      title: 'The people',
      description: 'Names, roles and extensions',
    },
    {
      number: 2,
      title: 'How they sign in',
      description: 'An invite link, or a password you set',
    },
  ];
  const activeStep = StepContent.find((step) => step.number === currentStep) || StepContent[0];

  const onSubmit = (data: any) => {
    const { password_type, users, site } = data || {};

    if (currentStep === 1) {
      setCurrentStep((p) => p + 1);
    } else {
      if (isPaymentRequired) {
        setStatus('show_payment');
      } else {
        mutateAddMember({
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          users: users?.map(({ confirm_password, password, role, ...item }: any) => ({
            ...item,
            /* The name, not the id. `value` is always a uuid (role_uuid, or the
                   custom role's uuid), and sending it here wrote a uuid into
                   users.role — the display-name column. Every guard that compares
                   that column to "ADMIN", "MANAGER" or "AGENT" then silently
                   stopped working, including the one that prevents an
                   administrator being deleted. The role ids still travel
                   separately as role_uuid / custom_role_uuid. */
            role: role?.label,
            password: password_type === 'common' ? data?.password : password,
          })),
          site_uuid: site?.value,
        });
      }
    }
  };

  const onSuccessPayment = (paymentMethod: any) => {
    // const planCost = dataGetMyPlanDetails?.current_plan_details?.discount_enabled
    //   ? dataGetMyPlanDetails?.current_plan_details?.discount_price
    //   : dataGetMyPlanDetails?.current_plan_details?.original_price;
    // const proratedCost = getLicenseCalculatedPlanCost({
    //   planCost,
    //   plan_expiration_date: dataGetMyPlanDetails?.current_plan_details?.plan_expiration_date,
    // });
    // const available =
    //   (dataGetMyPlanDetails?.license_detail?.free_licenses || 0) +
    //   (dataGetMyPlanDetails?.license_detail?.free_revoked_licenses || 0);

    // const totalAmountPayable = (watchUsers?.length - available) * +proratedCost;

    // const taxPercentage = Number(
    //   dataGetMyPlanDetails?.last_billing?.tax_detail?.tax_percentage ?? 0,
    // );

    // const totalTax = (taxPercentage * (totalAmountPayable ?? 0)) / 100;

    const payload = {
      payment: {
        amount: paymentCalculation?.total_amount,
        tax_calculation_id: paymentCalculation?.tax_calculation_id,
        payment_method_id: paymentMethod?.id || paymentMethod?.payment_method_id,
        save: paymentMethod?.isSavedCard,
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      users: watchUsers?.map(({ confirm_password, role, password, ...item }: any) => ({
        ...item,
        /* The name, not the id. `value` is always a uuid (role_uuid, or the
                   custom role's uuid), and sending it here wrote a uuid into
                   users.role — the display-name column. Every guard that compares
                   that column to "ADMIN", "MANAGER" or "AGENT" then silently
                   stopped working, including the one that prevents an
                   administrator being deleted. The role ids still travel
                   separately as role_uuid / custom_role_uuid. */
        role: role?.label,
        password: watchPasswordType === 'common' ? watchPassword : password,
      })),
      site_uuid: watchSite?.value,
    };

    paymentMethod.setLoader(false);
    mutateAddMember(payload);

    paymentData.current = payload;
  };

  const handle3DSSuccess = () => {
    mutateAddMember({
      ...paymentData?.current,
      payment: {
        ...paymentData?.current?.payment,
        status: 'confirmed',
      },
    });
    paymentData.current = null;
  };

  const handle3DSFailure = () => {
    paymentData.current = null;
    setStatus('');
  };

  const stepLookUp: any = {
    1: (
      <AddUserInfo
        ref={addUserInfoRef}
        {...{
          setIspaymentRequired,
          setOrderSummary,
          setIsUserValidatorError,
          dataGetMyPlanDetails,
          setPaymentCalculation,
        }}
      />
    ),
    2: (
      <SetupOption
        {...{
          isPaymentRequired,
          orderSummary,
          status,
          dataGetMyPlanDetails,
          setPaymentCalculation,
          paymentProps: {
            onSuccessPayment,
            paymentRef,
            isApiLoad: isPendingAddMember,
            handle3DSSuccess,
            handle3DSFailure,
          },
          setTypeOfPassword,
        }}
      />
    ),
  };
  return (
    <>
      <FormProvider {...formInstance}>
        <div className="mcm-page mcm-invite wz-shell">
          <header className="wz-head">
            <span className="wz-head-mark" aria-hidden="true">
              <UserPlus />
            </span>
            <div className="min-w-0">
              <h2 className="wz-head-title">Invite people</h2>
              <p className="wz-head-sub">
                {user?.company_info?.name
                  ? `Add teammates to ${user.company_info.name}`
                  : 'Add teammates to your company'}
              </p>
            </div>
          </header>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="wz-body">
              <aside className="wz-rail">
                <ol className="wz-steps">
                  {StepContent.map((step) => {
                    const isOn = currentStep === step.number;
                    const isDone = step.number < currentStep;
                    return (
                      <li key={step.number}>
                        <button
                          type="button"
                          onClick={() => isDone && setCurrentStep(step.number)}
                          className={`wz-step${isOn ? ' is-on' : ''}${isDone ? ' is-done' : ''}`}
                          aria-current={isOn ? 'step' : undefined}
                        >
                          <span className="wz-step-n">{step.number}</span>
                          <span className="min-w-0">
                            <span className="wz-step-t">{step.title}</span>
                            <span className="wz-step-d">{step.description}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>

                {/* What submitting this form actually does to the account —
                    how many people, how many of them are covered by licences
                    already held, and what the rest costs. */}
                <div className="wz-summary">
                  <p className="wz-summary-k">This invite</p>
                  <div className="wz-summary-row">
                    People <b>{watchUsers?.length || 0}</b>
                  </div>
                  <div className="wz-summary-row">
                    Licences you hold <b>{orderSummary?.availableLicenses ?? 0}</b>
                  </div>
                  <div className="wz-summary-row">
                    New to buy <b>{orderSummary?.totalPayableUnit ?? 0}</b>
                  </div>
                  <div className="wz-summary-row wz-summary-total">
                    Added to your bill <b>${paymentCalculation?.total_amount ?? 0}</b>
                  </div>
                  {isPaymentRequired && (orderSummary?.totalPayableUnit ?? 0) > 0 ? (
                    <p className="wz-summary-note">
                      <TriangleAlert aria-hidden="true" />
                      Taken when you submit.
                    </p>
                  ) : null}
                </div>
              </aside>

              <main className="wz-main">
                <h3 className="wz-section-t">{activeStep.title}</h3>
                <p className="wz-section-d">{activeStep.description}</p>
                {stepLookUp?.[currentStep]}
              </main>
            </div>

            <div className="wz-foot">
              {onReset ? (
                <button type="button" className="wz-btn wz-btn--ghost" onClick={onReset}>
                  <Ic n="refresh" size={13} />
                  Reset
                </button>
              ) : null}
              <div className="wz-foot-end">
                <button
                  onClick={() => {
                    if (currentStep === 1) {
                      setDrawerState(false);
                    } else {
                      setCurrentStep((prev) => prev - 1);
                    }
                    setStatus('');
                  }}
                  type="button"
                  className="wz-btn wz-btn--ghost"
                >
                  {currentStep === 1 ? 'Cancel' : 'Back'}
                </button>
                {status !== 'show_payment' && (
                  <button
                    type="submit"
                    onClick={() => {
                      /* "Add User" opens a fresh blank row for a second person,
                         on the assumption more are coming. When they are not,
                         that blank row still has to pass the same required-field
                         schema as a real one — so Continue silently refused to
                         advance and it looked like the form was looping back to
                         "add a user" forever. One filled-in row is enough to
                         continue; drop a trailing row nobody has touched instead
                         of demanding it be filled in or deleted by hand.

                         Goes through AddUserInfo's own field-array `remove`
                         (not a plain setValue on `users`) — react-hook-form
                         keeps a ref registry for uncontrolled inputs per array
                         index, and shrinking the array any other way left that
                         registry out of sync, so the next person added at the
                         same index inherited the removed row's stale values
                         (passwords included) instead of starting blank. */
                      if (currentStep === 1) {
                        addUserInfoRef.current?.pruneTrailingBlankRow?.();
                      }
                    }}
                    disabled={isPendingAddMember || isUserValidatorError}
                    className="wz-btn wz-btn--primary"
                  >
                    {isPendingAddMember ? (
                      /* white, not `blue`: this button is filled with the
                         accent now, and a --primary spinner can vanish into it
                         on tenants whose brand colour is close to it. */
                      <Loader variant="white" />
                    ) : currentStep === 2 ? (
                      'Submit'
                    ) : (
                      'Continue'
                    )}
                  </button>
                )}
              </div>
            </div>
          </form>

          <AlertConfirm
            {...{
              apiLoading: false,
              onConfirm: () => {
                setShowAssignNumber(true);
                setAlertAssignNumber(false);
                // setDrawerState(false);
              },
              onCancel: () => {
                setDrawerState(false);
              },
              onClose: () => {
                setDrawerState(false);
              },
              open: alertAssignNumber,
              setOpen: setAlertAssignNumber,
              singleButton: true,
              singleButtonText: 'Go Now',
              singleButtonHandler: () => {
                setDrawerState(false);
              },
              descriptionTextComp: (
                <div className=" text-md">
                  Member created successfully. Please go to Extensions to assign the DID number.
                </div>
              ),
              closeBtnText: 'Assign Later',
              confirmBtnText: 'Assign Now',
            }}
          />
        </div>
      </FormProvider>
      {showAssignNumber && (
        <Dialog open={showAssignNumber} onOpenChange={setShowAssignNumber}>
          <DialogContent
            className="md:w-3/6 p-3 max-h-[99%] overflow-y-auto w-full"
            showCloseButton={false}
            onEscapeKeyDown={(e) => e.preventDefault()}
            onPointerDownOutside={(e) => e.preventDefault()}
          >
            <MultipleAssignNumber
              {...{
                users: newUsers,
                handleClose: () => {
                  setShowAssignNumber(false);
                  setDrawerState(false);
                },
                showAssignNumber,
                setShowAssignNumber,
              }}
            />
          </DialogContent>
        </Dialog>
      )}
      {/* {showAssignNumber && (
        <SideDrawer
          isOpen={showAssignNumber}
          handleClose={() => setShowAssignNumber(false)}
          isHeader={true}
          width="45%"
          content={
            <MultipleAssignNumber
              {...{
                users: newUsers,
                handleClose: () => {
                  setShowAssignNumber(false);
                  setDrawerState(false);
                },
                showAssignNumber,
                setShowAssignNumber,
              }}
            />
          }
        />
      )} */}
    </>
  );
};

export default AddUsers;
