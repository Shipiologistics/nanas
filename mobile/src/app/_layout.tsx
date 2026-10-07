import { Stack } from 'expo-router';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SessionProvider, useSession } from '@/contexts/session';
import { colors } from '@/constants/nanas';
import { supabase } from '@/lib/supabase';

SplashScreen.preventAutoHideAsync();

function Navigation() {
  const { loading } = useSession();
  const incomingUrl = Linking.useLinkingURL();
  useEffect(() => { if (!loading) void SplashScreen.hideAsync(); }, [loading]);
  useEffect(() => {
    if (!incomingUrl) return;
    const url = new URL(incomingUrl);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    const code = url.searchParams.get('code');
    const accessToken = hash.get('access_token') ?? url.searchParams.get('access_token');
    const refreshToken = hash.get('refresh_token') ?? url.searchParams.get('refresh_token');
    if (code) void supabase.auth.exchangeCodeForSession(code);
    else if (accessToken && refreshToken) void supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  }, [incomingUrl]);
  return <><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ivory }, animation: 'fade_from_bottom' }} /></>;
}

export default function RootLayout() {
  return <SessionProvider><Navigation /></SessionProvider>;
}
