import { useLocalSearchParams } from 'expo-router';
import { BookingScreen } from '@/components/booking-screen';
export default function ProviderBooking() { const { id } = useLocalSearchParams<{ id: string }>(); return <BookingScreen workspaceRole="seller" bookingId={id} />; }
