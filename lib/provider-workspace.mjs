const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const workspaceActions = new Set([
  'seller_upsert_service', 'seller_replace_weekly_availability', 'seller_set_publication',
  'seller_update_public_profile', 'seller_upsert_service_area',
]);

const text = (value, field, minimum, maximum, optional = false) => {
  if (optional && (value === undefined || value === null || value === '')) return null;
  if (typeof value !== 'string' || value.trim().length < minimum || value.trim().length > maximum) throw new Error(`invalid_${field}`);
  return value.trim();
};
const id = (value, field) => {
  if (typeof value !== 'string' || !uuid.test(value)) throw new Error(`invalid_${field}`);
  return value;
};
const integer = (value, field, minimum, maximum) => {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(`invalid_${field}`);
  return value;
};
const number = (value, field, minimum, maximum) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`invalid_${field}`);
  return value;
};
const choice = (value, field) => {
  if (typeof value !== 'boolean') throw new Error(`invalid_${field}`);
  return value;
};
const list = (value, field, maximumItems, maximumLength, minimumItems = 0) => {
  if (!Array.isArray(value) || value.length < minimumItems || value.length > maximumItems
    || value.some(item => typeof item !== 'string' || item.trim().length < 2 || item.trim().length > maximumLength)) {
    throw new Error(`invalid_${field}`);
  }
  return value.map(item => item.trim());
};
const seconds = value => {
  const match = typeof value === 'string' && value.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const [, h, m, s = '0'] = match;
  if (+h > 23 || +m > 59 || +s > 59) return null;
  return +h * 3600 + +m * 60 + +s;
};

export function providerWorkspaceArguments(action, payload) {
  if (!workspaceActions.has(action) || !payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('invalid_provider_workspace_action');
  if (action === 'seller_upsert_service') {
    const rateMax = payload.rate_max_minor === undefined || payload.rate_max_minor === null ? null : integer(payload.rate_max_minor, 'rate_max_minor', 0, Number.MAX_SAFE_INTEGER);
    const rate = integer(payload.rate_minor, 'rate_minor', 0, Number.MAX_SAFE_INTEGER);
    if (rateMax !== null && rateMax < rate) throw new Error('invalid_rate_range');
    return {p_service_id:id(payload.service_id,'service_id'),p_rate_minor:rate,p_rate_max_minor:rateMax,
      p_service_bio:text(payload.service_bio,'service_bio',0,2000,true),p_years_experience:integer(payload.years_experience,'years_experience',0,80),
      p_capabilities:list(payload.capabilities,'capabilities',30,100),p_additional_help:list(payload.additional_help,'additional_help',20,100),p_active:choice(payload.active,'active')};
  }
  if (action === 'seller_replace_weekly_availability') {
    if (!Array.isArray(payload.weekdays) || payload.weekdays.some(day=>!Number.isInteger(day)||day<0||day>6)
      || new Set(payload.weekdays).size !== payload.weekdays.length) throw new Error('invalid_weekdays');
    const start=seconds(payload.local_start),end=seconds(payload.local_end);
    if (start===null||end===null||end<=start) throw new Error('invalid_time_window');
    return {p_weekdays:payload.weekdays,p_local_start:payload.local_start,p_local_end:payload.local_end};
  }
  if (action === 'seller_set_publication') return {p_published:choice(payload.published,'published')};
  if (action === 'seller_update_public_profile') return {
    p_display_name:text(payload.display_name,'display_name',2,80),p_avatar_path:text(payload.avatar_path,'avatar_path',1,500,true),
    p_headline:text(payload.headline,'headline',0,120,true),p_languages:list(payload.languages,'languages',12,40,1),
    p_island_id:payload.island_id===undefined||payload.island_id===null||payload.island_id===''?null:id(payload.island_id,'island_id'),
    p_locality:text(payload.locality,'locality',0,100,true),p_vaccinations:list(payload.vaccinations,'vaccinations',20,80),
    p_additional_details:list(payload.additional_details,'additional_details',20,100),
  };
  return {p_service_area_id:id(payload.service_area_id,'service_area_id'),p_radius_km:number(payload.radius_km,'radius_km',0,500),
    p_travel_fee_minor:integer(payload.travel_fee_minor,'travel_fee_minor',0,Number.MAX_SAFE_INTEGER),p_active:choice(payload.active,'active')};
}

export function confirmedProviderWorkspace(action, receipt, expected = {}) {
  if (!receipt || receipt.ok !== true) throw new Error('provider_workspace_save_not_confirmed');
  if (action === 'seller_upsert_service') {
    if (!uuid.test(receipt.seller_service_id ?? '') || !Number.isInteger(receipt.active_service_profiles)
      || receipt.active_service_profiles < 0 || receipt.active_service_profiles > 3 || receipt.maximum_service_profiles !== 3) throw new Error('provider_workspace_save_not_confirmed');
  } else if (action === 'seller_replace_weekly_availability') {
    if (receipt.rules_created !== expected.weekdays?.length) throw new Error('provider_workspace_save_not_confirmed');
  } else if (action === 'seller_set_publication') {
    if (expected.published === false ? receipt.published_at !== null
      : typeof receipt.published_at !== 'string' || !Number.isFinite(Date.parse(receipt.published_at))) throw new Error('provider_workspace_save_not_confirmed');
  } else if (action === 'seller_update_public_profile') {
    if (!Object.prototype.hasOwnProperty.call(receipt, 'avatar_path') || (receipt.avatar_path ?? null) !== (expected.avatar_path ?? null)) throw new Error('provider_workspace_save_not_confirmed');
  } else if (action === 'seller_upsert_service_area') {
    if (!uuid.test(receipt.seller_service_area_id ?? '')) throw new Error('provider_workspace_save_not_confirmed');
  } else throw new Error('provider_workspace_save_not_confirmed');
  return receipt;
}

export function uploadedProfileImageCommitted(assetRef, row, readError) {
  return !readError && typeof assetRef === 'string' && row?.avatar_path === assetRef;
}
