import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import NavigationBar from '@/components/NavigationBar';

export default function NotificationsScreen() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const router = useRouter();
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

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const resolveRoute = (item: any) => {
        if (item.route) return item.route;
        if ((item.type === 'message' || item.type === 'chat') && (item.project_id || item.chat_id)) {
            return `/chat/${item.project_id || item.chat_id}`;
        }
        if (item.project_id) return `/diaspora/project/${item.project_id}`;
        return '/diaspora';
    };

    const handlePress = async (item: any) => {
        if (!item.is_read) {
            await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', item.id);
            setNotifications(prev => prev.map(n => (n.id === item.id ? { ...n, is_read: true } : n)));
        }
        router.push(resolveRoute(item));
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchNotifications();
    };

    return (
        <View style={styles.container}>
            <NavigationBar title={t('notificationsTitle')} subtitle={t('notificationsSubtitle')} showBack={false} />

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={{ paddingBottom: 120 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Text style={styles.emptyText}>{t('noNotifications')}</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity style={[styles.card, !item.is_read && styles.unread]} onPress={() => handlePress(item)}>
                            <View style={styles.iconCircle}>
                                <Ionicons name="notifications" size={20} color="#0EA5E9" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.title}>{item.title || t('notificationDefaultTitle')}</Text>
                                <Text style={styles.message}>{item.message || t('notificationDefaultBody')}</Text>
                                <Text style={styles.time}>{new Date(item.created_at).toLocaleDateString()}</Text>
                            </View>
                            {!item.is_read && <View style={styles.unreadDot} />}
                        </TouchableOpacity>
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    empty: { padding: 40, alignItems: 'center' },
    emptyText: { color: '#94A3B8', fontSize: 16, fontWeight: '500' },
    card: { flexDirection: 'row', padding: 16, backgroundColor: '#fff', marginBottom: 1, alignItems: 'center', gap: 15 },
    unread: { backgroundColor: '#F8FAFC' },
    iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F9FF' },
    title: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
    message: { fontSize: 13, color: '#64748B', marginTop: 2 },
    time: { fontSize: 11, color: '#94A3B8', marginTop: 4 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0EA5E9' }
});
