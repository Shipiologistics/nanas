export function providerEligibilityFeedback(error, action) {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  if (['provider_service_requirements_not_met','seller_not_eligible','seller_not_eligible_for_service_area'].includes(message)) {
    return action === 'quote'
      ? 'Your provider account, service coverage or required credentials are not currently eligible for this service. Check your profile and verification records before quoting.'
      : 'This provider no longer meets the requirements for this service. No booking or payment was created. Choose another eligible provider or contact support.';
  }
  if (message === 'interaction_blocked') return 'This interaction is unavailable because one of the participants has blocked the other. No new booking or payment was created.';
  return message || (action === 'quote' ? 'Quote failed. Please try again.' : 'Payment simulation failed. Please try again.');
}
