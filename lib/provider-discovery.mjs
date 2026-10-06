/** Check the server projection before treating an empty result as success. */
export function parseProviderFeed(value) {
  if (!value || !Array.isArray(value.items) || !Number.isSafeInteger(value.total) || value.total < 0 ||
      !Number.isSafeInteger(value.page) || value.page < 0 || !Number.isSafeInteger(value.page_size) || value.page_size < 1 || value.page_size > 50 ||
      value.items.length > value.page_size || value.items.length > value.total) throw new Error('Invalid provider request feed');
  for (const row of value.items) {
    if (!['id','buyer_id','service','area','care_summary'].every(key => typeof row[key] === 'string') ||
        !['requested','offered'].includes(row.status) || typeof row.featured !== 'boolean' || typeof row.has_quoted !== 'boolean' ||
        !Number.isSafeInteger(row.quote_count) || row.quote_count < 0 ||
        ![row.created_at,row.desired_start,row.desired_end].every(date => typeof date === 'string' && Number.isFinite(Date.parse(date))) ||
        (row.budget_minor !== null && (!Number.isSafeInteger(row.budget_minor) || row.budget_minor < 0)) ||
        !isValidRequestSchedule(row.schedule)) throw new Error('Invalid provider request record');
  }
  return value;
}

function isValidRequestSchedule(schedule) {
  if (!schedule || !['recurring', 'one_time'].includes(schedule.kind) ||
      typeof schedule.start_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(schedule.start_date) ||
      !Number.isFinite(Date.parse(`${schedule.start_date}T12:00:00Z`)) ||
      (schedule.end_date !== null && (typeof schedule.end_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(schedule.end_date) ||
        !Number.isFinite(Date.parse(`${schedule.end_date}T12:00:00Z`)) || schedule.end_date < schedule.start_date)) ||
      typeof schedule.flexible_start !== 'boolean' || typeof schedule.schedule_may_vary !== 'boolean' ||
      typeof schedule.timezone !== 'string' || !schedule.timezone.trim() ||
      !Array.isArray(schedule.weekdays) || !Array.isArray(schedule.time_periods)) return false;
  const weekdays = schedule.weekdays;
  const periods = schedule.time_periods;
  if (weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6) || new Set(weekdays).size !== weekdays.length ||
      periods.some(period => !['morning', 'afternoon', 'evening', 'overnight'].includes(period)) || new Set(periods).size !== periods.length ||
      (schedule.kind === 'recurring' && weekdays.length === 0)) return false;
  const hasStart = typeof schedule.specific_start === 'string' && /^\d{2}:\d{2}(?::\d{2})?$/.test(schedule.specific_start);
  const hasEnd = typeof schedule.specific_end === 'string' && /^\d{2}:\d{2}(?::\d{2})?$/.test(schedule.specific_end);
  return hasStart === hasEnd && (!hasStart || schedule.specific_end > schedule.specific_start) &&
    !(hasStart && periods.length) && (hasStart || periods.length > 0);
}

export function compareProviderRequests(left, right, sort) {
  const tie = (Date.parse(right.createdAt ?? '') || 0) - (Date.parse(left.createdAt ?? '') || 0) || left.id.localeCompare(right.id);
  if (sort === 'recommended') return Number(!!right.featured) - Number(!!left.featured) || tie;
  if (sort === 'budget') return right.budget - left.budget || tie;
  if (sort === 'soonest') return Date.parse(left.startsAt) - Date.parse(right.startsAt) || tie;
  if (sort === 'quotes') return (left.quoteCount ?? left.quotes.length) - (right.quoteCount ?? right.quotes.length) || tie;
  return tie;
}
