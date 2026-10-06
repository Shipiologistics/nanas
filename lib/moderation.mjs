export const moderationActions=[
 ['allow','Allow / dismiss report'],['warn','Warn account'],['limit','Limit visibility'],
 ['remove','Remove content'],['restrict','Restrict account'],['escalate','Escalate for specialist review'],
];
export function moderationActionsForTarget(type) {
 if(!['user','seller_profile','message','review'].includes(type))return [];
 return moderationActions.filter(([action])=>!(type==='user'&&['limit','remove'].includes(action))
   && !(action==='restrict'&&['message','review'].includes(type)));
}
export function moderationError(error) {
 const message=error&&typeof error==='object'?error.message:null;
 const errors={
  account_enforcement_permission_required:'Restricting an account also requires account-enforcement permission.',
  action_not_supported_for_target:'That action is not available for this kind of report.',
  moderation_target_not_found:'The reported item no longer exists. The report has not been resolved.',
  report_already_closed:'This report already has a final decision. Refresh before continuing.',
  legacy_moderation_requires_new_report:'This historical decision predates enforcement. Open a new report for a fresh action; the old record has not been changed.',
  temporary_moderation_not_supported:'Temporary moderation is not available. No action was applied.',
  self_enforcement_not_allowed:'You cannot restrict your own account.',
  invalid_reason:'Enter a reason code between 2 and 80 characters.',
 };
 return typeof message==='string'&&Object.hasOwn(errors,message)?errors[message]:'Moderation could not be confirmed. Refresh the report before retrying.';
}

export function reportContentError(error) {
 const message=error&&typeof error==='object'?error.message:null;
 const errors={
  authentication_required:'Sign in before sending a report.',
  reporting_account_unavailable:'Reporting is unavailable for this account. Contact support for help.',
  report_target_unavailable:'This item is unavailable to report. Refresh the page, or contact support about your concern.',
  invalid_target_type:'This kind of item cannot be reported here. Contact support for help.',
  invalid_reason:'Choose a report reason between 2 and 80 characters.',
  details_too_long:'Keep report details to 3,000 characters or fewer.',
 };
 return typeof message==='string'&&Object.hasOwn(errors,message)?errors[message]:'Your report could not be confirmed. Keep your details and try again.';
}

export function confirmedReportReceipt(value) {
 if(!value || value.ok!==true || typeof value.report_id!=='string'
  || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.report_id)
  || !['open','awaiting_user','awaiting_admin','escalated'].includes(value.status))
  throw new Error('report_response_unconfirmed');
 return value;
}
