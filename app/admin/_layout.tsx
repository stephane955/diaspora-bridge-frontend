import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import { useAuth } from '@/context/AuthContext';
import { checkIsAdmin } from '@/lib/adminAuth';

export default function AdminLayout() {
  const c = usePremiumColors();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    checkIsAdmin().then((ok) => {
      if (!ok) {
        router.replace('/');
        return;
      }
      setAuthorized(true);
    });
  }, [user, authLoading, router]);

  if (authLoading || authorized === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.bg }}>
        <ActivityIndicator size="large" color={c.gold} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.bg },
      }}
    />
  );
}
