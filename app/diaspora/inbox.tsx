import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import NotificationItem from '@/components/NotificationItem';
import ScreenGradient from '@/components/ScreenGradient';
import PulseLoader from '@/components/PulseLoader';
import NavigationBar from '@/components/NavigationBar';
import { theme } from '@/constants/theme';
import { mediumFeedback } from '@/utils/haptics';

export default function InboxScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (data) setNotifications(data);
        setLoading(false);
        setRefreshing(false);
    }, [user]);

    const markAllAsRead = async () => {
        if (!user || notifications.length === 0) return;
        const hasUnread = notifications.some(n => !n.is_read);
        if (!hasUnread) return;
        await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('is_read', false);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    };

    useEffect(() => { fetchNotifications(); }, [fetchNotifications]);
    useEffect(() => {
        const timer = setTimeout(() => { markAllAsRead(); }, 2000);
        return () => clearTimeout(timer);
    }, [notifications]);

    const onRefresh = () => { setRefreshing(true); fetchNotifications(); };

    const handleNotificationPress = async (item: any) => {
        mediumFeedback();
        if (!item.is_read) {
            await supabase.from('notifications').update({ is_read: true }).eq('id', item.id);
            setNotifications(prev => prev.map(n => (n.id === item.id ? { ...n, is_read: true } : n)));
        }
        if (item.type === 'chat' || item.type === 'new_message' || item.type === 'message') {
            if (item.project_id) router.push(`/chat/${item.project_id}`);
            return;
        }
        if (item.project_id) router.push(`/diaspora/project/${item.project_id}`);
    };

    return (
        <ScreenGradient>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="light-content" />
            <NavigationBar title="Inbox" showBack onMenuPress={() => router.replace('/diaspora')} />
            {loading ? (
                <View style={styles.center}>
                    <PulseLoader />
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => <NotificationItem item={item} onPress={() => handleNotificationPress(item)} />}
                    contentContainerStyle={{ paddingTop: 20, paddingBottom: (insets?.bottom ?? 0) + 120, paddingHorizontal: theme.spacing.lg }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="notifications-off-outline" size={56} color={theme.colors.border} />
                            <Text style={styles.emptyTitle}>All caught up!</Text>
                            <Text style={styles.emptyText}>No new notifications right now.</Text>
                        </View>
                    }
                />
            )}
        </ScreenGradient>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    empty: { paddingTop: 80, alignItems: 'center', gap: 8 },
    emptyTitle: { fontSize: 18, ...theme.typography.title, color: theme.colors.text },
    emptyText: { color: theme.colors.textMuted, fontSize: 14 },
});
