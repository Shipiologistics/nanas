import type { AppRole } from '@/constants/nanas';
import { supabase } from '@/lib/supabase';

export type SectionRecord = Record<string, unknown>;

type QuerySpec = { table: string; select: string; order?: string; ascending?: boolean; userColumn?: string };

const buyerQueries: Record<string, QuerySpec> = {
  'find-care': { table: 'seller_directory', select: 'user_id,display_name,headline,locality,island,rating_average,rating_count,response_rate,completed_bookings,services,badges,avatar_path', order: 'rating_average', ascending: false },
  'care-requests': { table: 'booking_requests', select: 'id,care_summary,status,currency,budget_minor,desired_start,desired_end,mode,created_at', order: 'created_at', ascending: false, userColumn: 'buyer_id' },
  quotes: { table: 'booking_quotes', select: 'id,request_id,seller_id,currency,base_minor,travel_minor,platform_fee_minor,total_minor,policy_snapshot,expires_at,created_at', order: 'created_at', ascending: false },
  bookings: { table: 'bookings', select: 'id,reference,status,currency,total_minor,scheduled_start,scheduled_end,seller_id,service_id,started_at,ended_at', order: 'scheduled_start', ascending: false, userColumn: 'buyer_id' },
  messages: { table: 'conversations', select: 'id,conversation_type,status,last_message_at,booking_id,request_id,created_at', order: 'last_message_at', ascending: false },
  wallet: { table: 'wallet_balances', select: 'account_id,account_type,balance_minor,currency,last_activity_at,status', order: 'last_activity_at', ascending: false, userColumn: 'owner_user_id' },
  reviews: { table: 'reviews', select: 'id,booking_id,subject_id,overall_rating,status,submitted_at,published_at', order: 'submitted_at', ascending: false, userColumn: 'author_id' },
  favorites: { table: 'favorites', select: 'seller_id,created_at', order: 'created_at', ascending: false, userColumn: 'buyer_id' },
  household: { table: 'households', select: 'id,name,created_at,updated_at', order: 'updated_at', ascending: false, userColumn: 'owner_user_id' },
  notifications: { table: 'notifications', select: 'id,title,body,category,event_type,read_at,created_at,deep_link', order: 'created_at', ascending: false, userColumn: 'recipient_id' },
  safety: { table: 'support_cases', select: 'id,reference,case_type,subject,status,priority,created_at,resolved_at', order: 'created_at', ascending: false, userColumn: 'requester_id' },
  account: { table: 'profiles', select: 'id,display_name,phone_e164,account_status,created_at,updated_at', userColumn: 'id' },
};

const providerQueries: Record<string, QuerySpec> = {
  quotes: { table: 'booking_quotes', select: 'id,request_id,currency,base_minor,travel_minor,platform_fee_minor,total_minor,policy_snapshot,expires_at,created_at', order: 'created_at', ascending: false, userColumn: 'seller_id' },
  bookings: { table: 'bookings', select: 'id,reference,status,currency,total_minor,seller_net_minor,scheduled_start,scheduled_end,buyer_id,service_id,started_at,ended_at', order: 'scheduled_start', ascending: false, userColumn: 'seller_id' },
  messages: { table: 'conversations', select: 'id,conversation_type,status,last_message_at,booking_id,request_id,created_at', order: 'last_message_at', ascending: false },
  availability: { table: 'availability_rules', select: 'id,weekday,local_start,local_end,timezone,active,valid_from,valid_until,updated_at', order: 'weekday', ascending: true, userColumn: 'seller_id' },
  services: { table: 'seller_services', select: 'id,service_id,active,currency,rate_minor,rate_max_minor,years_experience,minimum_duration_minutes,booking_modes,capabilities,updated_at', order: 'updated_at', ascending: false, userColumn: 'seller_id' },
  earnings: { table: 'wallet_balances', select: 'account_id,account_type,balance_minor,currency,last_activity_at,status', order: 'last_activity_at', ascending: false, userColumn: 'owner_user_id' },
  profile: { table: 'seller_profiles', select: 'user_id,display_name,headline,locality,status,profile_published_at,rating_average,rating_count,response_rate,completed_bookings,languages,vaccinations,updated_at', userColumn: 'user_id' },
  kyc: { table: 'seller_documents', select: 'id,document_type,status,issue_date,expiry_date,uploaded_at,updated_at', order: 'updated_at', ascending: false, userColumn: 'seller_id' },
  badges: { table: 'user_badges', select: 'id,badge_id,awarded_at,expires_at,revoked_at,created_at,badges(name,description)', order: 'created_at', ascending: false, userColumn: 'user_id' },
  notifications: { table: 'notifications', select: 'id,title,body,category,event_type,read_at,created_at,deep_link', order: 'created_at', ascending: false, userColumn: 'recipient_id' },
  safety: { table: 'support_cases', select: 'id,reference,case_type,subject,status,priority,created_at,resolved_at', order: 'created_at', ascending: false, userColumn: 'requester_id' },
  account: { table: 'profiles', select: 'id,display_name,phone_e164,account_status,created_at,updated_at', userColumn: 'id' },
};

function toRows(value: unknown): SectionRecord[] {
  if (Array.isArray(value)) return value.filter((item): item is SectionRecord => Boolean(item) && typeof item === 'object');
  if (value && typeof value === 'object' && 'items' in value) return toRows((value as { items: unknown }).items);
  return [];
}

async function runSpec(spec: QuerySpec, userId: string) {
  let query = supabase.from(spec.table).select(spec.select).limit(40);
  if (spec.userColumn) query = query.eq(spec.userColumn, userId);
  if (spec.order) query = query.order(spec.order, { ascending: spec.ascending ?? false, nullsFirst: false });
  const { data, error } = await query;
  if (error) throw error;
  return toRows(data);
}

export async function loadSectionData(role: AppRole, section: string, userId: string): Promise<SectionRecord[]> {
  if (role === 'seller' && section === 'requests') {
    const { data, error } = await supabase.rpc('provider_request_feed', { p_page: 0, p_page_size: 40, p_sort: 'recommended' });
    if (error) throw error;
    return toRows(data);
  }
  if (section === 'overview') {
    const source = role === 'buyer' ? buyerQueries : providerQueries;
    const keys = role === 'buyer' ? ['care-requests', 'bookings', 'notifications'] : ['quotes', 'bookings', 'earnings'];
    const values = await Promise.all(keys.map((key) => runSpec(source[key], userId)));
    return keys.map((key, index) => ({ summary_key: key, count: values[index].length, latest: values[index][0] ?? null }));
  }
  if (section === 'account') {
    const rows = await runSpec((role === 'buyer' ? buyerQueries : providerQueries).account, userId);
    const { data } = await supabase.auth.getUser();
    return rows.map((row) => ({ ...row, email: data.user?.email ?? '' }));
  }
  if (role === 'buyer' && section === 'favorites') {
    const favorites = await runSpec(buyerQueries.favorites, userId);
    const ids = favorites.map((item) => String(item.seller_id ?? '')).filter(Boolean);
    if (!ids.length) return [];
    const { data, error } = await supabase.from('seller_directory').select('user_id,display_name,headline,locality,rating_average,rating_count,avatar_path').in('user_id', ids);
    if (error) throw error;
    const directory = new Map((data ?? []).map((item) => [item.user_id, item]));
    return favorites.map((favorite) => ({ ...favorite, ...(directory.get(String(favorite.seller_id)) ?? {}), id: favorite.seller_id }));
  }
  if (section === 'wallet' || section === 'earnings') {
    const accountType = role === 'buyer' ? 'buyer_wallet' : 'seller_wallet';
    const [balance, payments, ledger, payouts] = await Promise.all([
      supabase.from('wallet_balances').select('account_id,account_type,balance_minor,currency,last_activity_at,status').eq('owner_user_id', userId).eq('account_type', accountType),
      role === 'buyer' ? supabase.from('payment_intents').select('id,booking_id,request_id,amount_minor,captured_minor,refunded_minor,currency,status,created_at').eq('payer_id', userId).order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [], error: null }),
      supabase.from('ledger_entries').select('id,booking_id,direction,amount_minor,created_at,ledger_accounts!inner(account_type,currency,owner_user_id)').eq('ledger_accounts.owner_user_id', userId).eq('ledger_accounts.account_type', accountType).order('created_at', { ascending: false }).limit(50),
      role === 'seller' ? supabase.from('payouts').select('id,amount_minor,currency,status,processor,created_at').eq('seller_id', userId).order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [], error: null }),
    ]);
    const failure = balance.error ?? payments.error ?? ledger.error ?? payouts.error; if (failure) throw failure;
    return [
      ...(balance.data ?? []).map((row) => ({ ...row, title: role === 'buyer' ? 'Wallet balance' : 'Available earnings' })),
      ...(payments.data ?? []).map((row) => ({ ...row, title: 'Payment record', total_minor: row.amount_minor })),
      ...(ledger.data ?? []).map((row) => ({ ...row, title: `${row.direction === 'credit' ? 'Credit' : 'Debit'} ledger entry`, total_minor: row.amount_minor })),
      ...(payouts.data ?? []).map((row) => ({ ...row, title: 'Payout', total_minor: row.amount_minor })),
    ];
  }
  const spec = (role === 'buyer' ? buyerQueries : providerQueries)[section];
  if (!spec) return [];
  return runSpec(spec, userId);
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', userId).is('read_at', null);
  if (error) throw error;
}
