/* The red asterisk these compliance forms put on a required label.
 *
 * Three of them had grown their own identical copy, and the forms that had
 * no copy simply left required fields unmarked -- so which fields were
 * required was something you learned by pressing Next and reading the red.
 * Which fields carry it follows the form's own yup schema, nothing else.
 */
export const Req = () => (
  <span className="dlc-wizard-req" aria-hidden="true">
    *
  </span>
);

export const req = (text: string) => (
  <>
    {text}
    <Req />
  </>
);
