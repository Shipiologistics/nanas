const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const e164=/^\+[1-9][0-9]{7,14}$/;
const clean=(value,field,min,max)=>{const result=typeof value==='string'?value.trim():'';if(result.length<min||result.length>max)throw new Error(`invalid_${field}`);return result;};

export function emergencyContactArguments(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('invalid_emergency_contact');
 const contactId=payload.contact_id===undefined||payload.contact_id===null||payload.contact_id===''?null:payload.contact_id;
 if(contactId!==null&&(typeof contactId!=='string'||!uuid.test(contactId)))throw new Error('invalid_contact_id');
 const phone=typeof payload.phone_e164==='string'?payload.phone_e164.trim():'';
 if(!e164.test(phone))throw new Error('invalid_contact_phone');
 if(!Number.isSafeInteger(payload.priority)||payload.priority<1||payload.priority>10)throw new Error('invalid_contact_priority');
 if(payload.consent_confirmed!==true)throw new Error('emergency_contact_consent_required');
 return {p_contact_id:contactId,p_name:clean(payload.name,'contact_name',2,80),p_phone_e164:phone,
  p_relationship:clean(payload.relationship,'contact_relationship',2,80),p_priority:payload.priority,p_consent_confirmed:true};
}

export function confirmedEmergencyContact(receipt,expectedId=null){
 if(!receipt||receipt.ok!==true||receipt.consent_confirmed!==true||!uuid.test(receipt.contact_id??'')||(expectedId&&receipt.contact_id!==expectedId))throw new Error('emergency_contact_save_not_confirmed');
 return receipt;
}

export function confirmedEmergencyContactRevocation(receipt,expectedId){
 if(!receipt||receipt.ok!==true||receipt.consent_confirmed!==false||receipt.contact_id!==expectedId)throw new Error('emergency_contact_revocation_not_confirmed');
 return receipt;
}

export function confirmedBookingEmergencyContact(receipt,bookingId){
 if(!receipt||receipt.ok!==true||receipt.booking_id!==bookingId||typeof receipt.configured!=='boolean')throw new Error('emergency_contact_access_not_confirmed');
 if(!receipt.configured)return receipt;
 const contact=receipt.contact;
 if(!uuid.test(receipt.access_log_id??'')||!contact||!uuid.test(contact.id??'')||!e164.test(contact.phone_e164??'')
  ||typeof contact.name!=='string'||contact.name.trim().length<2||typeof contact.relationship!=='string'||contact.relationship.trim().length<2)throw new Error('emergency_contact_access_not_confirmed');
 return receipt;
}
