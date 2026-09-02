import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import PremiumHeader from '@/components/PremiumHeader';
import PremiumEmptyState from '@/components/PremiumEmptyState';
import ScreenLoader from '@/components/ScreenLoader';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import { useScreenOffsets } from '@/hooks/useScreenOffsets';
import {
    ALPHA,
    DANGER,
    GOLD,
    ICON_BUTTON_SIZE,
    INFO_SOFT,
    icon as iconSize,
    radius,
    shadow,
    space,
    SUCCESS,
    text,
    WARNING,
    withAlpha,
} from '@/constants/design';

export default function NotificationsScreen() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const router = useRouter();
    const c = usePremiumColors();
    const offsets = useScreenOffsets({ tabBar: false });
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        try {
            const { data } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (data) setNotifications(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const handlePress = async (item: any) => {
        if (!item.is_read) {
            await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', item.id);
            setNotifications(prev => prev.map(n => (n.id === item.id ? { ...n, is_read: true } : n)));
        }

        if (item.type === 'chat' || item.type === 'new_message' || item.type === 'message') {
            const chatId = item.project_id ?? item.chat_id ?? item.id;
            if (chatId && typeof chatId === 'string') router.push(`/chat/${chatId}`);
            else if (chatId && typeof chatId === 'number') router.push(`/chat/${String(chatId)}`);
            else router.back();
        }
        else if (item.type === 'payment' || item.type === 'withdrawal') {
            router.push('/provider/earnings');
        }
        else if (item.type === 'job_offer') {
            router.push('/provider/requests');
        }
        else if (item.type === 'milestone_unlocked' || item.type === 'hired') {
            router.push(`/provider/project/${item.project_id}`);
        }
        else if (item.type === 'verification') {
            router.push('/provider/profile');
        }
        else if (item.project_id && (item.link === 'chat' || item.route === 'chat')) {
            router.push(`/chat/${item.project_id}`);
        }
        else {
            router.replace('/provider');
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchNotifications();
    };

    /** One semantic accent per notification type, from the shared token set. */
    const getIcon = (type: string): { name: string; color: string } => {
        switch (type) {
            case 'chat':
            case 'new_message':
            case 'message': return { name: 'chatbubbles', color: INFO_SOFT };
            case 'payment': return { name: 'wallet', color: SUCCESS };
            case 'withdrawal': return { name: 'cash', color: WARNING };
            case 'job_offer': return { name: 'briefcase', color: GOLD };
            case 'alert': return { name: 'alert-circle', color: DANGER };
            default: return { name: 'notifications', color: c.textSecondary };
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: c.bg }]}>
            <Stack.Screen options={{ headerShown: false }} />

            <PremiumHeader
                title={t('notificationsTitle') || 'Notifications'}
                showBack
                fallbackRoute="/"
                hideMenu
            />

            {loading ? (
                <ScreenLoader />
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={offsets.content}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={c.gold}
                        />
                    }
                    ListEmptyComponent={
                        <PremiumEmptyState
                            icon="notifications-off-outline"
                            title={t('noNotifications') || 'No new alerts'}
                            subtitle="Updates about your projects, payments and messages land here."
                        />
                    }
                    renderItem={({ item }) => {
                        const iconData = getIcon(item.type);
                        return (
                            <TouchableOpacity
                                style={[
                                    styles.card,
                                    { backgroundColor: c.surface, borderColor: c.border },
                                    !item.is_read && { borderColor: withAlpha(GOLD, ALPHA.strong) },
                                ]}
                                onPress={() => handlePress(item)}
                                activeOpacity={0.85}
                            >
                                <View
                                    style={[
                                        styles.iconCircle,
                                        { backgroundColor: withAlpha(iconData.color, ALPHA.medium) },
                                    ]}
                                >
                                    <Ionicons
                                        name={iconData.name as any}
                                        size={iconSize.sm}
                                        color={iconData.color}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.title, { color: c.textPrimary }]}>
                                        {item.title || t('notificationDefaultTitle')}
                                    </Text>
                                    <Text
                                        style={[styles.message, { color: c.textSecondary }]}
                                        numberOfLines={2}
                                    >
                                        {item.message || item.body}
                                    </Text>
                                    <Text style={[styles.time, { color: c.muted }]}>
                                        {new Date(item.created_at).toLocaleDateString()}
                                    </Text>
                                </View>
                                {!item.is_read && <View style={styles.unreadDot} />}
                            </TouchableOpacity>
                        );
                    }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },

    card: {
        flexDirection: 'row',
        padding: space.md,
        marginBottom: space.sm,
        alignItems: 'center',
        gap: space.sm,
        borderRadius: radius.lg,
        borderWidth: 1,
        ...shadow.card,
    },

    iconCircle: {
        width: ICON_BUTTON_SIZE,
        height: ICON_BUTTON_SIZE,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: text.footnote,
    message: { ...text.caption, marginTop: 2, lineHeight: 18 },
    time: { ...text.micro, marginTop: space.xxs },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: radius.pill,
        backgroundColor: GOLD,
    },
});
