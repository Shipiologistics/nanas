import { useLocalSearchParams } from 'expo-router';
import { ConversationScreen } from '@/components/conversation-screen';
export default function ProviderConversation() { const { id } = useLocalSearchParams<{ id: string }>(); return <ConversationScreen workspaceRole="seller" conversationId={id} />; }
