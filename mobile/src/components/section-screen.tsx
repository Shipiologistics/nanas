import { router, type Href } from 'expo-router';
import {
  BadgeCheck, CalendarDays, ChevronRight, CircleDollarSign, Clock3, FileCheck2,
  HeartHandshake, Home, LifeBuoy, MessageCircle, Search, Settings,
  ShieldCheck, Star, Stethoscope, UserRoundCheck, Users, WalletCards, X,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader, EmptyState, Hero, PrimaryButton, SecondaryButton, ui } from '@/components/nanas-ui';
import { colors, mainTabs, sectionFor, sectionsFor, type AppRole } from '@/constants/nanas';
import { useSession } from '@/contexts/session';
import { loadSectionData, markAllNotificationsRead, type SectionRecord } from '@/lib/section-data';
import { openNotification, WorkspaceTools } from '@/components/workspace-tools';
import buyerHero from '@/assets/nanas/hero-find-care-mobile.webp';
import providerHero from '@/assets/nanas/hero-seller-mobile.webp';

const icons: Record<string, LucideIcon> = {
  overview: Home, 'find-care': Search, 'care-requests': HeartHandshake, requests: Search,
  quotes: FileCheck2, bookings: CalendarDays, messages: MessageCircle, wallet: WalletCards,
  reviews: Star, favorites: Star, household: Users, notifications: MessageCircle, safety: LifeBuoy,
  account: ShieldCheck, availability: Clock3, services: Stethoscope, earnings: CircleDollarSign,
  profile: UserRoundCheck, kyc: FileCheck2, badges: BadgeCheck,
};

const heroImages = {
  buyer: buyerHero,
  seller: providerHero,
};

function text(value: unknown) { return typeof value === 'string' ? value : ''; }
function number(value: unknown) { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function pretty(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function date(value: unknown) {
  const source = text(value); if (!source) return '';
  const parsed = new Date(source); if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('en-BS', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed);
}
function money(row: SectionRecord) {
  const amount = number(row.total_minor) ?? number(row.balance_minor) ?? number(row.base_minor) ?? number(row.rate_minor) ?? number(row.budget_minor) ?? number(row.seller_net_minor);
  if (amount === null) return '';
  return `${text(row.currency) || 'BSD'} ${(amount / 100).toFixed(2)}`;
}
function recordTitle(row: SectionRecord) {
  const conversationType = text(row.conversation_type);
  if (conversationType === 'booking') return 'Booking conversation';
  if (conversationType === 'request') return 'Care request conversation';
  if (row.request_id && (row.base_minor !== undefined || row.total_minor !== undefined)) return 'Quote for care request';
  if (row.overall_rating !== undefined) return `${number(row.overall_rating) ?? 0}/5 verified review`;
  const direct = ['display_name', 'title', 'subject', 'reference', 'care_summary', 'headline', 'document_type', 'conversation_type'].map((key) => text(row[key])).find(Boolean);
  if (direct) return direct;
  if (row.badges && typeof row.badges === 'object' && !Array.isArray(row.badges)) {
    const badgeName = text((row.badges as SectionRecord).name); if (badgeName) return badgeName;
  }
  const summary = text(row.summary_key); if (summary) return pretty(summary);
  return 'Nanas record';
}
function recordCopy(row: SectionRecord) {
  const direct = ['body', 'message', 'locality', 'service_bio', 'case_type'].map((key) => text(row[key])).find(Boolean);
  if (direct) return direct;
  if (row.policy_snapshot && typeof row.policy_snapshot === 'object' && !Array.isArray(row.policy_snapshot)) {
    const sellerMessage = text((row.policy_snapshot as SectionRecord).seller_message); if (sellerMessage) return sellerMessage;
  }
  if (row.badges && typeof row.badges === 'object' && !Array.isArray(row.badges)) {
    const description = text((row.badges as SectionRecord).description); if (description) return description;
  }
  const starts = date(row.scheduled_start ?? row.desired_start ?? row.created_at ?? row.updated_at);
  return starts ? `Updated ${starts}` : 'Open to review details.';
}
function emptyCopy(role: AppRole, section: string) {
  const base: Record<string, string> = {
    'find-care': 'No approved providers match the current directory view.', 'care-requests': 'You have not posted a care request yet.',
    requests: 'There are no eligible care requests matching your approved services.', quotes: 'No quotes are available yet.',
    bookings: 'No bookings are available for this account.', messages: 'No secure conversations are available yet.',
    wallet: 'No wallet record is available yet.', earnings: 'No earnings record is available yet.', reviews: 'No eligible reviews are available yet.',
    favorites: 'You have not saved a provider yet.', household: 'No household has been added yet.', notifications: 'You are all caught up.',
    safety: 'You have no support or safety cases.', availability: 'No weekly availability has been saved.', services: 'No provider service has been added.',
    profile: 'Your provider profile has not been created.', kyc: 'No verification documents have been submitted.', badges: 'No badges have been awarded.',
    account: 'Your account profile could not be loaded.', overview: role === 'buyer' ? 'Your care activity will appear here.' : 'Your provider activity will appear here.',
  };
  return base[section] ?? 'No records are available.';
}

export function SectionScreen({ workspaceRole: role, section }: { workspaceRole: AppRole; section: string }) {
  const { user, roles, loading: sessionLoading, signOut } = useSession();
  const definition = sectionFor(role, section);
  const [rows, setRows] = useState<SectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState(false);
  const prefix = role === 'buyer' ? 'buyer' : 'provider';

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) { router.replace('/auth'); return; }
    if (!roles.includes(role)) { router.replace('/role'); return; }
    if (!definition) router.replace(`/${prefix}/overview` as Href);
  }, [definition, prefix, role, roles, sessionLoading, user]);

  const load = useCallback(async (refresh = false) => {
    if (!user || !definition) return;
    if (refresh) setRefreshing(true); else setLoading(true);
    setError('');
    try { setRows(await loadSectionData(role, section, user.id)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'This section could not be loaded.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [definition, role, section, user]);

  // The request starts after route, session and role inputs settle.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(normalized));
  }, [query, rows]);

  if (!definition) return null;
  const showSearch = ['find-care', 'care-requests', 'requests', 'quotes', 'bookings', 'messages'].includes(section);
  const useImage = section === 'find-care' || (role === 'seller' && section === 'overview');

  async function readAll() {
    if (!user) return;
    try { await markAllNotificationsRead(user.id); await load(true); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Notifications could not be updated.'); }
  }

  return <SafeAreaView style={ui.screen} edges={['top']}>
    <AppHeader role={role} onMenu={() => setMenu(true)} />
    <ScrollView contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.teal} />}>
      <Hero eyebrow={definition.eyebrow} title={definition.title} description={definition.description} image={useImage ? heroImages[role] : undefined} />
      {role === 'buyer' && section === 'care-requests' && <View style={{ marginTop: 12 }}><PrimaryButton onPress={() => router.push('/buyer/request-new')}>Post a care request</PrimaryButton></View>}
      {showSearch && <View style={styles.search}><Search size={19} color={colors.muted} /><TextInput value={query} onChangeText={setQuery} placeholder={`Search ${definition.label.toLowerCase()}`} placeholderTextColor="#7A8887" style={styles.input} autoCapitalize="none" returnKeyType="search" /></View>}
      {section === 'notifications' && rows.some((row) => !row.read_at) && <View style={styles.inlineAction}><SecondaryButton onPress={() => void readAll()}>Mark all as read</SecondaryButton></View>}
      {error ? <Text accessibilityRole="alert" style={ui.error}>{error}</Text> : null}
      <WorkspaceTools role={role} section={section} onChanged={() => void load(true)} />
      <View style={ui.section}>
        <Text style={ui.sectionTitle}>{section === 'overview' ? 'At a glance' : definition.label}</Text>
        {loading ? <View style={styles.loader}><ActivityIndicator color={colors.teal} size="large" /><Text style={styles.loaderText}>Loading your Nanas workspace…</Text></View> : filtered.length === 0 ? <EmptyState title={query ? 'No matching results' : `No ${definition.label.toLowerCase()} yet`} message={query ? 'Try a different search.' : emptyCopy(role, section)} retry={() => void load(true)} /> : filtered.map((row, index) => {
          const id = text(row.id);
          const open = section === 'find-care' && text(row.user_id) ? () => router.push(`/buyer/provider/${text(row.user_id)}` as Href)
            : section === 'messages' && id ? () => router.push(`/${prefix}/conversation/${id}` as Href)
            : section === 'bookings' && id ? () => router.push(`/${prefix}/booking/${id}` as Href)
            : (section === 'care-requests' || section === 'requests') && id ? () => router.push(`/${prefix}/request/${id}` as Href)
            : section === 'quotes' && text(row.request_id) ? () => router.push(`/${prefix}/request/${text(row.request_id)}` as Href)
            : role === 'buyer' && section === 'favorites' && text(row.seller_id) ? () => router.push(`/buyer/provider/${text(row.seller_id)}` as Href)
            : section === 'notifications' && id ? () => void openNotification(role, row).then(() => load(true)).catch((cause) => setError(cause instanceof Error ? cause.message : 'Notification could not be opened.'))
            : undefined;
          return <RecordCard key={id || text(row.account_id) || `${section}-${index}`} row={row} section={section} onPress={open} />;
        })}
      </View>
      {section === 'account' && <View style={{ gap: 10, marginTop: 10 }}><SecondaryButton onPress={() => router.push('/role')}>Switch workspace</SecondaryButton><PrimaryButton onPress={() => void signOut()}>Sign out</PrimaryButton></View>}
    </ScrollView>
    <BottomNav role={role} active={section} />
    <WorkspaceMenu visible={menu} role={role} active={section} onClose={() => setMenu(false)} />
  </SafeAreaView>;
}

function RecordCard({ row, section, onPress }: { row: SectionRecord; section: string; onPress?: () => void }) {
  const status = text(row.status); const amount = money(row); const count = number(row.count);
  const content = <>
    <View style={styles.cardTop}><View style={{ flex: 1 }}><Text numberOfLines={2} style={ui.cardTitle}>{recordTitle(row)}</Text><Text numberOfLines={3} style={ui.cardCopy}>{recordCopy(row)}</Text></View><ChevronRight size={20} color={colors.muted} /></View>
    <View style={ui.metaRow}>{count !== null ? <View style={ui.pill}><Text style={ui.pillText}>{count} records</Text></View> : null}{status ? <View style={ui.pill}><Text style={ui.pillText}>{pretty(status)}</Text></View> : null}{amount ? <View style={ui.pill}><Text style={ui.pillText}>{amount}</Text></View> : null}{row.read_at === null && section === 'notifications' ? <View style={[ui.pill, { backgroundColor: '#FFF0D8' }]}><Text style={[ui.pillText, { color: colors.warning }]}>Unread</Text></View> : null}</View>
  </>;
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => [ui.card, pressed && { opacity: 0.78 }]} accessibilityRole="button">{content}</Pressable> : <View style={ui.card}>{content}</View>;
}

function BottomNav({ role, active }: { role: AppRole; active: string }) {
  const compactLabels: Record<string, string> = { 'care-requests': 'Requests', services: 'Services' };
  return <View style={styles.bottom}>{mainTabs[role].map((id) => { const item = sectionFor(role, id)!; const Icon = icons[id] ?? Home; const selected = id === active; return <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => router.push(`/${role === 'buyer' ? 'buyer' : 'provider'}/${id}` as Href)} style={styles.tab}><Icon size={21} color={selected ? colors.teal : colors.muted} /><Text numberOfLines={1} style={[styles.tabText, selected && styles.tabTextActive]}>{compactLabels[id] ?? item.label}</Text></Pressable>; })}</View>;
}

function WorkspaceMenu({ visible, role, active, onClose }: { visible: boolean; role: AppRole; active: string; onClose: () => void }) {
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><Pressable style={styles.backdrop} onPress={onClose} /><SafeAreaView style={styles.menu} edges={['bottom']}><View style={styles.menuHandle} /><View style={styles.menuHead}><View><Text style={styles.menuEyebrow}>{role === 'buyer' ? 'CLIENT WORKSPACE' : 'PROVIDER WORKSPACE'}</Text><Text style={styles.menuTitle}>All sections</Text></View><Pressable style={styles.close} onPress={onClose}><X color={colors.ink} size={22} /></Pressable></View><ScrollView contentContainerStyle={{ paddingBottom: 24 }}>{sectionsFor(role).map((item) => { const Icon = icons[item.id] ?? Settings; const selected = active === item.id; return <Pressable key={item.id} style={[styles.menuItem, selected && styles.menuItemActive]} onPress={() => { onClose(); router.push(`/${role === 'buyer' ? 'buyer' : 'provider'}/${item.id}` as Href); }}><View style={styles.menuIcon}><Icon size={19} color={colors.teal} /></View><Text style={[styles.menuLabel, selected && { color: colors.teal }]}>{item.label}</Text><ChevronRight size={18} color={colors.muted} /></Pressable>; })}</ScrollView></SafeAreaView></Modal>;
}

const styles = StyleSheet.create({
  search: { marginTop: 14, minHeight: 52, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, gap: 10 }, input: { flex: 1, color: colors.ink, fontSize: 16 },
  inlineAction: { marginTop: 12, alignItems: 'flex-end' }, loader: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 12 }, loaderText: { color: colors.muted }, cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bottom: { position: 'absolute', width: '94%', maxWidth: 720, alignSelf: 'center', bottom: 8, height: 72, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: 5, boxShadow: `0 5px 16px ${colors.shadow}1C`, elevation: 7 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 0 }, tabText: { color: colors.muted, fontSize: 9.5, fontWeight: '700', maxWidth: '100%' }, tabTextActive: { color: colors.teal, fontWeight: '900' },
  backdrop: { flex: 1, backgroundColor: 'rgba(6,35,34,0.45)' }, menu: { maxHeight: '82%', backgroundColor: colors.ivory, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 18 }, menuHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: 'center', marginTop: 10 },
  menuHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18 }, menuEyebrow: { color: colors.teal, letterSpacing: 1.3, fontSize: 11, fontWeight: '900' }, menuTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 27, fontWeight: '700', marginTop: 4 }, close: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  menuItem: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingHorizontal: 10, marginBottom: 4 }, menuItemActive: { backgroundColor: colors.aqua }, menuIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, menuLabel: { flex: 1, color: colors.ink, fontWeight: '700', fontSize: 15 },
});
