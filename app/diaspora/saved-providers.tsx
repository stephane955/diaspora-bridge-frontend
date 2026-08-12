import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PremiumHeader from '@/components/PremiumHeader';
import PremiumEmptyState from '@/components/PremiumEmptyState';
import FavoriteProviderButton from '@/components/FavoriteProviderButton';
import { useFavoriteProviders } from '@/hooks/useFavoriteProviders';
import {
  SCROLL_BOTTOM_INSET,
  PREMIUM_BG,
  PREMIUM_GOLD,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/constants/layout';
import { clientMenuItems } from '@/constants/premiumMenus';
import { useLanguage } from '@/context/LanguageContext';
import { mediumFeedback } from '@/utils/haptics';

export default function SavedProvidersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useLanguage();
  const { favorites, loading, refresh } = useFavoriteProviders();

  return (
    <View style={styles.screen}>
      <PremiumHeader
        title={t('savedProviders')}
        subtitle={t('savedProvidersSub')}
        showBack
        fallbackRoute="/diaspora"
        menuItems={clientMenuItems(router, t)}
      />

      {loading && favorites.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={PREMIUM_GOLD} size="large" />
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingTop: insets.top + 96,
            paddingHorizontal: 16,
            paddingBottom: SCROLL_BOTTOM_INSET,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={PREMIUM_GOLD} />
          }
          ListEmptyComponent={
            <PremiumEmptyState
              icon="heart-outline"
              title={t('noSavedProviders')}
              subtitle={t('noSavedProvidersSub')}
            />
          }
          renderItem={({ item }) => {
            const p = item.profiles;
            return (
              <BlurView intensity={36} tint="dark" style={styles.card}>
                <Image
                  source={{ uri: p?.avatar_url || 'https://i.pravatar.cc/150?u=' + item.provider_id }}
                  style={styles.avatar}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{p?.full_name || 'Provider'}</Text>
                  <Text style={styles.meta}>
                    {p?.rating ? `★ ${Number(p.rating).toFixed(1)}` : 'New'}
                    {p?.city ? ` · ${p.city}` : ''}
                  </Text>
                </View>
                <FavoriteProviderButton providerId={item.provider_id} />
                <TouchableOpacity
                  style={styles.openBtn}
                  onPress={() => {
                    mediumFeedback();
                    router.push('/diaspora/projects');
                  }}
                >
                  <Ionicons name="folder-open-outline" size={18} color={PREMIUM_GOLD} />
                </TouchableOpacity>
              </BlurView>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PREMIUM_BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.22)',
    backgroundColor: 'rgba(17,24,39,0.72)',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.4)',
    backgroundColor: '#1E293B',
  },
  name: { color: TEXT_PRIMARY, fontWeight: '800', fontSize: 16 },
  meta: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 4, fontWeight: '600' },
  openBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,175,55,0.12)',
  },
});
