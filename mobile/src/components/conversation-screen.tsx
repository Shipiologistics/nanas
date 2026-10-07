import { router } from 'expo-router';
import { ArrowLeft, LockKeyhole, Send } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, PrimaryButton, Wordmark } from '@/components/nanas-ui';
import { colors, type AppRole } from '@/constants/nanas';
import { useSession } from '@/contexts/session';
import { marketplace, operationKey } from '@/lib/marketplace';
import { supabase } from '@/lib/supabase';

type Access = { locked: boolean; can_send: boolean; unread_count: number; other_last_read_at: string | null };
type Message = { id: string; sender_id: string; body: string; created_at: string; message_type: string };

export function ConversationScreen({ workspaceRole: role, conversationId }: { workspaceRole: AppRole; conversationId: string }) {
  const { user, roles, loading: sessionLoading } = useSession();
  const [access, setAccess] = useState<Access | null>(null); const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [draft, setDraft] = useState('');
  const scroll = useRef<ScrollView>(null);
  const load = useCallback(async () => {
    if (!user || !conversationId) return;
    setError('');
    const [state, thread] = await Promise.all([
      supabase.rpc('conversation_access_state'),
      supabase.from('messages').select('id,sender_id,body,created_at,message_type').eq('conversation_id', conversationId).is('deleted_at', null).order('created_at', { ascending: true }).order('id', { ascending: true }).limit(200),
    ]);
    if (state.error) throw state.error; if (thread.error) throw thread.error;
    const row = Array.isArray(state.data) ? state.data.find((item) => item && typeof item === 'object' && item.conversation_id === conversationId) : null;
    setAccess(row ? { locked: row.locked !== false, can_send: row.can_send === true, unread_count: Number(row.unread_count ?? 0), other_last_read_at: typeof row.other_last_read_at === 'string' ? row.other_last_read_at : null } : { locked: role === 'buyer', can_send: false, unread_count: 0, other_last_read_at: null });
    setMessages((thread.data ?? []) as Message[]); setLoading(false);
    const last = thread.data?.at(-1); if (last) await marketplace('mark_conversation_read', { conversation_id: conversationId, message_id: last.id });
  }, [conversationId, role, user]);
  useEffect(() => {
    if (sessionLoading) return; if (!user) { router.replace('/auth'); return; } if (!roles.includes(role)) { router.replace('/role'); return; }
    // Synchronize the thread after auth and the route identifier settle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((cause) => { setError(cause instanceof Error ? cause.message : 'Conversation unavailable.'); setLoading(false); });
    const timer = setInterval(() => void load().catch(() => undefined), 5000); return () => clearInterval(timer);
  }, [load, role, roles, sessionLoading, user]);
  const locked = role === 'buyer' && (access?.locked ?? true);
  const planPrice = useRef(0);
  async function unlock() {
    setBusy(true); setError('');
    try {
      const allowed = await supabase.rpc('payment_simulation_allowed'); if (allowed.error) throw allowed.error; if (allowed.data !== true) throw new Error('Paid messaging is not available. No payment was taken.');
      const plan = await supabase.from('job_posting_plans').select('fee_minor').eq('code', 'premium').eq('active', true).maybeSingle(); if (plan.error) throw plan.error;
      const amount = Number(plan.data?.fee_minor ?? 0); if (amount <= 0) throw new Error('Messaging price is unavailable.'); planPrice.current = amount;
      await marketplace('purchase_conversation', { conversation_id: conversationId, amount_minor: amount }); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Conversation could not be unlocked.'); } finally { setBusy(false); }
  }
  async function send() {
    const body = draft.trim(); if (!body || busy) return; setBusy(true); setError('');
    try { await marketplace('send_message', { conversation_id: conversationId, body, sender_nonce: operationKey('message') }); setDraft(''); await load(); requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: true })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Message could not be sent.'); } finally { setBusy(false); }
  }
  const title = useMemo(() => role === 'buyer' ? 'Provider conversation' : 'Client conversation', [role]);
  return <SafeAreaView style={styles.screen}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.header}><Pressable onPress={() => router.back()} style={styles.icon}><ArrowLeft size={22} color={colors.ink} /></Pressable><View><Text style={styles.headerTitle}>{title}</Text><Text style={styles.headerCopy}>Secure Nanas messaging</Text></View><Wordmark compact /></View>
    {loading ? <View style={styles.center}><ActivityIndicator size="large" color={colors.teal} /></View> : locked ? <View style={styles.locked}><View style={styles.lockIcon}><LockKeyhole size={30} color={colors.teal} /></View><Text style={styles.lockTitle}>Unlock secure messaging</Text><Text style={styles.lockCopy}>This buyer conversation follows the same anti-bypass payment rule as the web app. This test environment records a simulated payment; no real card is charged.</Text>{error ? <Text style={styles.error}>{error}</Text> : null}<PrimaryButton loading={busy} onPress={() => void unlock()}>Simulate payment & unlock</PrimaryButton></View> : <><ScrollView ref={scroll} contentContainerStyle={styles.thread} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>{messages.length ? messages.map((message) => { const mine = message.sender_id === user?.id; return <View key={message.id} style={[styles.bubble, mine ? styles.mine : styles.theirs]}><Text style={[styles.body, mine && { color: colors.white }]}>{message.body}</Text><Text style={[styles.time, mine && { color: '#D9EFED' }]}>{new Date(message.created_at).toLocaleString('en-BS', { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' })}</Text></View>; }) : <EmptyState title="No messages yet" message="Start a secure conversation about this booking or request." />}</ScrollView>{error ? <Text style={styles.error}>{error}</Text> : null}<View style={styles.composer}><TextInput value={draft} onChangeText={setDraft} multiline maxLength={2000} placeholder="Message securely…" placeholderTextColor="#738281" style={styles.input} /><Pressable disabled={!draft.trim() || busy || access?.can_send === false} onPress={() => void send()} style={[styles.send, (!draft.trim() || access?.can_send === false) && { opacity: 0.45 }]}><Send size={20} color={colors.white} /></Pressable></View></>}
  </KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.ivory }, header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.border }, icon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, headerTitle: { color: colors.ink, fontWeight: '900', textAlign: 'center' }, headerCopy: { color: colors.muted, fontSize: 11, marginTop: 2, textAlign: 'center' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, locked: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', padding: 24, alignItems: 'center', justifyContent: 'center' }, lockIcon: { width: 62, height: 62, borderRadius: 22, backgroundColor: colors.aqua, alignItems: 'center', justifyContent: 'center' }, lockTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 28, fontWeight: '700', marginTop: 18 }, lockCopy: { color: colors.muted, lineHeight: 22, textAlign: 'center', marginVertical: 12 }, error: { color: colors.danger, backgroundColor: '#FFF1F0', padding: 10, marginHorizontal: 14, marginVertical: 8, borderRadius: 12 }, thread: { width: '100%', maxWidth: 860, alignSelf: 'center', padding: 16, paddingBottom: 24, gap: 10 }, bubble: { maxWidth: '84%', padding: 12, borderRadius: 17 }, mine: { backgroundColor: colors.teal, alignSelf: 'flex-end', borderBottomRightRadius: 5 }, theirs: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignSelf: 'flex-start', borderBottomLeftRadius: 5 }, body: { color: colors.ink, lineHeight: 20 }, time: { color: colors.muted, fontSize: 10, marginTop: 6 }, composer: { width: '100%', maxWidth: 860, alignSelf: 'center', flexDirection: 'row', alignItems: 'flex-end', padding: 10, gap: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.white }, input: { flex: 1, maxHeight: 120, minHeight: 46, borderRadius: 16, backgroundColor: colors.ivory, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 13, paddingVertical: 12, color: colors.ink }, send: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' } });
