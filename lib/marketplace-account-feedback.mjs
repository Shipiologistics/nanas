/** Translate only authoritative account-guard errors, never guesses from an
 * HTTP status or another person's private restriction reason. */
export function marketplaceAccountFeedback(error) {
  const message = error && typeof error === 'object' && typeof error.message === 'string' ? error.message : '';
  if (message === 'account_new_activity_restricted') {
    return 'Your account cannot start new requests, quotes, bookings or purchases right now. No new purchase was completed. Contact support for help with your account or existing bookings.';
  }
  if (message === 'marketplace_account_unavailable') {
    return 'This request or provider is no longer available for a new booking or purchase. No new purchase was completed. Choose another option or contact support.';
  }
  return null;
}
