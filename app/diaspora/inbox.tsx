import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import NotificationItem from '@/components/NotificationItem';
import { theme } from '@/constants/theme';

export default function InboxScreen() {
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
        const t = setTimeout(() => { markAllAsRead(); }, 2000);
        return () => clearTimeout(t);
    }, [notifications]);

    const onRefresh = () => { setRefreshing(true); fetchNotifications(); };

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={theme.colors.active} />
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => <NotificationItem item={item} />}
                    contentContainerStyle={{ paddingBottom: 120 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Text style={styles.emptyText}>No notifications yet.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    empty: { padding: theme.spacing.xl, alignItems: 'center' },
    emptyText: { color: theme.colors.textSubtle, fontSize: 16, fontWeight: '500' },
});
