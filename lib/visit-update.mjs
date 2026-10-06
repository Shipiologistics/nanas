const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const types=new Set(['arrival','activity','meal','wellbeing','departure','other']);
export function visitUpdateArguments(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||!uuid.test(payload.booking_id??'')||!uuid.test(payload.client_nonce??''))throw new Error('invalid_visit_update');
 if(!types.has(payload.update_type))throw new Error('invalid_visit_update_type');
 const note=typeof payload.note==='string'?payload.note.trim():'';
 if(note.length<2||note.length>500)throw new Error('invalid_visit_update_note');
 return {p_booking_id:payload.booking_id,p_update_type:payload.update_type,p_note:note,p_client_nonce:payload.client_nonce};
}
export function visitUpdatePageArguments(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||!uuid.test(payload.booking_id??''))throw new Error('invalid_visit_update_page');
 const limit=payload.limit??50,beforeAt=payload.before_at??null,beforeId=payload.before_id??null;
 if(!Number.isInteger(limit)||limit<1||limit>50)throw new Error('invalid_visit_update_limit');
 if((beforeAt===null)!==(beforeId===null))throw new Error('invalid_visit_update_cursor');
 if(beforeAt!==null&&(typeof beforeAt!=='string'||!Number.isFinite(Date.parse(beforeAt))||!uuid.test(beforeId)))throw new Error('invalid_visit_update_cursor');
 return {p_booking_id:payload.booking_id,p_before_at:beforeAt,p_before_id:beforeId,p_limit:limit};
}
export function confirmedVisitUpdate(receipt,expected){
 if(!receipt||receipt.ok!==true||!uuid.test(receipt.visit_update_id??'')||receipt.booking_id!==expected.booking_id
  ||typeof receipt.replayed!=='boolean'||typeof receipt.occurred_at!=='string'||!Number.isFinite(Date.parse(receipt.occurred_at)))throw new Error('visit_update_save_not_confirmed');
 return receipt;
}
export function confirmedVisitUpdatePage(receipt,bookingId){
 const nextAt=receipt?.next_before_at??null,nextId=receipt?.next_before_id??null;
 if(!receipt||receipt.ok!==true||receipt.booking_id!==bookingId||!Array.isArray(receipt.updates)||receipt.updates.length>50
  ||(nextAt===null)!==(nextId===null)
  ||(nextAt!==null&&(typeof nextAt!=='string'||!Number.isFinite(Date.parse(nextAt))||!uuid.test(nextId))))throw new Error('visit_update_page_not_confirmed');
 const updates=receipt.updates.map(item=>{
  if(!item||!uuid.test(item.id??'')||item.booking_id!==bookingId||!uuid.test(item.provider_id??'')||!types.has(item.update_type)
   ||typeof item.note!=='string'||item.note.trim().length<2||item.note.length>500||typeof item.occurred_at!=='string'||!Number.isFinite(Date.parse(item.occurred_at)))throw new Error('visit_update_page_not_confirmed');
  return {...item,note:item.note.trim()};
 });
 return {...receipt,updates};
}
