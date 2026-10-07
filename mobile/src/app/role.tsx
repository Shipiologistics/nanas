import { router, type Href } from 'expo-router';
import { HeartHandshake, Stethoscope } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Wordmark } from '@/components/nanas-ui';
import { colors, type AppRole } from '@/constants/nanas';
import { useSession } from '@/contexts/session';

export default function RoleScreen() {
  const { roles, chooseRole, signOut } = useSession();
  function open(role: AppRole) { chooseRole(role); router.replace(`/${role === 'buyer' ? 'buyer' : 'provider'}/overview` as Href); }
  return <SafeAreaView style={styles.screen}><View style={styles.content}><Wordmark /><Text style={styles.title}>{roles.length ? 'Choose your workspace.' : 'No mobile workspace is available.'}</Text><Text style={styles.copy}>{roles.length ? 'Use only the Nanas workspace already assigned to this account.' : 'This app supports client and care-provider accounts. Ask Nanas support to activate one of those roles.'}</Text>
    <View style={styles.options}>{roles.includes('buyer') && <Choice icon={HeartHandshake} title="Client" copy="Find care and manage your household" onPress={() => open('buyer')} />}{roles.includes('seller') && <Choice icon={Stethoscope} title="Care provider" copy="Manage requests, visits and earnings" onPress={() => open('seller')} />}</View>
    <Pressable onPress={() => void signOut()} style={styles.signout}><Text style={styles.signoutText}>Sign out and use another account</Text></Pressable>
  </View></SafeAreaView>;
}
function Choice({ icon: Icon, title, copy, onPress }: { icon: typeof HeartHandshake; title: string; copy: string; onPress: () => void }) { return <Pressable onPress={onPress} style={styles.choice}><View style={styles.icon}><Icon size={26} color={colors.teal} /></View><View><Text style={styles.choiceTitle}>{title}</Text><Text style={styles.choiceCopy}>{copy}</Text></View></Pressable>; }
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.ivory }, content: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', padding: 22, justifyContent: 'center' }, title: { color: colors.ink, fontFamily: 'Georgia', fontSize: 34, fontWeight: '700', marginTop: 34 }, copy: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: 10 }, options: { gap: 12, marginTop: 26 }, choice: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 17, flexDirection: 'row', alignItems: 'center', gap: 14 }, icon: { width: 50, height: 50, borderRadius: 16, backgroundColor: colors.aqua, alignItems: 'center', justifyContent: 'center' }, choiceTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' }, choiceCopy: { color: colors.muted, marginTop: 4 }, signout: { alignSelf: 'center', padding: 16, marginTop: 20 }, signoutText: { color: colors.teal, fontWeight: '800' } });
