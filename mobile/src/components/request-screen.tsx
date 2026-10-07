import { router, type Href } from 'expo-router';
import { ArrowLeft, CalendarDays, LockKeyhole, MapPin } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, PrimaryButton, Wordmark, ui } from '@/components/nanas-ui';
import { colors, type AppRole } from '@/constants/nanas';
import { useSession } from '@/contexts/session';
import { marketplace, operationKey } from '@/lib/marketplace';
import { supabase } from '@/lib/supabase';

type Row = Record<string, unknown>;
const str = (value: unknown) => typeof value === 'string' ? value : '';
const num = (value: unknown) => typeof value === 'number' ? value : 0;
const title = (value: unknown) => str(value).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export function RequestScreen({ workspaceRole: role, requestId }: { workspaceRole: AppRole; requestId: string }) {
  const { user, roles, loading: sessionLoading } = useSession();
  const [request, setRequest] = useState<Row | null>(null); const [schedule, setSchedule] = useState<Row | null>(null); const [quotes, setQuotes] = useState<Row[]>([]);
  const [renderedAt] = useState(() => Date.now());
  const [rate, setRate] = useState('25'); const [travel, setTravel] = useState('0'); const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    if (!requestId || !user) return;
    const [record, timing, offers] = await Promise.all([
      supabase.from('booking_requests').select('*').eq('id', requestId).maybeSingle(),
      supabase.from('booking_request_schedules').select('*').eq('request_id', requestId).maybeSingle(),
      supabase.from('booking_quotes').select('*').eq('request_id', requestId).order('created_at', { ascending: false }),
    ]);
    if (record.error) throw record.error; if (timing.error) throw timing.error; if (offers.error) throw offers.error;
    setRequest(record.data); setSchedule(timing.data); setQuotes((offers.data ?? []) as Row[]);
  }, [requestId, user]);
  useEffect(() => {
    if (sessionLoading) return; if (!user) { router.replace('/auth'); return; } if (!roles.includes(role)) { router.replace('/role'); return; }
    // Synchronize the authoritative request after auth and route inputs settle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((cause) => setError(cause instanceof Error ? cause.message : 'Care request unavailable.'));
  }, [load, role, roles, sessionLoading, user]);
  async function act(name: string, operation: () => Promise<unknown>, success: string) { setBusy(name); setError(''); setNotice(''); try { await operation(); setNotice(success); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'The request action failed.'); } finally { setBusy(''); } }
  async function submitQuote() {
    const hourly = Number(rate), fee = Number(travel); if (!Number.isFinite(hourly) || hourly <= 0 || !Number.isFinite(fee) || fee < 0) { setError('Enter valid rate and travel amounts.'); return; }
    await act('quote', () => marketplace('submit_quote', { request_id: requestId, rate_minor: Math.round(hourly * 100), travel_minor: Math.round(fee * 100), message: message.trim() }), 'Quote submitted to the client.');
  }
  async function acceptQuote(quoteId: string) {
    await act(quoteId, async () => { const allowed = await supabase.rpc('payment_simulation_allowed'); if (allowed.error) throw allowed.error; if (allowed.data !== true) throw new Error('Test payment is not available. No booking was created.'); const result = await marketplace('accept_quote', { quote_id: quoteId }, operationKey('accept-quote')) as Row; const bookingId = str(result.booking_id); if (bookingId) router.replace(`/buyer/booking/${bookingId}` as Href); }, 'Quote accepted and simulated payment recorded.');
  }
  if (!request && !error) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color={colors.teal} /></SafeAreaView>;
  if (!request) return <SafeAreaView style={styles.center}><EmptyState title="Request unavailable" message={error} retry={() => void load()} /></SafeAreaView>;
  const start = new Date(str(request.desired_start)); const end = new Date(str(request.desired_end)); const format = (date: Date) => Number.isNaN(date.getTime()) ? 'Unavailable' : date.toLocaleString('en-BS', { dateStyle: 'medium', timeStyle: 'short' });
  return <SafeAreaView style={styles.screen}><View style={styles.header}><Pressable onPress={() => router.back()} style={styles.icon}><ArrowLeft size={22} color={colors.ink} /></Pressable><Wordmark compact /><View style={{ width: 42 }} /></View><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>{role === 'buyer' ? 'MY CARE REQUEST' : 'MATCHED CARE REQUEST'}</Text><Text style={styles.heading}>{str(request.care_summary)}</Text><View style={ui.metaRow}><View style={ui.pill}><Text style={ui.pillText}>{title(request.status)}</Text></View><View style={ui.pill}><Text style={ui.pillText}>{str(request.currency) || 'BSD'} {(num(request.budget_minor) / 100).toFixed(2)} budget</Text></View></View>
    <View style={ui.card}><View style={styles.line}><CalendarDays size={19} color={colors.teal} /><View><Text style={ui.cardTitle}>{format(start)}</Text><Text style={ui.cardCopy}>to {format(end)}</Text></View></View><View style={styles.line}><MapPin size={19} color={colors.teal} /><Text style={ui.cardCopy}>Exact address stays private until booking.</Text></View></View>
    {schedule && <View style={ui.card}><Text style={ui.cardTitle}>{title(schedule.schedule_kind)} schedule</Text><Text style={ui.cardCopy}>{Array.isArray(schedule.weekdays) && schedule.weekdays.length ? `Days: ${schedule.weekdays.join(', ')}` : 'Scheduled once'}{schedule.specific_start ? ` · ${str(schedule.specific_start)}–${str(schedule.specific_end)}` : ''}</Text></View>}
    {notice ? <Text style={styles.notice}>{notice}</Text> : null}{error ? <Text style={ui.error}>{error}</Text> : null}
    <Text style={styles.sectionTitle}>{role === 'buyer' ? `Quotes (${quotes.length})` : 'Your quote'}</Text>
    {role === 'seller' ? <View style={styles.form}><TextInput value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="Hourly rate (BSD)" style={styles.input} /><TextInput value={travel} onChangeText={setTravel} keyboardType="decimal-pad" placeholder="Travel fee (BSD)" style={styles.input} /><TextInput value={message} onChangeText={setMessage} multiline maxLength={1000} placeholder="Explain your experience and availability" placeholderTextColor="#71817F" style={styles.input} /><PrimaryButton loading={busy === 'quote'} onPress={() => void submitQuote()}>Send quote</PrimaryButton><View style={styles.private}><LockKeyhole size={16} color={colors.teal} /><Text style={styles.privateText}>Client contact details stay private. Keep all communication in Nanas.</Text></View></View> : quotes.length ? quotes.map((quote) => { const snapshot = quote.policy_snapshot && typeof quote.policy_snapshot === 'object' && !Array.isArray(quote.policy_snapshot) ? quote.policy_snapshot as Row : {}; const available = str(request.status) === 'offered' && new Date(str(quote.expires_at)).getTime() > renderedAt; return <View key={str(quote.id)} style={ui.card}><Text style={ui.cardTitle}>{str(quote.currency) || 'BSD'} {(num(quote.total_minor) / 100).toFixed(2)} total</Text><Text style={ui.cardCopy}>{str(snapshot.seller_message) || 'Provider quote'}</Text><View style={ui.metaRow}><View style={ui.pill}><Text style={ui.pillText}>{available ? 'Available' : title(request.status)}</Text></View><View style={ui.pill}><Text style={ui.pillText}>{str(quote.currency) || 'BSD'} {(num(snapshot.rate_minor) / 100).toFixed(2)}/hr</Text></View></View>{available && <View style={{ marginTop: 12 }}><PrimaryButton loading={busy === str(quote.id)} onPress={() => void acceptQuote(str(quote.id))}>Simulate payment & book</PrimaryButton></View>}</View>; }) : <EmptyState title="No quotes yet" message="Eligible providers can respond while this request remains open." />}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.ivory }, center: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: colors.ivory }, header: { height: 62, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border }, icon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, content: { width: '100%', maxWidth: 860, alignSelf: 'center', padding: 16, paddingBottom: 46, gap: 12 }, eyebrow: { color: colors.teal, fontWeight: '900', letterSpacing: 1.3, marginTop: 8 }, heading: { color: colors.ink, fontFamily: 'Georgia', fontSize: 29, lineHeight: 34, fontWeight: '700' }, line: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 }, notice: { color: colors.success, backgroundColor: '#E4F6EC', padding: 12, borderRadius: 12 }, sectionTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 22, fontWeight: '700', marginTop: 10 }, form: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 14, gap: 10 }, input: { minHeight: 50, maxHeight: 140, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.ivory, paddingHorizontal: 13, paddingVertical: 11, color: colors.ink }, private: { flexDirection: 'row', gap: 8, backgroundColor: colors.aqua, padding: 11, borderRadius: 12 }, privateText: { flex: 1, color: colors.tealDark, fontSize: 12, lineHeight: 17 } });
