export function providerStartingRate(services = []) {
  const rates = services.map(service => service.rate).filter(rate => Number.isFinite(rate) && rate > 0);
  return rates.length ? Math.min(...rates) : null;
}

export function profileDate(value) {
  if (!value) return undefined;
  // Calendar dates must not shift backwards when displayed in The Bahamas.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T12:00:00Z` : value);
  if (!Number.isFinite(date.getTime())) return undefined;
  return new Intl.DateTimeFormat('en-BS', {dateStyle:'medium',timeZone:dateOnly?'UTC':'America/Nassau'}).format(date);
}
