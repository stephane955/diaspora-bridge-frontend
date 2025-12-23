import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import NavigationBar from '@/components/NavigationBar';
import NotificationItem from '@/components/NotificationItem';
import GlassNavigation from '@/components/GlassNavigation';

export default function InboxScreen() {
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

    // Function to update database
    const markAllAsRead = async () => {
        if (!user || notifications.length === 0) return;

        const hasUnread = notifications.some(n => !n.is_read);
        if (!hasUnread) return;

        await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('is_read', false);

        // Update local state so the dots disappear immediately
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    };

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    // Automatically mark as read after 2 seconds of viewing the screen
    useEffect(() => {
        const timer = setTimeout(() => {
            markAllAsRead();
        }, 2000);
        return () => clearTimeout(timer);
    }, [notifications]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchNotifications();
    };

    return (
        <View style={styles.container}>
            <NavigationBar title="Inbox" subtitle="Your project alerts" showBack={false} />

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>
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

            <GlassNavigation />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    empty: { padding: 40, alignItems: 'center' },
    emptyText: { color: '#94A3B8', fontSize: 16, fontWeight: '500' }
});