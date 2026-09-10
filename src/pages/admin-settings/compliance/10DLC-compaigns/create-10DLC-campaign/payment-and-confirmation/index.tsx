import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Controller, UseFormReturn } from 'react-hook-form';

/* The line items. Kept as data so the table renders one row per entry --
   the two extra tiers the original had commented out drop straight back in
   here rather than as another copied block of divs. */
const CHARGES = [{ item: 'Application fee', price: '$20.00 upfront, one-off' }];

const PaymentAndConfirmation = ({ formInstance }: { formInstance: UseFormReturn<any> }) => {
  const {
    control,
    formState: { errors },
  } = formInstance;

  return (
    <div className="dlc-wizard-step-scroll h-full w-full overflow-auto pr-1">
      {/* The same mono section rules as the step before it. This was a bold
          heading over two grey paragraphs and a table made of bordered divs
          -- three different type treatments and no shared rhythm with the
          rest of the wizard. */}
      <div className="dlc-wizard-section">What you are agreeing to</div>
      <p className="mcm-modal-lede dlc-terms-para">
        All campaigns have a three month minimum commitment: billing is monthly, for at least three
        months. After that initial period the campaign renews month to month.
      </p>
      <p className="mcm-modal-lede dlc-terms-para">
        You are charged up to $20 as soon as the application is submitted. That charge is
        non-refundable.
      </p>

      <div className="dlc-wizard-section">Charges</div>
      <div className="dlc-costtable">
        <div className="dlc-costrow dlc-costrow--head">
          <span>Item</span>
          <span>Price</span>
        </div>
        {CHARGES.map(({ item, price }) => (
          <div className="dlc-costrow" key={item}>
            <span>{item}</span>
            <span className="dlc-costrow-price">{price}</span>
          </div>
        ))}
      </div>

      <div className="dlc-wizard-section">Confirmation</div>
      {/* The whole row is the target, not just the 16px box. */}
      <label className="dlc-agree" htmlFor="payment_terms">
        <Controller
          name="payment_terms"
          control={control}
          render={({ field }) => (
            <Checkbox id="payment_terms" checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
        <Label htmlFor="payment_terms">I agree with the payment terms above.</Label>
      </label>
      {errors?.payment_terms && (
        <p className="dlc-wizard-blocked">{`${errors?.payment_terms?.message}`}</p>
      )}
    </div>
  );
};

export default PaymentAndConfirmation;
