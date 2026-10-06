const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const periods={morning:'Mornings',afternoon:'Afternoons',evening:'Evenings',overnight:'Overnights'};
export function requestScheduleSummary(request){
 const schedule=request?.schedule;
 if(!schedule||schedule.kind!=='recurring')return null;
 const dayText=Array.isArray(schedule.weekdays)?schedule.weekdays.filter(day=>Number.isInteger(day)&&day>=0&&day<=6).map(day=>days[day]).join(', '):'';
 const timeText=schedule.specificStart&&schedule.specificEnd?`${schedule.specificStart.slice(0,5)}–${schedule.specificEnd.slice(0,5)}`:(Array.isArray(schedule.timePeriods)?schedule.timePeriods.map(value=>periods[value]??value).join(', '):'');
 if(!dayText||!timeText)return 'Recurring schedule unavailable';
 return `Recurring · ${dayText} · ${timeText}${schedule.scheduleMayVary?' · times may vary':''}`;
}
export function requestScheduleDate(value){
 if(typeof value!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value))return null;
 const date=new Date(`${value}T12:00:00Z`);
 if(!Number.isFinite(date.getTime()))return null;
 return new Intl.DateTimeFormat('en-BS',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(date);
}
