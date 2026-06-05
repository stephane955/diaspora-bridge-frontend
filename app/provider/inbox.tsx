import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import PremiumHeader from '@/components/PremiumHeader';
import PulseLoader from '@/components/PulseLoader';
import ChatThreadRow from '@/components/ChatThreadRow';
import { providerMenuItems } from '@/constants/premiumMenus';
import { useInboxThreads } from '@/hooks/useInboxThreads';
import { markProjectChatRead } from '@/lib/chatReadState';
import { theme } from '@/constants/theme';
import { FLOATING_TAB_BAR_HEIGHT, PREMIUM_BG, PREMIUM_GOLD, TEXT_PRIMARY, TEXT_SECONDARY } from '@/constants/layout';

export default function ProviderInboxScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const { t } = useLanguage();
    const [refreshing, setRefreshing] = useState(false);

    const { threads, loading, error, refetch } = useInboxThreads(user?.id, 'provider');

    useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

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
        <View style={styles.screen}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <PremiumHeader
                title={t('inboxTitle')}
                subtitle={
                    unreadTotal > 0
                        ? `${unreadTotal} ${t('unreadLabel')}`
                        : t('messagesSubtitleProvider')
                }
                menuItems={providerMenuItems(router, t)}
            />
            {loading ? (
                <View style={styles.center}>
                    <PulseLoader color={theme.colors.emerald} />
                </View>
            ) : (
                <FlatList
                    data={threads}
                    keyExtractor={(item) => item.projectId}
                    renderItem={({ item }) => (
                        <ChatThreadRow
                            thread={item}
                            voiceLabel={`🎤 ${t('voiceMessage')}`}
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
                            <Text style={styles.listHeader}>{t('conversationsTitle')}</Text>
                        ) : null
                    }
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="chatbubbles-outline" size={56} color={TEXT_SECONDARY} />
                            <Text style={styles.emptyTitle}>{t('noConversations')}</Text>
                            <Text style={styles.emptyText}>{t('noConversationsSub')}</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: PREMIUM_BG },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: PREMIUM_BG },
    listHeader: {
        fontSize: 12,
        fontWeight: '800',
        color: TEXT_SECONDARY,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 12,
    },
    errorText: { color: '#F87171', marginBottom: 12, fontWeight: '600' },
    empty: { flex: 1, paddingTop: 80, alignItems: 'center', gap: 8, paddingHorizontal: 24 },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: TEXT_PRIMARY, textAlign: 'center' },
    emptyText: { color: TEXT_SECONDARY, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
