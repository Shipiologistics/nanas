import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { CalendarCheck, ClipboardCheck, HeartHandshake, Home, MessageCircle, PawPrint, ShieldCheck, Stethoscope, UsersRound } from 'lucide-react-native';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton, SecondaryButton, Wordmark } from '@/components/nanas-ui';
import { colors } from '@/constants/nanas';
import { useSession } from '@/contexts/session';
import homeHero from '@/assets/nanas/hero-home-mobile.webp';

const categories = [
  ['Senior care', HeartHandshake], ['Child care', UsersRound], ['Home healthcare', Stethoscope],
  ['Housekeeping', Home], ['Tutoring', UsersRound], ['Pet care', PawPrint],
] as const;

const howSteps = [
  ['Tell us what you need', 'Choose the service, area, timing and care-recipient needs.', ClipboardCheck],
  ['Compare verified providers', 'Review experience, rates, availability, badges and booking-backed reviews.', ShieldCheck],
  ['Book with confidence', 'Confirm the visit, use protected payment and keep every update together.', CalendarCheck],
  ['Message securely', 'Ask practical questions and keep the conversation tied to the booking.', MessageCircle],
] as const;

const highlights = [
  ['Nanas Match', 'Tell us what you need and let Nanas help find a suitable provider when you do not know where to start.'],
  ['Senior Care Advisor', 'Not sure what type of care Mom or Dad needs? Talk to a Nanas care advisor before posting.'],
  ['My Nanas favorites', 'Save trusted providers so recurring help and future family decisions are easier.'],
  ['Safer booking tools', 'Recurring bookings, emergency contacts, visit updates and anti-bypass protection keep care coordinated.'],
  ['Gift of care', 'Family and friends can contribute to care or household help through the planned gift-of-care option.'],
] as const;

export default function HomeScreen() {
  const { configured, loading, user, roles, role } = useSession();
  useEffect(() => {
    if (loading || !user) return;
    const next = role ?? (roles.length === 1 ? roles[0] : null);
    if (next) router.replace(`/${next === 'buyer' ? 'buyer' : 'provider'}/overview` as Href);
    else router.replace('/role');
  }, [loading, role, roles, user]);
  if (loading || user) return <SafeAreaView style={styles.loading}><ActivityIndicator size="large" color={colors.teal} /></SafeAreaView>;
  return <SafeAreaView style={styles.screen} edges={['top']}><ScrollView contentContainerStyle={styles.content}>
    <Wordmark />
    <View style={styles.hero}>
      <Image source={homeHero} style={StyleSheet.absoluteFill} contentFit="cover" />
      <View style={styles.overlay}><Text style={styles.kicker}>CARE & HOUSEHOLD HELP ACROSS THE BAHAMAS</Text><Text style={styles.title}>Trusted Care,{`\n`}Close to Home.</Text><Text style={styles.subtitle}>Trusted help is just a few clicks away.</Text></View>
    </View>
    <View style={styles.actions}><PrimaryButton onPress={() => router.push({ pathname: '/auth', params: { role: 'buyer' } })}>Find Care</PrimaryButton><SecondaryButton onPress={() => router.push({ pathname: '/auth', params: { role: 'buyer', mode: 'signup' } })}>Post a Request</SecondaryButton></View>
    <Text style={styles.sectionTitle}>What kind of help do you need?</Text>
    <View style={styles.grid}>{categories.map(([label, Icon]) => <Pressable accessibilityRole="button" key={label} onPress={() => router.push({ pathname: '/auth', params: { role: 'buyer' } })} style={({ pressed }) => [styles.category, pressed && { opacity: 0.78 }]}><View style={styles.categoryIcon}><Icon size={23} color={colors.teal} /></View><Text style={styles.categoryText}>{label}</Text></Pressable>)}</View>
    <View style={styles.instruction}><Text style={styles.providerKicker}>HOW NANAS WORKS</Text><Text style={styles.providerTitle}>Simple enough for every family.</Text><Text style={styles.providerCopy}>Choose a category, explain what is needed, compare providers, then keep messages, payments and care updates in one place.</Text><View style={styles.stepGrid}>{howSteps.map(([title, copy, Icon], index) => <View key={title} style={styles.step}><View style={styles.stepNumber}><Text style={styles.stepNumberText}>{index + 1}</Text></View><Icon size={22} color={colors.teal} /><Text style={styles.stepTitle}>{title}</Text><Text style={styles.stepCopy}>{copy}</Text></View>)}</View></View>
    <View style={styles.match}><Text style={styles.providerKicker}>NANAS MATCH</Text><Text style={styles.providerTitle}>Not sure where to start? Let Nanas help.</Text><Text style={styles.providerCopy}>Search on your own, post a request, or ask Nanas to help when the care need is unclear.</Text>{highlights.map(([title, copy]) => <View key={title} style={styles.highlight}><Text style={styles.stepTitle}>{title}</Text><Text style={styles.stepCopy}>{copy}</Text></View>)}</View>
    <View style={styles.provider}><Text style={styles.providerKicker}>BECOME A PROVIDER</Text><Text style={styles.providerTitle}>Care for your community.</Text><Text style={styles.providerCopy}>Offer the services already supported by Nanas and manage requests, bookings and earnings in one place.</Text><SecondaryButton onPress={() => router.push({ pathname: '/auth', params: { role: 'seller', mode: 'signup' } })}>Join as a provider</SecondaryButton></View>
    {!configured && <View style={styles.config}><Text style={styles.configTitle}>Local setup required</Text><Text style={styles.configCopy}>Add the existing public Supabase URL and publishable key to mobile/.env.local. Secret and service-role keys must never be placed in the app.</Text></View>}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ivory }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ivory }, content: { width: '100%', maxWidth: 960, alignSelf: 'center', padding: 18, paddingBottom: 40 },
  hero: { minHeight: 410, borderRadius: 28, overflow: 'hidden', marginTop: 22, justifyContent: 'flex-end' }, overlay: { padding: 23, paddingTop: 130, backgroundColor: 'rgba(6,55,52,0.45)' }, kicker: { color: '#D7F7F2', fontWeight: '900', letterSpacing: 1.1, fontSize: 11 }, title: { color: colors.white, fontFamily: 'Georgia', fontSize: 42, lineHeight: 44, fontWeight: '700', marginTop: 10 }, subtitle: { color: colors.white, fontSize: 17, lineHeight: 24, marginTop: 10 },
  actions: { gap: 10, marginTop: 14 }, sectionTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 25, fontWeight: '700', marginTop: 28, marginBottom: 14 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, category: { width: '48%', minHeight: 108, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, padding: 14, justifyContent: 'space-between' }, categoryIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.aqua, alignItems: 'center', justifyContent: 'center' }, categoryText: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  provider: { backgroundColor: colors.aqua, borderRadius: 24, padding: 20, marginTop: 28, gap: 10 }, providerKicker: { color: colors.teal, fontSize: 11, fontWeight: '900', letterSpacing: 1.3 }, providerTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 28, fontWeight: '700' }, providerCopy: { color: colors.muted, lineHeight: 21, marginBottom: 4 },
  instruction: { marginTop: 30, gap: 10 }, stepGrid: { gap: 10, marginTop: 8 }, step: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 16, gap: 7 }, stepNumber: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.aqua, alignItems: 'center', justifyContent: 'center' }, stepNumberText: { color: colors.teal, fontWeight: '900' }, stepTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' }, stepCopy: { color: colors.muted, lineHeight: 20 },
  match: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 24, padding: 20, marginTop: 28, gap: 12 }, highlight: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, gap: 4 },
  config: { backgroundColor: '#FFF0D8', borderRadius: 18, padding: 16, marginTop: 16 }, configTitle: { color: colors.warning, fontWeight: '900' }, configCopy: { color: '#6E552F', lineHeight: 20, marginTop: 5 },
});
