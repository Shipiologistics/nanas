export const publicRequestCategories = { 'senior-care':'senior_care', 'child-care':'child_care', 'home-healthcare':'adult_care', housekeeping:'housekeeping', tutoring:'tutoring', 'pet-care':'pet_care' };

export function validatePublicRequestDraft(input, today) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('This draft is invalid. Please start the request again.');
  const read = key => typeof input[key] === 'string' ? input[key].trim() : '';
  const service=read('service'), date=read('date'), time=read('time');
  if (!Object.hasOwn(publicRequestCategories,service)) throw new Error('Choose a care or household service.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date+'T12:00:00Z')) || new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date || date<today) throw new Error('Choose today or a valid future date.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Choose a valid start time.');
  const hours=Number(typeof input.hours === 'number' ? input.hours : read('hours')), budget=Number(typeof input.budget === 'number' ? input.budget : read('budget'));
  if (!Number.isInteger(hours)||hours<1||hours>24) throw new Error('Choose between 1 and 24 whole hours.');
  if (!Number.isFinite(budget)||budget<20||budget>100000||Number(budget.toFixed(2))!==budget) throw new Error('Enter a budget between BSD 20 and 100,000, with at most two decimal places.');
  const endMinutes=Number(time.slice(0,2))*60+Number(time.slice(3))+hours*60;
  if (endMinutes>=1440) throw new Error('This request form supports visits ending before midnight. Choose an earlier start or fewer hours.');
  const area=read('area'), recipient=read('recipient'), description=read('description');
  if (!area||area.length>120||!recipient||recipient.length>120||description.length<10||description.length>900) throw new Error('Add an area, a private recipient label (up to 120 characters), and a description of 10–900 characters.');
  const serviceId=read('serviceId');
  return {service,serviceId:/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(serviceId)?serviceId:'',date,time,hours,budget,area,recipient,description,endTime:`${String(Math.floor(endMinutes/60)).padStart(2,'0')}:${String(endMinutes%60).padStart(2,'0')}`};
}

export function publicDraftAreaId(area) {
  // A broad island or unsupported location must never silently become Nassau.
  return {'Nassau & Paradise Island':'11000000-0000-0000-0000-000000000001','Freeport & Lucaya':'11000000-0000-0000-0000-000000000002','Marsh Harbour':'11000000-0000-0000-0000-000000000003'}[area] ?? '';
}

export function publicDraftIslandId(area) {
  return {'Nassau & Paradise Island':'10000000-0000-0000-0000-000000000001','Freeport & Lucaya':'10000000-0000-0000-0000-000000000002','Marsh Harbour':'10000000-0000-0000-0000-000000000003'}[area] ?? '';
}
