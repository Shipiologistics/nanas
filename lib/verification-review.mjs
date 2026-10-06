const messages = {
  inspect_current_verification_evidence_first: "Load the current private evidence before approving. New or changed documents require a fresh review.",
  verification_evidence_not_current: "This evidence is expired, not yet valid, or has inconsistent dates. Request corrected evidence instead of approving.",
  verification_document_required: "No pending evidence is available for this decision. Refresh the case or request a new submission.",
  case_already_decided: "This case already has a final decision. Refresh to see it; a replacement needs a new review.",
  case_not_reviewable: "This case is no longer awaiting review. Refresh the verification queue.",
  use_service_credential_review: "Review this document in Service credentials so its service scope and dates are checked.",
  decision_note_required: "Enter an evidence-based reason between 5 and 2,000 characters.",
  permission_denied: "You do not have permission to review verification evidence.",
};

export function verificationReviewError(error) {
  // Supabase errors may be plain objects, not JavaScript Error instances.
  const code = error && typeof error === "object" ? error.message : null;
  return typeof code === "string" && Object.hasOwn(messages, code)
    ? messages[code] : "Verification decision could not be saved. Refresh the case and try again.";
}
