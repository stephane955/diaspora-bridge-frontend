import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import PremiumHeader from '@/components/PremiumHeader';
import PulseLoader from '@/components/PulseLoader';
import ChatThreadRow from '@/components/ChatThreadRow';
import { clientMenuItems } from '@/constants/premiumMenus';
import { useInboxThreads } from '@/hooks/useInboxThreads';
import { markProjectChatRead } from '@/lib/chatReadState';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import { FLOATING_TAB_BAR_HEIGHT, PREMIUM_GOLD } from '@/constants/layout';

export default function InboxScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useLanguage();
  const c = usePremiumColors();
  const [refreshing, setRefreshing] = useState(false);

  const { threads, loading, error, refetch } = useInboxThreads(user?.id, 'client');

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const unreadTotal = threads.reduce((sum, th) => sum + th.unreadCount, 0);

  const openThread = async (projectId: string) => {
    if (user?.id) await markProjectChatRead(user.id, projectId);
    router.push(`/chat/${projectId}`);
  };

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar
        barStyle={c.isDark ? 'light-content' : 'dark-content'}
        translucent
        backgroundColor="transparent"
      />
      <PremiumHeader
        title={t('inboxTitle')}
        subtitle={
          unreadTotal > 0
            ? `${unreadTotal} ${t('unreadLabel')}`
            : t('messagesSubtitleClient') || t('conversationsTitle')
        }
        menuItems={clientMenuItems(router, t)}
      />
      {loading ? (
        <View style={[styles.center, { backgroundColor: c.bg }]}>
          <PulseLoader />
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => item.projectId}
          renderItem={({ item }) => (
            <ChatThreadRow
              thread={item}
              voiceLabel={t('voiceMessage')}
              onPress={() => openThread(item.projectId)}
            />
          )}
          contentContainerStyle={{
            paddingTop: insets.top + 88,
            paddingBottom: FLOATING_TAB_BAR_HEIGHT + 40,
            paddingHorizontal: 16,
            flexGrow: threads.length === 0 ? 1 : undefined,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PREMIUM_GOLD} />
          }
          ListHeaderComponent={
            error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : threads.length > 0 ? (
              <View style={styles.sectionHead}>
                <Text style={[styles.listHeader, { color: c.textSecondary }]}>
                  {t('conversationsTitle')}
                </Text>
                {unreadTotal > 0 ? (
                  <LinearGradient
                    colors={['rgba(212,175,55,0.25)', 'rgba(212,175,55,0.05)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.unreadPill}
                  >
                    <View style={styles.unreadDot} />
                    <Text style={styles.unreadPillText}>
                      {unreadTotal} {t('unreadLabel')}
                    </Text>
                  </LinearGradient>
                ) : null}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Ionicons name="chatbubbles-outline" size={36} color={PREMIUM_GOLD} />
              </View>
              <Text style={[styles.emptyTitle, { color: c.textPrimary }]}>{t('noConversations')}</Text>
              <Text style={[styles.emptyText, { color: c.textSecondary }]}>
                {t('noConversationsSub')}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
  },
  listHeader: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  unreadPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PREMIUM_GOLD,
  },
  unreadPillText: {
    color: PREMIUM_GOLD,
    fontSize: 11,
    fontWeight: '800',
  },
  errorText: { color: '#F87171', marginBottom: 12, fontWeight: '600' },
  empty: { flex: 1, paddingTop: 80, alignItems: 'center', gap: 10, paddingHorizontal: 28 },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
});
