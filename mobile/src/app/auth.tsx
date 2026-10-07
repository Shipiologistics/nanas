import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { HeartHandshake, Stethoscope } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton, Wordmark } from '@/components/nanas-ui';
import { colors, type AppRole } from '@/constants/nanas';
import { supabase } from '@/lib/supabase';

export default function AuthScreen() {
  const params = useLocalSearchParams<{ role?: string; mode?: string }>();
  type AuthMode = 'login' | 'signup' | 'recover' | 'magic' | 'reset';
  const initialMode: AuthMode = params.mode === 'signup' || params.mode === 'recover' || params.mode === 'magic' || params.mode === 'reset' ? params.mode : 'login';
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [role, setRole] = useState<AppRole>(params.role === 'seller' ? 'seller' : 'buyer');
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  async function submit() {
    setBusy(true); setMessage('');
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password }); if (error) throw error;
        router.replace('/');
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim(), requested_role: role } } });
        if (error) throw error;
        if (!data.session) setMessage('Check your email to confirm your Nanas account, then return to sign in.'); else router.replace('/');
      } else if (mode === 'recover') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: Linking.createURL('auth', { queryParams: { mode: 'reset' } }) });
        if (error) throw error; setMessage('Recovery instructions were sent if that email belongs to a Nanas account.');
      } else if (mode === 'magic') {
        const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: Linking.createURL('') } });
        if (error) throw error; setMessage('A secure sign-in link was sent if that email belongs to a Nanas account.');
      } else {
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        const { error } = await supabase.auth.updateUser({ password }); if (error) throw error;
        setMessage('Password updated. You can continue to your workspace.'); setMode('login'); setPassword(''); setConfirmPassword('');
      }
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Sign-in could not be completed.'); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={styles.screen}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <Pressable onPress={() => router.back()}><Wordmark /></Pressable>
    <View style={styles.card}><View style={styles.tabs}><Pressable onPress={() => setMode('login')} style={[styles.tab, mode === 'login' && styles.tabActive]}><Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>Log in</Text></Pressable><Pressable onPress={() => setMode('signup')} style={[styles.tab, mode === 'signup' && styles.tabActive]}><Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>Create account</Text></Pressable></View>
      <Text style={styles.title}>{mode === 'login' ? 'Welcome back.' : mode === 'signup' ? 'Join Nanas.' : mode === 'recover' ? 'Recover access.' : mode === 'magic' ? 'Use a secure email link.' : 'Choose a new password.'}</Text><Text style={styles.copy}>{mode === 'login' ? 'Continue to your secure care workspace.' : mode === 'signup' ? 'Find trusted help or join as a care provider.' : mode === 'recover' ? 'Enter your email to receive recovery instructions.' : mode === 'magic' ? 'Sign in without sharing a password.' : 'Use at least eight characters and confirm your new password.'}</Text>
      {mode === 'signup' && <View style={styles.roles}><RoleChoice selected={role === 'buyer'} title="I need care" copy="Find trusted help" icon={HeartHandshake} onPress={() => setRole('buyer')} /><RoleChoice selected={role === 'seller'} title="I provide care" copy="Offer approved services" icon={Stethoscope} onPress={() => setRole('seller')} /></View>}
      {mode === 'signup' && <Field label="Full name" value={name} onChangeText={setName} autoComplete="name" />}
      {mode !== 'reset' && <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />}
      {(mode === 'login' || mode === 'signup' || mode === 'reset') && <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />}
      {mode === 'reset' && <Field label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoComplete="new-password" />}
      {message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}
      <PrimaryButton loading={busy} disabled={(mode !== 'reset' && !email.trim()) || ((mode === 'login' || mode === 'signup' || mode === 'reset') && password.length < 8) || (mode === 'reset' && confirmPassword.length < 8) || (mode === 'signup' && name.trim().length < 2)} onPress={() => void submit()}>{mode === 'login' ? 'Log in securely' : mode === 'signup' ? 'Create Nanas account' : mode === 'recover' ? 'Send recovery instructions' : mode === 'magic' ? 'Send secure sign-in link' : 'Update password'}</PrimaryButton>
      {mode === 'login' && <View style={styles.links}><Pressable onPress={() => { setMode('magic'); setMessage(''); }}><Text style={styles.link}>Use a one-time sign-in</Text></Pressable><Pressable onPress={() => { setMode('recover'); setMessage(''); }}><Text style={styles.link}>Forgot password?</Text></Pressable></View>}
      {(mode === 'recover' || mode === 'magic') && <Pressable style={styles.backLink} onPress={() => { setMode('login'); setMessage(''); }}><Text style={styles.link}>Back to password login</Text></Pressable>}
      <Text style={styles.terms}>By continuing, you agree to the Nanas Terms and Privacy Policy.</Text>
    </View>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) { const { label, ...input } = props; return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...input} style={styles.input} placeholderTextColor="#7A8887" /></View>; }
function RoleChoice({ selected, title, copy, icon: Icon, onPress }: { selected: boolean; title: string; copy: string; icon: typeof HeartHandshake; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.role, selected && styles.roleActive]}><Icon size={22} color={colors.teal} /><View style={{ flex: 1 }}><Text style={styles.roleTitle}>{title}</Text><Text style={styles.roleCopy}>{copy}</Text></View></Pressable>; }

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.ivory }, content: { width: '100%', maxWidth: 560, alignSelf: 'center', padding: 18, paddingBottom: 40 }, card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 26, padding: 20, marginTop: 28 }, tabs: { flexDirection: 'row', backgroundColor: colors.ivory, borderRadius: 14, padding: 4 }, tab: { flex: 1, minHeight: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, tabActive: { backgroundColor: colors.white }, tabText: { color: colors.muted, fontWeight: '800' }, tabTextActive: { color: colors.teal }, title: { color: colors.ink, fontFamily: 'Georgia', fontWeight: '700', fontSize: 34, marginTop: 24 }, copy: { color: colors.muted, fontSize: 16, lineHeight: 22, marginTop: 7, marginBottom: 18 }, roles: { gap: 9, marginBottom: 4 }, role: { minHeight: 70, flexDirection: 'row', gap: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 13 }, roleActive: { borderColor: colors.teal, backgroundColor: colors.aqua }, roleTitle: { color: colors.ink, fontWeight: '900', fontSize: 15 }, roleCopy: { color: colors.muted, fontSize: 13, marginTop: 2 }, field: { gap: 7, marginTop: 14 }, label: { color: colors.ink, fontWeight: '800', fontSize: 13 }, input: { minHeight: 52, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.ivory, borderRadius: 14, paddingHorizontal: 14, color: colors.ink, fontSize: 16 }, message: { color: colors.danger, backgroundColor: '#FFF1F0', borderRadius: 12, padding: 12, marginVertical: 14, lineHeight: 19 }, links: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginTop: 18 }, backLink: { alignSelf: 'center', padding: 12, marginTop: 8 }, link: { color: colors.teal, fontWeight: '800' }, terms: { color: colors.muted, fontSize: 12, textAlign: 'center', lineHeight: 17, marginTop: 16 } });
