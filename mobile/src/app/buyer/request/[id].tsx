import { useLocalSearchParams } from 'expo-router';
import { RequestScreen } from '@/components/request-screen';
export default function BuyerRequest() { const { id } = useLocalSearchParams<{ id: string }>(); return <RequestScreen workspaceRole="buyer" requestId={id} />; }
