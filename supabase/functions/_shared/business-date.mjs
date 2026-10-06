/** Credential dates are inclusive calendar dates in The Bahamas, not UTC. */
export function bahamasDate(instant = new Date()) {
  if (!(instant instanceof Date) || !Number.isFinite(instant.getTime())) throw new Error("invalid_business_date");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Nassau", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(instant);
  const part = type => parts.find(item => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
