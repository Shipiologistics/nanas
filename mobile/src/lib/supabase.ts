import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
export const isSupabaseConfigured = Boolean(url && key);

export const supabase = createClient(url || 'https://invalid.local', key || 'missing-key', {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});
