// Presentation only: the database independently enforces current dates at approval
// and booking. Expiry is inclusive of the recorded Bahamas calendar day.
export function credentialDateWarning(record, today) {
  const validDate = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0,10) === value;
  if (!validDate(today)) return "Current Bahamas date is unavailable. Refresh before reviewing.";
  if (!validDate(record.issue_date) || (record.expiry_date != null && !validDate(record.expiry_date)))
    return "Credential dates are missing or invalid. New evidence with valid dates is required before approval.";
  if (record.expiry_date && record.expiry_date < record.issue_date)
    return "Expiry precedes the issue date. Submit corrected evidence before approval.";
  if (record.expiry_date && record.expiry_date < today)
    return "This evidence has expired and cannot qualify a provider for new bookings. Submit replacement evidence with current dates.";
  if (record.issue_date > today)
    return "This evidence is not yet valid and cannot be approved before its issue date.";
  return null;
}
