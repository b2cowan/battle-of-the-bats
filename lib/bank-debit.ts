/**
 * A bank debit's pure rules (Club Tier Stage 12c Part 5). Pure, so the landing, the pay pages and the tests answer alike.
 */

/**
 * A debit still clearing this many calendar days after it started is overdue: Stripe settles within 5 business days
 * (plan §0k), so past a week the page asks Stripe rather than trusting the record (a missed event). Not a customer word.
 */
export const DEBIT_OVERDUE_DAYS = 7;

/** The four reasons the words know (BANK_REASON_WORDS); the database refuses any other. */
export type BankReturnReason = 'insufficient_funds' | 'account_closed' | 'invalid_account' | 'not_authorized';

/**
 * The bank's failure code (a payment's `last_payment_error.code`, or a dispute's `reason`) → one of the four reasons, or
 * null when it is none of them, and the words then print no reason (words §2.3). Never a guess: an unmapped code keeps
 * its raw value in `return_detail` for the desk, not in a family's sentence.
 */
export function bankReturnReason(code: string | null | undefined): BankReturnReason | null {
  switch ((code ?? '').toLowerCase()) {
    case 'insufficient_funds':
      return 'insufficient_funds';
    case 'account_closed':
    case 'bank_account_closed':
      return 'account_closed';
    case 'no_account':
    case 'invalid_account_number':
    case 'account_number_invalid':
    case 'incorrect_account_details':
    case 'bank_account_unusable':
      return 'invalid_account';
    case 'debit_not_authorized':
    case 'not_authorized':
    case 'unauthorized':
      return 'not_authorized';
    default:
      return null;
  }
}
