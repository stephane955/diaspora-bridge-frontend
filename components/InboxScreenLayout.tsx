import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import PremiumHeader from '@/components/PremiumHeader';
import ScreenLoader from '@/components/ScreenLoader';
import PremiumEmptyState from '@/components/PremiumEmptyState';
import ChatThreadRow from '@/components/ChatThreadRow';
import InboxHeroCard from '@/components/InboxHeroCard';
import InboxSearchBar from '@/components/InboxSearchBar';
import { useInboxThreads } from '@/hooks/useInboxThreads';
import { markProjectChatRead } from '@/lib/chatReadState';
import { usePremiumColors, type PremiumColors } from '@/hooks/usePremiumColors';
import { useScreenOffsets } from '@/hooks/useScreenOffsets';
import {
  ALPHA,
  DANGER_SOFT,
  GOLD,
  GOLD_BORDER,
  radius,
  space,
  text,
  weight,
  withAlpha,
} from '@/constants/design';

type MenuItem = Parameters<typeof PremiumHeader>[0]['menuItems'];

type Props = {
  role: 'client' | 'provider';
  menuItems: MenuItem;
  heroLabel: string;
  subtitleFallback: string;
};

export default function InboxScreenLayout({
  role,
  menuItems,
  heroLabel,
  subtitleFallback,
}: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const c = usePremiumColors();
  const offsets = useScreenOffsets();
  const styles = useMemo(() => createStyles(c), [c]);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const { threads, loading, error, refetch } = useInboxThreads(user?.id, role);

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

  const filteredThreads = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (th) =>
        th.projectTitle.toLowerCase().includes(q) ||
        (th.projectCity?.toLowerCase().includes(q) ?? false) ||
        th.latestPreview.toLowerCase().includes(q),
    );
  }, [threads, query]);

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
            : subtitleFallback
        }
        menuItems={menuItems}
        onNotificationsPress={() => router.push('/notifications')}
      />
      {loading ? (
        <ScreenLoader />
      ) : (
        <FlatList
          data={filteredThreads}
          keyExtractor={(item) => item.projectId}
          renderItem={({ item }) => (
            <ChatThreadRow
              thread={item}
              voiceLabel={t('voiceMessage')}
              onPress={() => openThread(item.projectId)}
            />
          )}
          contentContainerStyle={[
            offsets.content,
            { flexGrow: filteredThreads.length === 0 ? 1 : undefined },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />
          }
          ListHeaderComponent={
            <>
              <InboxHeroCard total={threads.length} unread={unreadTotal} roleLabel={heroLabel} />
              {threads.length > 0 ? (
                <InboxSearchBar
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('searchConversations') || 'Search conversations…'}
                />
              ) : null}
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              {filteredThreads.length > 0 ? (
                <View style={styles.sectionHead}>
                  <Text style={[styles.listHeader, { color: c.textSecondary }]}>
                    {t('conversationsTitle')}
                  </Text>
                  {unreadTotal > 0 ? (
                    <LinearGradient
                      colors={[withAlpha(GOLD, ALPHA.medium), withAlpha(GOLD, ALPHA.faint)]}
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
              ) : query.trim() ? (
                <Text style={[styles.noResults, { color: c.textSecondary }]}>
                  No matches for {`“${query.trim()}”`}
                </Text>
              ) : null}
            </>
          }
          ListEmptyComponent={
            query.trim() ? (
              <PremiumEmptyState
                icon="search-outline"
                title="No results"
                subtitle="Try a different project name or city."
              />
            ) : (
              <PremiumEmptyState
                icon="chatbubbles-outline"
                title={t('noConversations')}
                subtitle={t('noConversationsSub')}
              />
            )
          }
        />
      )}
    </View>
  );
}

const createStyles = (c: PremiumColors) => StyleSheet.create({
  screen: { flex: 1 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
    gap: space.sm,
  },
  listHeader: {
    ...text.label,
    letterSpacing: 1,
  },
  unreadPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: GOLD,
  },
  unreadPillText: {
    ...text.micro,
    color: GOLD,
    fontWeight: weight.heavy,
  },
  errorText: {
    ...text.footnote,
    color: c.isDark ? DANGER_SOFT : c.danger,
    marginBottom: space.sm,
  },
  noResults: {
    ...text.caption,
    marginBottom: space.md,
    textAlign: 'center',
  },
});
