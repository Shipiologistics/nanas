import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, BadgeCheck, Heart, MapPin, Star } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, PrimaryButton, SecondaryButton, Wordmark, ui } from '@/components/nanas-ui';
import { colors } from '@/constants/nanas';
import { useSession } from '@/contexts/session';
import { supabase } from '@/lib/supabase';

type Provider = Record<string, unknown>;
const string = (value: unknown) => typeof value === 'string' ? value : '';
const numeric = (value: unknown) => typeof value === 'number' ? value : 0;

export default function ProviderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, roles, loading: sessionLoading } = useSession();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    if (!id || !user) return;
    setLoading(true); setMessage('');
    const [profile, saved] = await Promise.all([
      supabase.from('seller_directory').select('*').eq('user_id', id).maybeSingle(),
      supabase.from('favorites').select('seller_id').eq('buyer_id', user.id).eq('seller_id', id).maybeSingle(),
    ]);
    if (profile.error) setMessage(profile.error.message); else setProvider(profile.data);
    setFavorite(Boolean(saved.data)); setLoading(false);
  }, [id, user]);
  useEffect(() => {
    if (sessionLoading) return;
    if (!user) { router.replace('/auth'); return; }
    if (!roles.includes('buyer')) { router.replace('/role'); return; }
    // Load the selected directory record after auth and route parameters settle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, roles, sessionLoading, user]);
  async function toggleFavorite() {
    if (!id) return;
    const next = !favorite; setMessage('');
    const { error } = await supabase.rpc('set_provider_favorite', { p_seller_id: id, p_favorite: next });
    if (error) setMessage(error.message); else setFavorite(next);
  }
  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color={colors.teal} /></SafeAreaView>;
  if (!provider) return <SafeAreaView style={styles.center}><EmptyState title="Provider unavailable" message={message || 'This profile is not currently available in the approved directory.'} retry={() => void load()} /></SafeAreaView>;
  const services = Array.isArray(provider.services) ? provider.services.filter((item): item is Provider => Boolean(item) && typeof item === 'object') : [];
  const badges = Array.isArray(provider.badges) ? provider.badges : [];
  const name = string(provider.display_name) || 'Nanas provider';
  return <SafeAreaView style={styles.screen}><View style={styles.header}><Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={styles.icon}><ArrowLeft size={22} color={colors.ink} /></Pressable><Wordmark compact /><Pressable accessibilityLabel={favorite ? 'Remove saved provider' : 'Save provider'} onPress={() => void toggleFavorite()} style={styles.icon}><Heart size={22} color={favorite ? colors.danger : colors.ink} fill={favorite ? colors.danger : 'transparent'} /></Pressable></View>
    <ScrollView contentContainerStyle={styles.content}><View style={styles.cover}><View style={styles.avatar}><Text style={styles.avatarText}>{name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</Text></View><View style={styles.approved}><BadgeCheck size={15} color={colors.success} /><Text style={styles.approvedText}>APPROVED PROVIDER</Text></View></View>
      <Text style={styles.name}>{name}</Text><Text style={styles.headline}>{string(provider.headline) || 'Trusted care and household services'}</Text>
      <View style={styles.meta}><View style={styles.metaItem}><Star size={17} color="#D99318" fill="#D99318" /><Text style={styles.metaText}>{numeric(provider.rating_average).toFixed(1)} ({numeric(provider.rating_count)} reviews)</Text></View><View style={styles.metaItem}><MapPin size={17} color={colors.teal} /><Text style={styles.metaText}>{[string(provider.locality), string(provider.island)].filter(Boolean).join(', ') || 'The Bahamas'}</Text></View></View>
      {message ? <Text style={ui.error}>{message}</Text> : null}
      <Text style={styles.sectionTitle}>Services</Text>{services.length ? services.map((service, index) => <View key={string(service.id) || `${index}`} style={ui.card}><Text style={ui.cardTitle}>{string(service.name) || string(service.service_name) || 'Care service'}</Text>{numeric(service.rate_minor) > 0 && <Text style={ui.cardCopy}>From BSD {(numeric(service.rate_minor) / 100).toFixed(2)} per hour</Text>}</View>) : <Text style={styles.muted}>Approved services will appear here when available.</Text>}
      {badges.length > 0 && <><Text style={styles.sectionTitle}>Trust & recognition</Text><View style={styles.badges}>{badges.map((badge, index) => <View key={index} style={ui.pill}><Text style={ui.pillText}>{typeof badge === 'string' ? badge : string((badge as Provider).name)}</Text></View>)}</View></>}
      <View style={styles.actions}><SecondaryButton onPress={() => void toggleFavorite()}>{favorite ? 'Remove from My Nanas' : 'Save to My Nanas'}</SecondaryButton><PrimaryButton onPress={() => router.push('/buyer/care-requests')}>Request care</PrimaryButton></View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.ivory }, center: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: colors.ivory }, header: { height: 62, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border }, icon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, content: { padding: 16, paddingBottom: 42 }, cover: { minHeight: 190, borderRadius: 24, backgroundColor: colors.aquaStrong, alignItems: 'center', justifyContent: 'center' }, avatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: colors.tealDark, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: colors.white, fontFamily: 'Georgia', fontSize: 30, fontWeight: '700' }, approved: { position: 'absolute', right: 14, top: 14, flexDirection: 'row', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.white }, approvedText: { color: colors.success, fontSize: 10, fontWeight: '900' }, name: { color: colors.ink, fontFamily: 'Georgia', fontSize: 31, fontWeight: '700', marginTop: 18 }, headline: { color: colors.muted, fontSize: 16, lineHeight: 22, marginTop: 5 }, meta: { gap: 8, marginTop: 15 }, metaItem: { flexDirection: 'row', alignItems: 'center', gap: 7 }, metaText: { color: colors.ink, fontWeight: '700' }, sectionTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 22, fontWeight: '700', marginTop: 24, marginBottom: 10 }, muted: { color: colors.muted, lineHeight: 21 }, badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, actions: { gap: 10, marginTop: 28 } });
