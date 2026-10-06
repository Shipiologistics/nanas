import test from 'node:test';
import assert from 'node:assert/strict';
import {providerEligibilityFeedback} from '../lib/provider-eligibility-feedback.mjs';
test('plain PostgREST eligibility errors explain provider action and no-payment outcome',()=>{
  const error={code:'P0001',message:'provider_service_requirements_not_met'};
  assert.match(providerEligibilityFeedback(error,'quote'),/required credentials/);
  assert.match(providerEligibilityFeedback(error,'accept'),/No booking or payment was created/);
  assert.doesNotMatch(providerEligibilityFeedback(error,'accept'),/rn_license/);
  assert.match(providerEligibilityFeedback({message:'seller_not_eligible'},'quote'),/required credentials/);
});
test('eligibility feedback preserves other errors and handles absent errors',()=>{
  assert.match(providerEligibilityFeedback({message:'interaction_blocked'},'accept'),/blocked/);
  assert.equal(providerEligibilityFeedback(new Error('Network unavailable'),'quote'),'Network unavailable');
  assert.match(providerEligibilityFeedback(null,'quote'),/Quote failed/);
});
