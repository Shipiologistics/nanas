const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const date=/^(\d{4})-(\d{2})-(\d{2})$/;
const validDate=value=>{const match=typeof value==='string'&&value.match(date);if(!match)return false;const [year,month,day]=match.slice(1).map(Number);const parsed=new Date(Date.UTC(year,month-1,day));return parsed.getUTCFullYear()===year&&parsed.getUTCMonth()===month-1&&parsed.getUTCDate()===day;};
export function householdMemberArguments(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('invalid_household_member');
 const member=payload.member_id===undefined||payload.member_id===null?null:payload.member_id;
 if(member!==null&&(typeof member!=='string'||!uuid.test(member)))throw new Error('invalid_member_id');
 const relationship=typeof payload.relationship==='string'?payload.relationship.trim():'';
 const displayName=typeof payload.display_name==='string'?payload.display_name.trim():'';
 const notes=typeof payload.care_notes==='string'?payload.care_notes.trim():'';
 const birth=payload.date_of_birth===undefined||payload.date_of_birth===null||payload.date_of_birth===''?null:payload.date_of_birth;
 if(relationship.length<1||relationship.length>40)throw new Error('invalid_relationship');
 if(displayName.length<1||displayName.length>80)throw new Error('invalid_display_name');
 if(notes.length>4000)throw new Error('care_notes_too_long');
 if(birth!==null&&!validDate(birth))throw new Error('invalid_date_of_birth');
 if(typeof payload.active!=='boolean')throw new Error('active_choice_required');
 return {p_member_id:member,p_relationship:relationship,p_display_name:displayName,p_date_of_birth:birth,p_care_notes:notes||null,p_active:payload.active};
}
export function confirmedHouseholdMember(receipt,memberId){
 if(!receipt||receipt.ok!==true||!uuid.test(receipt.member_id??'')||!uuid.test(receipt.household_id??'')||(memberId&&receipt.member_id!==memberId))throw new Error('household_member_save_not_confirmed');
 return receipt;
}
