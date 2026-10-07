import { router, type Href } from 'expo-router';
import { ArrowLeft, Check, Repeat2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton, Wordmark, ui } from '@/components/nanas-ui';
import { colors } from '@/constants/nanas';
import { useSession } from '@/contexts/session';
import { marketplace, operationKey } from '@/lib/marketplace';
import { supabase } from '@/lib/supabase';

type Option = Record<string, unknown>;
const str = (value: unknown) => typeof value === 'string' ? value : '';
const num = (value: unknown) => typeof value === 'number' ? value : 0;
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function NewRequestScreen() {
  const { user, roles, loading: sessionLoading } = useSession();
  const [services, setServices] = useState<Option[]>([]); const [areas, setAreas] = useState<Option[]>([]); const [plans, setPlans] = useState<Option[]>([]); const [members, setMembers] = useState<Option[]>([]); const [contacts, setContacts] = useState<Option[]>([]);
  const [serviceId, setServiceId] = useState(''); const [areaId, setAreaId] = useState(''); const [planCode, setPlanCode] = useState('free'); const [memberId, setMemberId] = useState(''); const [contactId, setContactId] = useState('');
  const [summary, setSummary] = useState(''); const [responsibilities, setResponsibilities] = useState(''); const [address, setAddress] = useState(''); const [locality, setLocality] = useState('Nassau');
  const [startDate, setStartDate] = useState(''); const [startTime, setStartTime] = useState('09:00'); const [endTime, setEndTime] = useState('12:00'); const [recurring, setRecurring] = useState(false); const [days, setDays] = useState<number[]>([]);
  const [budget, setBudget] = useState('100'); const [minRate, setMinRate] = useState('15'); const [maxRate, setMaxRate] = useState('35'); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => {
    if (sessionLoading) return; if (!user) { router.replace('/auth'); return; } if (!roles.includes('buyer')) { router.replace('/role'); return; }
    Promise.all([
      supabase.from('care_intake_subcategories').select('code,name,service_id,category_code').eq('active', true).order('sort_order'),
      supabase.from('service_areas').select('id,name,island_id').eq('active', true).order('name'),
      supabase.from('job_posting_plans').select('code,name,description,fee_minor,currency,duration_days,featured').eq('active', true).order('sort_order'),
      supabase.from('households').select('id').eq('owner_user_id', user.id).maybeSingle(),
      supabase.from('emergency_contacts').select('id,name,relationship,priority,consent_confirmed_at').eq('user_id', user.id).not('consent_confirmed_at', 'is', null).order('priority'),
    ]).then(async ([serviceResult, areaResult, planResult, householdResult, contactResult]) => {
      const failure = serviceResult.error ?? areaResult.error ?? planResult.error ?? householdResult.error ?? contactResult.error; if (failure) throw failure;
      const householdId = householdResult.data?.id; const memberResult = householdId ? await supabase.from('household_members').select('id,display_name,relationship').eq('household_id', householdId).eq('active', true).order('created_at') : { data: [], error: null };
      if (memberResult.error) throw memberResult.error;
      setServices(serviceResult.data ?? []); setAreas(areaResult.data ?? []); setPlans(planResult.data ?? []); setMembers(memberResult.data ?? []); setContacts(contactResult.data ?? []);
      setServiceId(serviceResult.data?.[0]?.service_id ?? ''); setAreaId(areaResult.data?.[0]?.id ?? ''); setPlanCode(planResult.data?.[0]?.code ?? 'free'); setLoading(false);
    }).catch((cause) => { setError(cause instanceof Error ? cause.message : 'Request options could not be loaded.'); setLoading(false); });
  }, [roles, sessionLoading, user]);
  const chosenService = useMemo(() => services.find((item) => item.service_id === serviceId), [serviceId, services]);
  const chosenArea = useMemo(() => areas.find((item) => item.id === areaId), [areaId, areas]);
  const chosenPlan = useMemo(() => plans.find((item) => item.code === planCode), [planCode, plans]);
  const toggleDay = (day: number) => setDays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort());
  function validate() {
    if (!chosenService || !chosenArea || !chosenPlan) return 'Choose a service, area and posting plan.';
    if (summary.trim().length < 10) return 'Describe the care needed using at least 10 characters.';
    if (address.trim().length < 3 || locality.trim().length < 2) return 'Add the care location and locality.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || Number.isNaN(new Date(`${startDate}T${startTime}:00-04:00`).getTime())) return 'Use a valid future date in YYYY-MM-DD format.';
    if (new Date(`${startDate}T${startTime}:00-04:00`).getTime() <= Date.now()) return 'Choose a future visit date.';
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || endTime <= startTime) return 'Choose a valid same-day time range.';
    if (recurring && days.length === 0) return 'Choose at least one recurring weekday.';
    if (Number(minRate) < 1 || Number(maxRate) < Number(minRate) || Number(budget) < 1) return 'Enter a valid budget and hourly range.';
    return '';
  }
  async function publish() {
    const problem = validate(); if (problem) { setError(problem); return; }
    setBusy(true); setError('');
    try {
      if (num(chosenPlan?.fee_minor) > 0) { const allowed = await supabase.rpc('payment_simulation_allowed'); if (allowed.error) throw allowed.error; if (allowed.data !== true) throw new Error('Paid request posting is not enabled. Nothing was charged or published.'); }
      const start = new Date(`${startDate}T${startTime}:00-04:00`); const end = new Date(`${startDate}T${endTime}:00-04:00`); const needs = responsibilities.split(',').map((item) => item.trim()).filter(Boolean);
      const payload = {
        service_id: serviceId, service_area_id: areaId, desired_start: start.toISOString(), desired_end: end.toISOString(), mode: 'scheduled', care_summary: summary.trim().slice(0, 1200), budget_minor: Math.round(Number(budget) * 100), rate_min_minor: Math.round(Number(minRate) * 100), rate_max_minor: Math.round(Number(maxRate) * 100), household_member_id: memberId || null, emergency_contact_id: contactId || null,
        recipients: [], address: { label: 'Care location', line1: address.trim(), line2: '', locality: locality.trim(), island_id: str(chosenArea?.island_id), postal_code: '', access_notes: '' },
        schedule: { kind: recurring ? 'recurring' : 'one_time', start_date: startDate, end_date: '', flexible_start: false, weekdays: recurring ? days : [], time_periods: [], specific_start: startTime, specific_end: endTime, schedule_may_vary: false },
        category_code: str(chosenService?.category_code), subcategory_code: str(chosenService?.code), intake_answers: { responsibilities: needs, caregiver_qualities: [], extras: [] }, intake_public_summary: { category: str(chosenService?.category_code).replaceAll('_', ' '), service: str(chosenService?.name), responsibilities: needs, caregiver_qualities: [], extras: [] }, care_requirements: { category_code: str(chosenService?.category_code), subcategory_code: str(chosenService?.code), responsibilities: needs, caregiver_qualities: [] }, access_notes: '', posting_plan_code: str(chosenPlan?.code), simulated_payment_confirmed: num(chosenPlan?.fee_minor) > 0, expected_fee_minor: num(chosenPlan?.fee_minor), idempotency_key: operationKey('post-request'),
      };
      const result = await marketplace('create_care_request', payload) as Option; const id = str(result.request_id); if (!id) throw new Error('Request publication was not confirmed.'); router.replace(`/buyer/request/${id}` as Href);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Request could not be published.'); setBusy(false); }
  }
  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color={colors.teal} /></SafeAreaView>;
  return <SafeAreaView style={styles.screen}><View style={styles.header}><Pressable onPress={() => router.back()} style={styles.icon}><ArrowLeft size={22} color={colors.ink} /></Pressable><Wordmark compact /><View style={{ width: 42 }} /></View><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Text style={styles.eyebrow}>POST A CARE REQUEST</Text><Text style={styles.title}>Tell us what you need.</Text><Text style={styles.copy}>Only the fields already used by the Nanas web request workflow are included.</Text>
    <FieldTitle>Service</FieldTitle><ChipGrid rows={services} selected={serviceId} idKey="service_id" labelKey="name" onSelect={setServiceId} />
    <FieldTitle>Area</FieldTitle><ChipGrid rows={areas} selected={areaId} idKey="id" labelKey="name" onSelect={setAreaId} />
    <Field label="Care summary" value={summary} onChangeText={setSummary} multiline placeholder="Who needs help and what support is required?" /><Field label="Responsibilities" value={responsibilities} onChangeText={setResponsibilities} placeholder="Companionship, meals, mobility" /><Field label="Address" value={address} onChangeText={setAddress} placeholder="Care location" /><Field label="Town or locality" value={locality} onChangeText={setLocality} />
    {members.length > 0 && <><FieldTitle>Care recipient</FieldTitle><ChipGrid rows={[{ id: '', display_name: 'Not selected' }, ...members]} selected={memberId} idKey="id" labelKey="display_name" onSelect={setMemberId} /></>}{contacts.length > 0 && <><FieldTitle>Emergency contact</FieldTitle><ChipGrid rows={[{ id: '', name: 'Not selected' }, ...contacts]} selected={contactId} idKey="id" labelKey="name" onSelect={setContactId} /></>}
    <Field label="Start date" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" autoCapitalize="none" /><View style={styles.two}><View style={{ flex: 1 }}><Field label="Start time" value={startTime} onChangeText={setStartTime} placeholder="09:00" /></View><View style={{ flex: 1 }}><Field label="End time" value={endTime} onChangeText={setEndTime} placeholder="12:00" /></View></View>
    <Pressable onPress={() => setRecurring((value) => !value)} style={[styles.toggle, recurring && styles.selected]}><Repeat2 size={20} color={colors.teal} /><Text style={styles.toggleText}>Recurring care</Text>{recurring && <Check size={19} color={colors.teal} />}</Pressable>{recurring && <View style={styles.weekdays}>{weekdays.map((day, index) => <Pressable key={day} onPress={() => toggleDay(index)} style={[styles.day, days.includes(index) && styles.dayActive]}><Text style={[styles.dayText, days.includes(index) && styles.dayTextActive]}>{day}</Text></Pressable>)}</View>}
    <View style={styles.three}><View style={{ flex: 1 }}><Field label="Budget" value={budget} onChangeText={setBudget} keyboardType="decimal-pad" /></View><View style={{ flex: 1 }}><Field label="Min/hr" value={minRate} onChangeText={setMinRate} keyboardType="decimal-pad" /></View><View style={{ flex: 1 }}><Field label="Max/hr" value={maxRate} onChangeText={setMaxRate} keyboardType="decimal-pad" /></View></View>
    <FieldTitle>Posting plan</FieldTitle><ChipGrid rows={plans} selected={planCode} idKey="code" labelKey="name" onSelect={setPlanCode} />{chosenPlan && <View style={ui.card}><Text style={ui.cardTitle}>{str(chosenPlan.name)}</Text><Text style={ui.cardCopy}>{str(chosenPlan.description)} · {str(chosenPlan.currency) || 'BSD'} {(num(chosenPlan.fee_minor) / 100).toFixed(2)} test fee</Text></View>}
    {error ? <Text style={ui.error}>{error}</Text> : null}<PrimaryButton loading={busy} onPress={() => void publish()}>Review & publish request</PrimaryButton><Text style={styles.foot}>Any paid plan uses the connected test-payment simulation. No real money is charged.</Text>
  </ScrollView></SafeAreaView>;
}

function FieldTitle({ children }: { children: string }) { return <Text style={styles.fieldTitle}>{children}</Text>; }
function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) { const { label, ...rest } = props; return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...rest} style={[styles.input, rest.multiline && { minHeight: 90 }]} placeholderTextColor="#71817F" /></View>; }
function ChipGrid({ rows, selected, idKey, labelKey, onSelect }: { rows: Option[]; selected: string; idKey: string; labelKey: string; onSelect: (value: string) => void }) { return <View style={styles.chips}>{rows.map((row, index) => { const id = str(row[idKey]); const active = id === selected; return <Pressable key={id || `${index}`} onPress={() => onSelect(id)} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{str(row[labelKey])}</Text></Pressable>; })}</View>; }
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.ivory }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.ivory }, header: { height: 62, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border }, icon: { width: 42, height: 42, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }, content: { width: '100%', maxWidth: 860, alignSelf: 'center', padding: 16, paddingBottom: 48, gap: 11 }, eyebrow: { color: colors.teal, fontWeight: '900', letterSpacing: 1.3, marginTop: 7 }, title: { color: colors.ink, fontFamily: 'Georgia', fontSize: 32, fontWeight: '700' }, copy: { color: colors.muted, lineHeight: 21 }, fieldTitle: { color: colors.ink, fontSize: 17, fontWeight: '900', marginTop: 8 }, field: { gap: 6 }, label: { color: colors.ink, fontSize: 12, fontWeight: '800' }, input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.white, paddingHorizontal: 13, paddingVertical: 11, color: colors.ink }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white }, chipActive: { borderColor: colors.teal, backgroundColor: colors.aqua }, chipText: { color: colors.muted, fontWeight: '700' }, chipTextActive: { color: colors.tealDark, fontWeight: '900' }, two: { flexDirection: 'row', gap: 9 }, three: { flexDirection: 'row', gap: 7 }, toggle: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.white, paddingHorizontal: 14 }, selected: { borderColor: colors.teal, backgroundColor: colors.aqua }, toggleText: { flex: 1, color: colors.ink, fontWeight: '900' }, weekdays: { flexDirection: 'row', justifyContent: 'space-between' }, day: { width: 40, height: 40, borderRadius: 13, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white }, dayActive: { backgroundColor: colors.teal, borderColor: colors.teal }, dayText: { color: colors.muted, fontSize: 11, fontWeight: '800' }, dayTextActive: { color: colors.white }, foot: { color: colors.muted, fontSize: 12, textAlign: 'center', lineHeight: 17 } });
