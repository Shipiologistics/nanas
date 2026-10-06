export function validateBadgePage(result, previousCursor) {
  if (!result || result.ok!==true || !["providers","evaluated","awarded","revoked"].every(key=>Number.isSafeInteger(result[key])&&result[key]>=0)
    || result.providers>100 || result.awarded>result.evaluated
    || (result.next_cursor!==null && (typeof result.next_cursor!=="string"
      || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(result.next_cursor)
      || !result.providers || (previousCursor && result.next_cursor<=previousCursor))))
    throw new Error("invalid_badge_evaluation_response");
  return result.next_cursor;
}
