import { Image, type ImageSource } from 'expo-image';
import { router, type Href } from 'expo-router';
import { ArrowRight, Bell, Menu, RefreshCw, ShieldCheck } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Children } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';
import { colors } from '@/constants/nanas';

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return <View style={styles.wordmark}><View style={[styles.mark, compact && styles.markCompact]}><Text style={styles.markText}>N</Text></View><Text style={[styles.word, compact && styles.wordCompact]}>Nanas<Text style={{ color: colors.aquaStrong }}>.</Text></Text></View>;
}

export function PrimaryButton({ children, loading, style, ...props }: PressableProps & { children: ReactNode; loading?: boolean }) {
  return <Pressable {...props} disabled={props.disabled || loading} style={(state) => [styles.primary, state.pressed && styles.pressed, props.disabled && styles.disabled, typeof style === 'function' ? style(state) : style]}>{loading ? <ActivityIndicator color={colors.white} /> : <><Text style={styles.primaryText}>{children}</Text><ArrowRight size={18} color={colors.white} /></>}</Pressable>;
}

export function SecondaryButton({ children, ...props }: PressableProps & { children: ReactNode }) {
  const content = Children.map(children, (child) => typeof child === 'string' || typeof child === 'number' ? <Text style={styles.secondaryText}>{child}</Text> : child);
  return <Pressable {...props} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}><View style={styles.secondaryContent}>{content}</View></Pressable>;
}

export function AppHeader({ notificationCount = 0, onMenu, role }: { notificationCount?: number; onMenu: () => void; role: 'buyer' | 'seller' }) {
  return <View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel="Open overview" onPress={() => router.push(`/${role === 'buyer' ? 'buyer' : 'provider'}/overview` as Href)}><Wordmark compact /></Pressable>
    <View style={styles.headerActions}>
      <Pressable style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Open notifications" onPress={() => router.push(`/${role === 'buyer' ? 'buyer' : 'provider'}/notifications` as Href)}><Bell size={21} color={colors.ink} />{notificationCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{notificationCount > 99 ? '99+' : notificationCount}</Text></View>}</Pressable>
      <Pressable style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Open menu" onPress={onMenu}><Menu size={22} color={colors.ink} /></Pressable>
    </View>
  </View>;
}

export function Hero({ eyebrow, title, description, image }: { eyebrow: string; title: string; description: string; image?: ImageSource | number }) {
  const pictured = image !== undefined;
  return <View style={styles.hero}>{pictured && <Image source={image} style={styles.heroImage} contentFit="cover" />}<View style={pictured ? styles.heroOverlay : undefined}><Text style={[styles.eyebrow, pictured ? { color: colors.white } : undefined]}>{eyebrow}</Text><Text style={[styles.heroTitle, pictured ? { color: colors.white } : undefined]}>{title}</Text><Text style={[styles.heroCopy, pictured ? { color: '#F4FFFD' } : undefined]}>{description}</Text></View></View>;
}

export function EmptyState({ title, message, retry }: { title: string; message: string; retry?: () => void }) {
  return <View style={styles.empty}><View style={styles.emptyIcon}><ShieldCheck size={27} color={colors.teal} /></View><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyCopy}>{message}</Text>{retry && <Pressable style={styles.retry} onPress={retry}><RefreshCw size={16} color={colors.teal} /><Text style={styles.retryText}>Refresh</Text></Pressable>}</View>;
}

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ivory },
  scroll: { width: '100%', maxWidth: 960, alignSelf: 'center', paddingHorizontal: 16, paddingBottom: 112 },
  section: { marginTop: 20 },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '800', marginBottom: 10 },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 16, marginBottom: 10 },
  cardTitle: { color: colors.ink, fontSize: 17, lineHeight: 22, fontWeight: '800' },
  cardCopy: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 5 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  pill: { backgroundColor: colors.aqua, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  pillText: { color: colors.tealDark, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  error: { backgroundColor: '#FFF1F0', color: colors.danger, borderRadius: 14, padding: 14, marginTop: 14, lineHeight: 20 },
});

const styles = StyleSheet.create({
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  mark: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' },
  markCompact: { width: 34, height: 34, borderRadius: 10 },
  markText: { fontFamily: 'Georgia', color: colors.white, fontSize: 24 },
  word: { fontFamily: 'Georgia', color: colors.ink, fontSize: 30, fontWeight: '700' },
  wordCompact: { fontSize: 22 },
  primary: { minHeight: 52, paddingHorizontal: 20, borderRadius: 16, backgroundColor: colors.tealDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  primaryText: { color: colors.white, fontWeight: '800', fontSize: 16 },
  secondary: { minHeight: 52, paddingHorizontal: 20, borderRadius: 16, borderWidth: 1, borderColor: colors.teal, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  secondaryContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryText: { color: colors.tealDark, fontWeight: '800', fontSize: 16 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] }, disabled: { opacity: 0.55 },
  header: { minHeight: 62, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.ivory, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerActions: { flexDirection: 'row', gap: 8 }, iconButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', right: -3, top: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }, badgeText: { color: colors.white, fontSize: 9, fontWeight: '900' },
  hero: { marginTop: 16, minHeight: 180, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.aqua, justifyContent: 'flex-end' },
  heroImage: { ...StyleSheet.absoluteFill }, heroOverlay: { padding: 20, paddingTop: 60, backgroundColor: 'rgba(5,55,53,0.57)' },
  eyebrow: { color: colors.teal, fontSize: 12, letterSpacing: 1.4, fontWeight: '900', marginBottom: 8 },
  heroTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 31, lineHeight: 34, fontWeight: '700', maxWidth: 340 },
  heroCopy: { color: colors.muted, fontSize: 15, lineHeight: 21, marginTop: 10, maxWidth: 360 },
  empty: { alignItems: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 24 },
  emptyIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.aqua, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 21, fontWeight: '700', marginTop: 14, textAlign: 'center' }, emptyCopy: { color: colors.muted, textAlign: 'center', lineHeight: 21, marginTop: 7 },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 16, paddingVertical: 10, paddingHorizontal: 14 }, retryText: { color: colors.teal, fontWeight: '800' },
});
