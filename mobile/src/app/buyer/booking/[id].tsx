import { useLocalSearchParams } from 'expo-router';
import { BookingScreen } from '@/components/booking-screen';
export default function BuyerBooking() { const { id } = useLocalSearchParams<{ id: string }>(); return <BookingScreen workspaceRole="buyer" bookingId={id} />; }
