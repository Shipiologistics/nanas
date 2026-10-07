import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { PrimaryButton, SecondaryButton, ui } from '@/components/nanas-ui';
import { colors, type AppRole } from '@/constants/nanas';
import { useSession } from '@/contexts/session';
import { marketplace } from '@/lib/marketplace';
import { supabase } from '@/lib/supabase';
import { uploadImage } from '@/lib/upload';

type Row = Record<string, unknown>;
const string = (value: unknown) => typeof value === 'string' ? value : '';
const number = (value: unknown) => typeof value === 'number' ? value : Number(value || 0);
const list = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
const message = (cause: unknown) => cause instanceof Error ? cause.message : 'Something went wrong. Please try again.';

function Field({ label, multiline, ...props }: React.ComponentProps<typeof TextInput> & { label: string }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} multiline={multiline} placeholderTextColor="#788786" style={[styles.input, multiline && styles.multiline, props.style]} /></View>;
}

function Notice({ value, error = false }: { value: string; error?: boolean }) {
  return value ? <Text accessibilityRole="alert" style={[styles.notice, error && styles.noticeError]}>{value}</Text> : null;
}

function Choice({ selected, label, onPress }: { selected: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, selected && styles.choiceActive]}><Text style={[styles.choiceText, selected && styles.choiceTextActive]}>{label}</Text></Pressable>;
}

function FormCard({ title, copy, children }: { title: string; copy?: string; children: React.ReactNode }) {
  return <View style={ui.card}><Text style={ui.cardTitle}>{title}</Text>{copy ? <Text style={ui.cardCopy}>{copy}</Text> : null}<View style={styles.form}>{children}</View></View>;
}

export function WorkspaceTools({ role, section, onChanged }: { role: AppRole; section: string; onChanged: () => void }) {
  if (role === 'buyer' && section === 'household') return <HouseholdTools onChanged={onChanged} />;
  if (section === 'notifications') return <NotificationTools />;
  if (section === 'safety') return <SupportTools onChanged={onChanged} />;
  if (section === 'account') return <PrivacyTools />;
  if (role === 'seller' && section === 'availability') return <AvailabilityTools onChanged={onChanged} />;
  if (role === 'seller' && section === 'services') return <ServiceTools onChanged={onChanged} />;
  if (role === 'seller' && section === 'profile') return <ProfileTools onChanged={onChanged} />;
  if (role === 'seller' && section === 'kyc') return <VerificationTools onChanged={onChanged} />;
  return null;
}

function HouseholdTools({ onChanged }: { onChanged: () => void }) {
  const { user } = useSession();
  const [members, setMembers] = useState<Row[]>([]); const [contacts, setContacts] = useState<Row[]>([]);
  const [name, setName] = useState(''); const [relationship, setRelationship] = useState(''); const [birth, setBirth] = useState(''); const [notes, setNotes] = useState('');
  const [contactName, setContactName] = useState(''); const [phone, setPhone] = useState('+1'); const [contactRelationship, setContactRelationship] = useState(''); const [priority, setPriority] = useState('1');
  const [busy, setBusy] = useState(false); const [status, setStatus] = useState(''); const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!user) return;
    const [memberResult, contactResult] = await Promise.all([
      supabase.from('household_members').select('id,relationship,display_name,date_of_birth_private,care_notes_private,active').order('created_at'),
      supabase.from('emergency_contacts').select('id,name,phone_e164,relationship,priority,consent_confirmed_at').eq('user_id', user.id).order('priority'),
    ]);
    if (memberResult.error) throw memberResult.error; if (contactResult.error) throw contactResult.error;
    setMembers(memberResult.data ?? []); setContacts(contactResult.data ?? []);
  }, [user]);
  // The read begins only after the authenticated user dependency settles.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((cause) => setError(message(cause))); }, [load]);
  async function saveMember() {
    setBusy(true); setError(''); setStatus('');
    try {
      await marketplace('upsert_household_member', { relationship: relationship.trim(), display_name: name.trim(), date_of_birth: birth.trim() || null, care_notes: notes.trim(), active: true });
      setName(''); setRelationship(''); setBirth(''); setNotes(''); setStatus('Care recipient saved privately.'); await load(); onChanged();
    } catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  }
  async function saveContact() {
    setBusy(true); setError(''); setStatus('');
    try {
      await marketplace('upsert_emergency_contact', { name: contactName.trim(), phone_e164: phone.trim(), relationship: contactRelationship.trim(), priority: Number(priority), consent_confirmed: true });
      setContactName(''); setPhone('+1'); setContactRelationship(''); setPriority('1'); setStatus('Emergency contact saved with consent.'); await load();
    } catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  }
  async function revoke(id: string) {
    setBusy(true); setError('');
    try { await marketplace('revoke_emergency_contact', { contact_id: id }); setStatus('Emergency-contact consent revoked.'); await load(); }
    catch (cause) { setError(message(cause)); } finally { setBusy(false); }
  }
  return <View style={styles.tools}>
    <Notice value={status} /><Notice value={error} error />
    <FormCard title="Care recipients" copy="Private details are visible only where needed for care.">
      {members.map((item) => <View key={string(item.id)} style={styles.saved}><View style={{ flex: 1 }}><Text style={styles.savedTitle}>{string(item.display_name)}</Text><Text style={styles.savedCopy}>{string(item.relationship)}{item.active ? '' : ' · inactive'}</Text></View></View>)}
      <Field label="Name" value={name} onChangeText={setName} maxLength={80} placeholder="Recipient name" />
      <Field label="Relationship" value={relationship} onChangeText={setRelationship} maxLength={40} placeholder="Parent, child, pet…" />
      <Field label="Date of birth (optional)" value={birth} onChangeText={setBirth} placeholder="YYYY-MM-DD" autoCapitalize="none" />
      <Field label="Private care notes (optional)" value={notes} onChangeText={setNotes} maxLength={4000} multiline placeholder="Important care context" />
      <PrimaryButton loading={busy} disabled={name.trim().length < 1 || relationship.trim().length < 1} onPress={() => void saveMember()}>Save care recipient</PrimaryButton>
    </FormCard>
    <FormCard title="Emergency contacts" copy="Confirm that each person agreed to be contacted for care bookings.">
      {contacts.map((item) => <View key={string(item.id)} style={styles.saved}><View style={{ flex: 1 }}><Text style={styles.savedTitle}>{string(item.name)}</Text><Text style={styles.savedCopy}>{string(item.relationship)} · {string(item.phone_e164)} · priority {number(item.priority)}</Text></View>{item.consent_confirmed_at ? <Pressable disabled={busy} onPress={() => void revoke(string(item.id))}><Text style={styles.dangerLink}>Revoke</Text></Pressable> : <Text style={styles.muted}>Consent revoked</Text>}</View>)}
      <Field label="Contact name" value={contactName} onChangeText={setContactName} placeholder="Full name" />
      <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="+12425550123" keyboardType="phone-pad" />
      <Field label="Relationship" value={contactRelationship} onChangeText={setContactRelationship} placeholder="Sibling, neighbor…" />
      <Field label="Priority (1–10)" value={priority} onChangeText={setPriority} keyboardType="number-pad" />
      <PrimaryButton loading={busy} disabled={!contactName.trim() || !/^\+[1-9][0-9]{7,14}$/.test(phone.trim()) || !contactRelationship.trim() || Number(priority) < 1 || Number(priority) > 10} onPress={() => void saveContact()}>Save with consent</PrimaryButton>
    </FormCard>
  </View>;
}

const notificationCategories = [{ id: 'booking', label: 'Booking updates' }, { id: 'messages', label: 'Messages' }, { id: 'payments', label: 'Payment receipts' }, { id: 'account', label: 'Credential reminders' }];
function NotificationTools() {
  const { user } = useSession(); const [values, setValues] = useState<Record<string, boolean>>({}); const [busy, setBusy] = useState(''); const [error, setError] = useState('');
  useEffect(() => { if (!user) return; void supabase.from('notification_preferences').select('event_category,in_app,email').eq('user_id', user.id).then(({ data, error: queryError }) => { if (queryError) setError(queryError.message); else setValues(Object.fromEntries((data ?? []).map((item) => [item.event_category, item.in_app && item.email]))); }); }, [user]);
  async function toggle(category: string, enabled: boolean) {
    setBusy(category); setError('');
    try { await marketplace('set_notification_preference', { category, enabled }); setValues((current) => ({ ...current, [category]: enabled })); }
    catch (cause) { setError(message(cause)); } finally { setBusy(''); }
  }
  return <View style={styles.tools}><Notice value={error} error /><FormCard title="Notification preferences" copy="Choose which important updates arrive in-app and by email.">{notificationCategories.map((item) => <View key={item.id} style={styles.switchRow}><Text style={styles.savedTitle}>{item.label}</Text><Switch accessibilityLabel={item.label} disabled={busy === item.id} value={values[item.id] ?? true} onValueChange={(value) => void toggle(item.id, value)} trackColor={{ false: '#BCC8C6', true: colors.aquaStrong }} thumbColor={values[item.id] ?? true ? colors.teal : '#FFFFFF'} /></View>)}</FormCard></View>;
}

function SupportTools({ onChanged }: { onChanged: () => void }) {
  const [category, setCategory] = useState('other'); const [subject, setSubject] = useState(''); const [details, setDetails] = useState(''); const [busy, setBusy] = useState(false); const [status, setStatus] = useState(''); const [error, setError] = useState('');
  async function submit() { setBusy(true); setError(''); setStatus(''); try { await marketplace('create_support_case', { case_type: category, subject: subject.trim(), details: details.trim() }); setSubject(''); setDetails(''); setStatus('Support case opened. You can track it below.'); onChanged(); } catch (cause) { setError(message(cause)); } finally { setBusy(false); } }
  return <View style={styles.tools}><Notice value={status} /><Notice value={error} error /><FormCard title="Contact Nanas support" copy="For immediate danger, call local emergency services. This form does not contact emergency responders."><View style={styles.choices}>{['other', 'account', 'booking', 'payment', 'verification', 'safety', 'privacy', 'appeal'].map((item) => <Choice key={item} selected={category === item} label={item} onPress={() => setCategory(item)} />)}</View><Field label="Subject" value={subject} onChangeText={setSubject} maxLength={160} placeholder="How can we help?" /><Field label="Details" value={details} onChangeText={setDetails} maxLength={4000} multiline placeholder="Share the relevant facts" /><PrimaryButton loading={busy} disabled={subject.trim().length < 5 || details.trim().length < 10} onPress={() => void submit()}>Open support case</PrimaryButton></FormCard></View>;
}

function PrivacyTools() {
  const [busy, setBusy] = useState(false); const [status, setStatus] = useState(''); const [error, setError] = useState('');
  async function request(kind: 'request_data_export' | 'request_account_deletion') { setBusy(true); setError(''); setStatus(''); try { await marketplace(kind); setStatus(kind === 'request_data_export' ? 'Your data export request was opened.' : 'Your account-deletion request was opened for review.'); } catch (cause) { setError(message(cause)); } finally { setBusy(false); } }
  return <View style={styles.tools}><Notice value={status} /><Notice value={error} error /><FormCard title="Privacy requests" copy="Requests are tracked securely. Account deletion is reviewed before data is removed."><SecondaryButton disabled={busy} onPress={() => void request('request_data_export')}>Request my data export</SecondaryButton><SecondaryButton disabled={busy} onPress={() => Alert.alert('Request account deletion?', 'This opens a deletion request. It does not immediately erase your account.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Request deletion', style: 'destructive', onPress: () => void request('request_account_deletion') }])}>Request account deletion</SecondaryButton></FormCard></View>;
}

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function AvailabilityTools({ onChanged }: { onChanged: () => void }) {
  const [selected, setSelected] = useState([1, 2, 3, 4, 5]); const [start, setStart] = useState('08:00'); const [end, setEnd] = useState('17:00'); const [busy, setBusy] = useState(false); const [status, setStatus] = useState(''); const [error, setError] = useState('');
  async function save() { if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || end <= start) return setError('End time must be after start time.'); setBusy(true); setError(''); try { await marketplace('seller_replace_weekly_availability', { weekdays: selected, local_start: start, local_end: end }); setStatus('Weekly availability saved.'); onChanged(); } catch (cause) { setError(message(cause)); } finally { setBusy(false); } }
  return <View style={styles.tools}><Notice value={status} /><Notice value={error} error /><FormCard title="Set weekly availability" copy="Choose days and one same-day availability window."><View style={styles.choices}>{days.map((day, index) => <Choice key={day} label={day} selected={selected.includes(index)} onPress={() => setSelected((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index].sort())} />)}</View><View style={styles.columns}><Field label="Start" value={start} onChangeText={setStart} placeholder="08:00" /><Field label="End" value={end} onChangeText={setEnd} placeholder="17:00" /></View><PrimaryButton loading={busy} disabled={selected.length === 0} onPress={() => void save()}>Save availability</PrimaryButton></FormCard></View>;
}

function ServiceTools({ onChanged }: { onChanged: () => void }) {
  const { user } = useSession(); const [services, setServices] = useState<Row[]>([]); const [own, setOwn] = useState<Row[]>([]); const [serviceId, setServiceId] = useState(''); const [rate, setRate] = useState(''); const [rateMax, setRateMax] = useState(''); const [years, setYears] = useState('0'); const [bio, setBio] = useState(''); const [capabilities, setCapabilities] = useState(''); const [help, setHelp] = useState(''); const [active, setActive] = useState(true); const [busy, setBusy] = useState(false); const [status, setStatus] = useState(''); const [error, setError] = useState('');
  const load = useCallback(async () => { if (!user) return; const [catalog, rows] = await Promise.all([supabase.from('services').select('id,name').eq('active', true).order('name'), supabase.from('seller_services').select('id,service_id,rate_minor,rate_max_minor,service_bio,years_experience,capabilities,additional_help,active').eq('seller_id', user.id).order('created_at')]); if (catalog.error) throw catalog.error; if (rows.error) throw rows.error; setServices(catalog.data ?? []); setOwn(rows.data ?? []); setServiceId((current) => current || string(catalog.data?.[0]?.id)); }, [user]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((cause) => setError(message(cause))); }, [load]);
  const names = useMemo(() => new Map(services.map((item) => [string(item.id), string(item.name)])), [services]);
  function edit(item: Row) { setServiceId(string(item.service_id)); setRate((number(item.rate_minor) / 100).toFixed(2)); setRateMax(item.rate_max_minor == null ? '' : (number(item.rate_max_minor) / 100).toFixed(2)); setYears(String(number(item.years_experience))); setBio(string(item.service_bio)); setCapabilities(Array.isArray(item.capabilities) ? item.capabilities.join(', ') : ''); setHelp(Array.isArray(item.additional_help) ? item.additional_help.join(', ') : ''); setActive(Boolean(item.active)); }
  async function save() { if (!own.some((item) => string(item.service_id) === serviceId) && own.length >= 3) return setError('You can add up to three service profiles.'); if (active && bio.trim().length < 180) return setError('Active service biographies must be at least 180 characters.'); setBusy(true); setError(''); try { await marketplace('seller_upsert_service', { service_id: serviceId, rate_minor: Math.round(Number(rate) * 100), rate_max_minor: rateMax ? Math.round(Number(rateMax) * 100) : null, service_bio: bio.trim(), years_experience: Number(years), capabilities: list(capabilities), additional_help: list(help), active }); setStatus('Service profile saved.'); await load(); onChanged(); } catch (cause) { setError(message(cause)); } finally { setBusy(false); } }
  return <View style={styles.tools}><Notice value={status} /><Notice value={error} error /><FormCard title="Service profiles" copy="You can publish up to three focused service profiles.">{own.map((item) => <Pressable key={string(item.id)} onPress={() => edit(item)} style={styles.saved}><View style={{ flex: 1 }}><Text style={styles.savedTitle}>{names.get(string(item.service_id)) || 'Care service'}</Text><Text style={styles.savedCopy}>BSD {(number(item.rate_minor) / 100).toFixed(2)} · {item.active ? 'active' : 'inactive'}</Text></View><Text style={styles.edit}>Edit</Text></Pressable>)}<Text style={styles.label}>Service</Text><View style={styles.choices}>{services.map((item) => <Choice key={string(item.id)} label={string(item.name)} selected={serviceId === item.id} onPress={() => setServiceId(string(item.id))} />)}</View><View style={styles.columns}><Field label="From (BSD/hr)" value={rate} onChangeText={setRate} keyboardType="decimal-pad" /><Field label="To (optional)" value={rateMax} onChangeText={setRateMax} keyboardType="decimal-pad" /></View><Field label="Years of experience" value={years} onChangeText={setYears} keyboardType="number-pad" /><Field label="Public service biography" value={bio} onChangeText={setBio} maxLength={2000} multiline placeholder="At least 180 characters while active" /><Field label="Capabilities (comma-separated)" value={capabilities} onChangeText={setCapabilities} /><Field label="Additional help (comma-separated)" value={help} onChangeText={setHelp} /><View style={styles.switchRow}><Text style={styles.savedTitle}>Active and public</Text><Switch value={active} onValueChange={setActive} /></View><PrimaryButton loading={busy} disabled={!serviceId || !Number.isFinite(Number(rate)) || Number(rate) < 0} onPress={() => void save()}>Save service profile</PrimaryButton></FormCard></View>;
}

function ProfileTools({ onChanged }: { onChanged: () => void }) {
  const { user } = useSession(); const [profile, setProfile] = useState<Row>({}); const [areas, setAreas] = useState<Row[]>([]); const [coverage, setCoverage] = useState<Row[]>([]); const [displayName, setDisplayName] = useState(''); const [headline, setHeadline] = useState(''); const [locality, setLocality] = useState(''); const [languages, setLanguages] = useState('en-BS'); const [vaccinations, setVaccinations] = useState(''); const [details, setDetails] = useState(''); const [areaId, setAreaId] = useState(''); const [radius, setRadius] = useState('25'); const [travelFee, setTravelFee] = useState('0'); const [busy, setBusy] = useState(false); const [status, setStatus] = useState(''); const [error, setError] = useState('');
  const load = useCallback(async () => { if (!user) return; const [p, a, c] = await Promise.all([supabase.from('seller_profiles').select('display_name,avatar_path,headline,languages,island_id,locality,vaccinations,additional_details,status,profile_published_at').eq('user_id', user.id).maybeSingle(), supabase.from('service_areas').select('id,name').eq('active', true).order('name'), supabase.from('seller_service_areas').select('id,service_area_id,radius_km,travel_fee_minor,active').eq('seller_id', user.id).order('created_at')]); if (p.error) throw p.error; if (a.error) throw a.error; if (c.error) throw c.error; const row: Row = p.data ?? {}; setProfile(row); setDisplayName(string(row.display_name)); setHeadline(string(row.headline)); setLocality(string(row.locality)); setLanguages(Array.isArray(row.languages) ? row.languages.join(', ') : 'en-BS'); setVaccinations(Array.isArray(row.vaccinations) ? row.vaccinations.join(', ') : ''); setDetails(Array.isArray(row.additional_details) ? row.additional_details.join(', ') : ''); setAreas(a.data ?? []); setCoverage(c.data ?? []); setAreaId((current) => current || string(a.data?.[0]?.id)); }, [user]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((cause) => setError(message(cause))); }, [load]);
  const areaNames = useMemo(() => new Map(areas.map((item) => [string(item.id), string(item.name)])), [areas]);
  async function saveProfile() { setBusy(true); setError(''); try { await marketplace('seller_update_public_profile', { display_name: displayName.trim(), avatar_path: profile.avatar_path ?? null, headline: headline.trim() || null, languages: list(languages), island_id: profile.island_id ?? null, locality: locality.trim() || null, vaccinations: list(vaccinations), additional_details: list(details) }); setStatus('Public provider profile saved.'); await load(); onChanged(); } catch (cause) { setError(message(cause)); } finally { setBusy(false); } }
  async function choosePhoto() { setBusy(true); setError(''); try { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 }); if (result.canceled) return; const uploaded = await uploadImage(result.assets[0], 'profile'); await marketplace('seller_update_public_profile', { display_name: displayName.trim(), avatar_path: uploaded.assetRef, headline: headline.trim() || null, languages: list(languages), island_id: profile.island_id ?? null, locality: locality.trim() || null, vaccinations: list(vaccinations), additional_details: list(details) }); setStatus('Profile photo uploaded and saved.'); await load(); onChanged(); } catch (cause) { setError(message(cause)); } finally { setBusy(false); } }
  async function publish() { setBusy(true); setError(''); try { const published = !profile.profile_published_at; await marketplace('seller_set_publication', { published }); setStatus(published ? 'Provider profile published.' : 'Provider profile unpublished.'); await load(); onChanged(); } catch (cause) { setError(message(cause)); } finally { setBusy(false); } }
  async function saveCoverage() { setBusy(true); setError(''); try { await marketplace('seller_upsert_service_area', { service_area_id: areaId, radius_km: Number(radius), travel_fee_minor: Math.round(Number(travelFee) * 100), active: true }); setStatus('Coverage area saved.'); await load(); } catch (cause) { setError(message(cause)); } finally { setBusy(false); } }
  return <View style={styles.tools}><Notice value={status} /><Notice value={error} error /><FormCard title="Public profile" copy={`Approval: ${string(profile.status) || 'draft'} · ${profile.profile_published_at ? 'published' : 'not published'}`}><Field label="Display name" value={displayName} onChangeText={setDisplayName} maxLength={80} /><Field label="Headline" value={headline} onChangeText={setHeadline} maxLength={120} /><Field label="Locality" value={locality} onChangeText={setLocality} /><Field label="Languages (comma-separated)" value={languages} onChangeText={setLanguages} /><Field label="Vaccinations (comma-separated)" value={vaccinations} onChangeText={setVaccinations} /><Field label="Additional details (comma-separated)" value={details} onChangeText={setDetails} /><SecondaryButton disabled={busy} onPress={() => void choosePhoto()}>Choose and upload profile photo</SecondaryButton><PrimaryButton loading={busy} disabled={displayName.trim().length < 2} onPress={() => void saveProfile()}>Save public profile</PrimaryButton><SecondaryButton disabled={busy} onPress={() => void publish()}>{profile.profile_published_at ? 'Unpublish profile' : 'Publish profile'}</SecondaryButton></FormCard><FormCard title="Coverage areas">{coverage.map((item) => <View key={string(item.id)} style={styles.saved}><Text style={styles.savedTitle}>{areaNames.get(string(item.service_area_id)) || 'Service area'} · {number(item.radius_km)} km · BSD {(number(item.travel_fee_minor) / 100).toFixed(2)}</Text></View>)}<Text style={styles.label}>Area</Text><View style={styles.choices}>{areas.map((item) => <Choice key={string(item.id)} label={string(item.name)} selected={areaId === item.id} onPress={() => setAreaId(string(item.id))} />)}</View><View style={styles.columns}><Field label="Radius (km)" value={radius} onChangeText={setRadius} keyboardType="decimal-pad" /><Field label="Travel fee (BSD)" value={travelFee} onChangeText={setTravelFee} keyboardType="decimal-pad" /></View><PrimaryButton loading={busy} disabled={!areaId || Number(radius) < 0 || Number(radius) > 500} onPress={() => void saveCoverage()}>Save coverage</PrimaryButton></FormCard></View>;
}

function VerificationTools({ onChanged }: { onChanged: () => void }) {
  const [type, setType] = useState('government_id'); const [busy, setBusy] = useState(false); const [status, setStatus] = useState(''); const [error, setError] = useState('');
  async function upload() { setBusy(true); setError(''); setStatus(''); try { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.9 }); if (result.canceled) return; const asset = result.assets[0]; const uploaded = await uploadImage(asset, 'verification'); await marketplace('submit_verification_document', { document_type: type, storage_path: uploaded.databasePath, original_name: asset.fileName || `${type}.jpg` }); setStatus('Verification document submitted for review.'); onChanged(); } catch (cause) { setError(message(cause)); } finally { setBusy(false); } }
  return <View style={styles.tools}><Notice value={status} /><Notice value={error} error /><FormCard title="Submit verification evidence" copy="Images are protected and reviewed only by authorized Nanas staff."><View style={styles.choices}>{['government_id', 'background_check', 'credential', 'insurance'].map((item) => <Choice key={item} label={item.replaceAll('_', ' ')} selected={type === item} onPress={() => setType(item)} />)}</View><PrimaryButton loading={busy} onPress={() => void upload()}>Choose image and submit</PrimaryButton></FormCard></View>;
}

export function notificationDestination(role: AppRole, deepLink: unknown): string | null {
  const match = string(deepLink).match(/^\/app\/(buyer|seller)\/([a-z-]+)(?:\/([A-Za-z0-9-]+))?$/);
  if (!match || match[1] !== role) return null;
  const prefix = role === 'buyer' ? 'buyer' : 'provider'; const section = match[2]; const id = match[3];
  if (id && section === 'bookings') return `/${prefix}/booking/${id}`;
  if (id && section === 'messages') return `/${prefix}/conversation/${id}`;
  if (id && (section === 'care-requests' || section === 'requests')) return `/${prefix}/request/${id}`;
  return `/${prefix}/${section}`;
}

export async function openNotification(role: AppRole, row: Row) {
  if (!row.read_at) await marketplace('mark_notification_read', { notification_id: row.id });
  const destination = notificationDestination(role, row.deep_link);
  if (destination) router.push(destination as never);
}

const styles = StyleSheet.create({
  tools: { marginTop: 16, gap: 10 }, form: { marginTop: 14, gap: 12 }, field: { flex: 1, minWidth: 0, gap: 6 }, label: { color: colors.ink, fontWeight: '800', fontSize: 13 }, input: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.ivory, color: colors.ink, paddingHorizontal: 13, fontSize: 16 }, multiline: { minHeight: 104, paddingTop: 13, textAlignVertical: 'top' }, notice: { borderRadius: 14, backgroundColor: '#E3F5EC', color: colors.success, padding: 13, lineHeight: 19 }, noticeError: { backgroundColor: '#FFF1F0', color: colors.danger }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9 }, choiceActive: { backgroundColor: colors.teal, borderColor: colors.teal }, choiceText: { color: colors.ink, fontWeight: '700', textTransform: 'capitalize' }, choiceTextActive: { color: colors.white }, saved: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, savedTitle: { color: colors.ink, fontWeight: '800', lineHeight: 20 }, savedCopy: { color: colors.muted, marginTop: 3, lineHeight: 18 }, muted: { color: colors.muted, fontSize: 12 }, edit: { color: colors.teal, fontWeight: '800' }, dangerLink: { color: colors.danger, fontWeight: '800' }, switchRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, columns: { flexDirection: 'row', gap: 10 },
});
