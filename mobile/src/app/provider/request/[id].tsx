import { useLocalSearchParams } from 'expo-router';
import { RequestScreen } from '@/components/request-screen';
export default function ProviderRequest() { const { id } = useLocalSearchParams<{ id: string }>(); return <RequestScreen workspaceRole="seller" requestId={id} />; }
