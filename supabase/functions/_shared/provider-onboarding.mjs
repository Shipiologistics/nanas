const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const statuses = new Set(['draft', 'submitted', 'needs_information', 'under_review', 'approved', 'rejected', 'paused', 'suspended']);

export function providerOnboardingArguments(action, payload) {
  const text = (field, min, max) => {
    const value = payload[field];
    if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw new Error(`invalid_${field}`);
    return value.trim();
  };
  const args = {p_display_name: text('display_name', 2, 80)};
  if (action === 'submit_seller_application') {
    args.p_headline = text('headline', 1, 120);
    args.p_bio = text('bio', 1, 2000);
    const years = payload.years_experience === undefined ? 0 : payload.years_experience;
    if (!Number.isInteger(years) || years < 0 || years > 80) throw new Error('invalid_years_experience');
    args.p_years_experience = years;
  } else if (action !== 'activate_seller') throw new Error('invalid_onboarding_action');
  return args;
}

export function confirmedProviderOnboarding(action, receipt, userId) {
  if (!uuid.test(userId ?? '') || !receipt || receipt.ok !== true || receipt.seller_id !== userId || !statuses.has(receipt.status)
    || (action === 'submit_seller_application' && (receipt.status !== 'under_review' || !uuid.test(receipt.verification_case_id ?? '')))) {
    throw new Error('provider_onboarding_not_confirmed');
  }
  return receipt;
}
