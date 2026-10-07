import { useLocalSearchParams } from 'expo-router';
import { SectionScreen } from '@/components/section-screen';
export default function BuyerSection() {
  const { section } = useLocalSearchParams<{ section: string }>();
  return <SectionScreen workspaceRole="buyer" section={section || 'overview'} />;
}
