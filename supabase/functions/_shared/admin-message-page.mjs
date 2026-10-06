const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const time=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
export function adminMessageArguments(payload) {
 if(!uuid(payload.conversation_id)||!uuid(payload.case_id))throw new Error('case_context_required');
 if(!['dispute-review','support-case','safety-incident','moderation-review'].includes(payload.purpose_code))throw new Error('invalid_access_purpose');
 const reason=typeof payload.reason==='string'?payload.reason.trim():'';
 if(reason.length<5||reason.length>1000)throw new Error('access_reason_required');
 const beforeId=payload.before_id??null,beforeTime=payload.before_created_at??null,limit=payload.limit??50;
 if((beforeId===null)!==(beforeTime===null)||(beforeId!==null&&(!uuid(beforeId)||!time(beforeTime))))throw new Error('invalid_message_cursor');
 if(!Number.isInteger(limit)||limit<1||limit>100)throw new Error('invalid_page_size');
 return {p_conversation_id:payload.conversation_id,p_purpose_code:payload.purpose_code,p_case_id:payload.case_id,
  p_reason:reason,p_before_created_at:beforeTime,p_before_id:beforeId,p_limit:limit};
}

export function confirmedAdminMessagePage(value,args,now=Date.now()) {
 const fail=()=>{throw new Error('message_access_unconfirmed');};
 if(!value||value.ok!==true||value.conversation_id!==args.p_conversation_id||value.case_id!==args.p_case_id
  ||value.purpose_code!==args.p_purpose_code||!uuid(value.audit_id)||!Array.isArray(value.messages)
  ||value.messages.length>args.p_limit||typeof value.has_more!=='boolean'||!time(value.access_expires_at)
  ||Date.parse(value.access_expires_at)<=now)fail();
 const seen=new Set();
 for(const row of value.messages){
  if(!row||!uuid(row.id)||seen.has(row.id)||row.conversation_id!==args.p_conversation_id||!uuid(row.sender_id)
   ||typeof row.body!=='string'||row.body.length<1||row.body.length>4000||!time(row.created_at)
   ||!['text','image','file','system'].includes(row.message_type)||!['pending','allowed','limited','removed'].includes(row.moderation_status))fail();
  seen.add(row.id);
 }
 const last=value.messages.at(-1);
 if(value.has_more){
  if(value.messages.length!==args.p_limit||!value.next_cursor||value.next_cursor.id!==last.id||value.next_cursor.created_at!==last.created_at)fail();
 }else if(value.next_cursor!==null)fail();
 return value;
}

export function adminMessageError(error) {
 const message=error&&typeof error==='object'?error.message:null;
 const errors={
  recent_authentication_required:'Sign out and sign in again, then reopen this case. A token refresh does not count as a new sign-in.',
  permission_denied:'This account needs active administrator access, message-read permission and permission for the selected case type.',
  case_context_required:'Enter the conversation and authorized case UUIDs.',
  case_conversation_unavailable:'This open case does not authorize access to the selected conversation. Check the case type and linked booking or reported message.',
  invalid_access_purpose:'Choose a supported case purpose.',
  access_reason_required:'Enter an access reason between 5 and 1,000 characters.',
  invalid_message_cursor:'This page position is no longer available. Open the latest messages again.',
  invalid_page_size:'Choose a page size between 1 and 100 messages.',
 };
 return typeof message==='string'&&Object.hasOwn(errors,message)?errors[message]:'Message access could not be confirmed. No evidence is displayed; try again or contact your administrator.';
}
