import { useLocalSearchParams } from 'expo-router';
import { ConversationScreen } from '@/components/conversation-screen';
export default function BuyerConversation() { const { id } = useLocalSearchParams<{ id: string }>(); return <ConversationScreen workspaceRole="buyer" conversationId={id} />; }
