import { router, type Href } from 'expo-router';
import { AlertTriangle, ArrowLeft, CalendarDays, LockKeyhole, MessageCircle, Phone, ShieldAlert } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, PrimaryButton, SecondaryButton, Wordmark, ui } from '@/components/nanas-ui';
import { colors, type AppRole } from '@/constants/nanas';
import { useSession } from '@/contexts/session';
import { marketplace, operationKey } from '@/lib/marketplace';
import { supabase } from '@/lib/supabase';

type Row = Record<string, unknown>;
const str = (value: unknown) => typeof value === 'string' ? value : '';
const num = (value: unknown) => typeof value === 'number' ? value : 0;
const label = (value: unknown) => str(value).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export function BookingScreen({ workspaceRole: role, bookingId }: { workspaceRole: AppRole; bookingId: string }) {
  const { user, roles, loading: sessionLoading } = useSession();
  const [booking, setBooking] = useState<Row | null>(null); const [conversationId, setConversationId] = useState('');
  const [updates, setUpdates] = useState<Row[]>([]); const [contact, setContact] = useState<Row | null>(null); const [visitCode, setVisitCode] = useState('');
  const [codeInput, setCodeInput] = useState(''); const [note, setNote] = useState(''); const [caseText, setCaseText] = useState(''); const [rating, setRating] = useState('5');
  const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    if (!bookingId || !user) return;
    const [record, conversation, timeline] = await Promise.all([
      supabase.from('bookings').select('*').eq('id', bookingId).maybeSingle(),
      supabase.from('conversations').select('id').eq('booking_id', bookingId).maybeSingle(),
      marketplace('booking_visit_update_page', { booking_id: bookingId, limit: 50 }).catch(() => null),
    ]);
    if (record.error) throw record.error;
    setBooking(record.data); setConversationId(conversation.data?.id ?? '');
    const values = timeline && typeof timeline === 'object' && 'updates' in timeline && Array.isArray(timeline.updates) ? timeline.updates : [];
    setUpdates(values as Row[]);
  }, [bookingId, user]);
  useEffect(() => {
    if (sessionLoading) return; if (!user) { router.replace('/auth'); return; } if (!roles.includes(role)) { router.replace('/role'); return; }
    // Synchronize the authoritative booking after auth and route inputs settle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((cause) => setError(cause instanceof Error ? cause.message : 'Booking unavailable.'));
  }, [load, role, roles, sessionLoading, user]);
  async function act(name: string, operation: () => Promise<unknown>, success: string) {
    setBusy(name); setError(''); setNotice('');
    try { await operation(); setNotice(success); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The booking action failed.'); }
    finally { setBusy(''); }
  }
  if (!booking && !error) return <SafeAreaView style={styles.center}><ActivityIndicator color={colors.teal} size="large" /></SafeAreaView>;
  if (!booking) return <SafeAreaView style={styles.center}><EmptyState title="Booking unavailable" message={error} retry={() => void load()} /></SafeAreaView>;
  const status = str(booking.status); const scheduledStart = new Date(str(booking.scheduled_start)); const scheduledEnd = new Date(str(booking.scheduled_end));
  const dateTime = (date: Date) => Number.isNaN(date.getTime()) ? 'Schedule unavailable' : date.toLocaleString('en-BS', { dateStyle: 'medium', timeStyle: 'short' });
  async function emergency() { await act('contact', async () => { const result = await marketplace('booking_emergency_contact', { booking_id: bookingId }); setContact(result as Row); }, 'Emergency-contact access recorded.'); }
  async function generateCode() { await act('code', async () => { const result = await marketplace('generate_session_code', { booking_id: bookingId }) as Row; const code = str(result.code); if (!/^\d{6}$/.test(code)) throw new Error('No valid visit code was issued.'); setVisitCode(code); }, 'Short-lived visit code generated.'); }
  async function checkIn() { if (!/^\d{6}$/.test(codeInput)) { setError('Enter the six-digit code shared by the client.'); return; } await act('checkin', async () => { await marketplace('verify_session_code', { booking_id: bookingId, code: codeInput }); await marketplace('transition_booking', { booking_id: bookingId, target: 'in_progress', reason: 'mobile_app' }, operationKey('checkin')); }, 'Visit code verified and visit checked in.'); }
  async function shareUpdate() { if (note.trim().length < 2) return; await act('update', () => marketplace('add_booking_visit_update', { booking_id: bookingId, update_type: 'activity', note: note.trim(), client_nonce: operationKey('visit-update') }), 'Private visit update shared with the client.'); setNote(''); }
  async function transition(target: string, success: string) { await act(target, () => marketplace('transition_booking', { booking_id: bookingId, target, reason: 'mobile_app' }, operationKey(target)), success); }
  async function cancel() { await act('cancel', async () => { const preview = await marketplace('preview_cancellation', { booking_id: bookingId }) as Row; await marketplace('cancel_booking', { booking_id: bookingId, reason_code: role === 'seller' ? 'seller_unavailable' : 'buyer_schedule_changed', expected_fee_minor: num(preview.fee_minor) }, operationKey('cancel')); }, 'Booking cancelled and the simulated refund was recorded.'); }
  async function dispute() { if (caseText.trim().length < 10) { setError('Describe what happened using at least 10 characters.'); return; } await act('dispute', () => marketplace('open_dispute', { booking_id: bookingId, reason_code: 'other', summary: caseText.trim() }), 'Service dispute opened for review.'); setCaseText(''); }
  async function review() { const value = Number(rating); if (!Number.isInteger(value) || value < 1 || value > 5) { setError('Choose a rating from 1 to 5.'); return; } await act('review', () => marketplace('submit_review', { booking_id: bookingId, rating: value, body: caseText.trim() }), 'Verified review submitted.'); setCaseText(''); }
  async function safety() { await act('safety', () => marketplace('trigger_safety_alert', { booking_id: bookingId, category: 'personal_safety' }), 'Urgent safety concern recorded for Nanas operations.'); }
  return <SafeAreaView style={styles.screen}><View style={styles.header}><Pressable onPress={() => router.back()} style={styles.icon}><ArrowLeft size={22} color={colors.ink} /></Pressable><Wordmark compact /><View style={{ width: 42 }} /></View><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.hero}><View style={styles.heroIcon}><CalendarDays size={26} color={colors.teal} /></View><Text style={styles.reference}>{str(booking.reference)}</Text><Text style={styles.status}>{label(status)}</Text><Text style={styles.amount}>{str(booking.currency) || 'BSD'} {(num(booking.total_minor) / 100).toFixed(2)}</Text></View>
    <View style={ui.card}><Text style={ui.cardTitle}>Visit schedule</Text><Text style={ui.cardCopy}>{dateTime(scheduledStart)}{`\n`}to {dateTime(scheduledEnd)}</Text><View style={ui.metaRow}><View style={ui.pill}><Text style={ui.pillText}>Timezone {str(booking.timezone) || 'America/Nassau'}</Text></View></View></View>
    {notice ? <Text style={styles.notice}>{notice}</Text> : null}{error ? <Text style={ui.error}>{error}</Text> : null}
    {conversationId && <SecondaryButton onPress={() => router.push(`/${role === 'buyer' ? 'buyer' : 'provider'}/conversation/${conversationId}` as Href)}><MessageCircle size={17} /> Open secure messages</SecondaryButton>}
    <Text style={styles.sectionTitle}>Emergency contact</Text>{contact && contact.configured === true && contact.contact && typeof contact.contact === 'object' ? <View style={ui.card}><Text style={ui.cardTitle}>{str((contact.contact as Row).name)}</Text><Text style={ui.cardCopy}>{str((contact.contact as Row).relationship)} · {str((contact.contact as Row).phone_e164)}</Text></View> : ['confirmed', 'in_progress', 'completion_pending'].includes(status) ? <SecondaryButton disabled={busy === 'contact'} onPress={() => void emergency()}><Phone size={17} /> Load audited contact</SecondaryButton> : <Text style={styles.muted}>Emergency-contact access is available only while care is active.</Text>}
    <Text style={styles.sectionTitle}>Private visit updates</Text>{updates.length ? updates.map((update, index) => <View key={str(update.id) || `${index}`} style={ui.card}><Text style={ui.cardTitle}>{label(update.update_type)}</Text><Text style={ui.cardCopy}>{str(update.note)}</Text></View>) : <Text style={styles.muted}>No visit updates have been shared.</Text>}
    {role === 'seller' && status === 'in_progress' && <View style={styles.form}><TextInput value={note} onChangeText={setNote} multiline placeholder="Share a brief factual visit update" placeholderTextColor="#71817F" style={styles.input} /><PrimaryButton loading={busy === 'update'} disabled={note.trim().length < 2} onPress={() => void shareUpdate()}>Share visit update</PrimaryButton></View>}
    {status === 'confirmed' && <View style={styles.actionPanel}>{role === 'buyer' ? <><Text style={styles.panelTitle}>Secure visit code</Text><Text style={styles.muted}>Generate this only when the provider is ready to check in.</Text><PrimaryButton loading={busy === 'code'} onPress={() => void generateCode()}>Generate 6-digit code</PrimaryButton>{visitCode && <Text style={styles.code}>{visitCode}</Text>}</> : <><Text style={styles.panelTitle}>Check in</Text><TextInput value={codeInput} onChangeText={(value) => setCodeInput(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="6-digit client code" placeholderTextColor="#71817F" style={styles.input} /><PrimaryButton loading={busy === 'checkin'} onPress={() => void checkIn()}>Verify code & check in</PrimaryButton></>}</View>}
    {role === 'seller' && status === 'in_progress' && <PrimaryButton loading={busy === 'completion_pending'} onPress={() => void transition('completion_pending', 'Visit checked out and client confirmation requested.')}>Check out visit</PrimaryButton>}
    {role === 'buyer' && status === 'completion_pending' && <PrimaryButton loading={busy === 'completed'} onPress={() => void transition('completed', 'Visit marked complete.')}>Confirm complete</PrimaryButton>}
    {status === 'completed' && <View style={styles.form}><Text style={styles.panelTitle}>Verified review</Text><TextInput value={rating} onChangeText={setRating} keyboardType="number-pad" placeholder="Rating 1–5" style={styles.input} /><TextInput value={caseText} onChangeText={setCaseText} multiline placeholder="Share your experience" placeholderTextColor="#71817F" style={styles.input} /><PrimaryButton loading={busy === 'review'} onPress={() => void review()}>Submit review</PrimaryButton></View>}
    {['confirmed', 'in_progress', 'completion_pending', 'completed'].includes(status) && <View style={styles.form}><Text style={styles.panelTitle}>Service support</Text><TextInput value={caseText} onChangeText={setCaseText} multiline placeholder="Describe what happened" placeholderTextColor="#71817F" style={styles.input} /><SecondaryButton disabled={busy === 'dispute'} onPress={() => void dispute()}>Open dispute</SecondaryButton></View>}
    {['confirmed', 'in_progress', 'completion_pending'].includes(status) && <Pressable onPress={() => void safety()} style={styles.danger}><ShieldAlert size={19} color={colors.danger} /><Text style={styles.dangerText}>Urgent safety concern</Text></Pressable>}
    {status === 'confirmed' && <Pressable onPress={() => void cancel()} style={styles.cancel}><AlertTriangle size={18} color={colors.warning} /><Text style={styles.cancelText}>{busy === 'cancel' ? 'Cancelling…' : 'Cancel with server-verified fee preview'}</Text></Pressable>}
    <View style={styles.protected}><LockKeyhole size={17} color={colors.teal} /><Text style={styles.protectedText}>Payment, visit, emergency-contact and dispute records remain protected by the same database policies as the web app.</Text></View>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.ivory }, center: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: colors.ivory }, header: { height: 62, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border }, icon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, content: { width: '100%', maxWidth: 860, alignSelf: 'center', padding: 16, paddingBottom: 46, gap: 12 }, hero: { borderRadius: 24, backgroundColor: colors.aqua, padding: 20 }, heroIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }, reference: { color: colors.ink, fontFamily: 'Georgia', fontSize: 26, fontWeight: '700', marginTop: 15 }, status: { color: colors.teal, fontWeight: '900', marginTop: 6 }, amount: { color: colors.ink, fontSize: 20, fontWeight: '900', marginTop: 12 }, notice: { color: colors.success, backgroundColor: '#E4F6EC', padding: 12, borderRadius: 12 }, sectionTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 21, fontWeight: '700', marginTop: 10 }, muted: { color: colors.muted, lineHeight: 20 }, form: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 14, gap: 10 }, actionPanel: { backgroundColor: colors.aqua, borderRadius: 20, padding: 16, gap: 11 }, panelTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' }, input: { minHeight: 50, maxHeight: 130, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.ivory, paddingHorizontal: 13, paddingVertical: 11, color: colors.ink }, code: { color: colors.ink, fontSize: 38, letterSpacing: 8, fontWeight: '900', textAlign: 'center' }, danger: { minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: '#F0B6B2', backgroundColor: '#FFF1F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, dangerText: { color: colors.danger, fontWeight: '900' }, cancel: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, cancelText: { color: colors.warning, fontWeight: '800' }, protected: { flexDirection: 'row', gap: 10, backgroundColor: colors.aqua, padding: 14, borderRadius: 16 }, protectedText: { flex: 1, color: colors.tealDark, lineHeight: 19, fontSize: 13 } });
