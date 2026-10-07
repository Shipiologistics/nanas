import { useLocalSearchParams } from 'expo-router';
import { SectionScreen } from '@/components/section-screen';
export default function ProviderSection() {
  const { section } = useLocalSearchParams<{ section: string }>();
  return <SectionScreen workspaceRole="seller" section={section || 'overview'} />;
}
