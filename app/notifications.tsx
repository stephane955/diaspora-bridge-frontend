import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, RefreshControl, StatusBar
} from 'react-native';
import { useRouter, Stack } from 'expo-router'; // <--- Import Stack
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

export default function NotificationsScreen() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const router = useRouter();
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

        if (item.type === 'payment' || item.type === 'withdrawal') {
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
        else {
            router.push('/provider/dashboard');
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchNotifications();
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'payment': return { name: 'wallet', color: '#16A34A', bg: '#DCFCE7' };
            case 'withdrawal': return { name: 'cash', color: '#F59E0B', bg: '#FFF7ED' };
            case 'job_offer': return { name: 'briefcase', color: '#3B82F6', bg: '#EFF6FF' };
            case 'alert': return { name: 'alert-circle', color: '#EF4444', bg: '#FEF2F2' };
            default: return { name: 'notifications', color: '#64748B', bg: '#F1F5F9' };
        }
    };

    return (
        <View style={styles.container}>
            {/* 1. HIDE THE DEFAULT HEADER */}
            <Stack.Screen options={{ headerShown: false }} />

            <StatusBar barStyle="light-content" />

            {/* 2. YOUR CUSTOM GRADIENT HEADER */}
            <LinearGradient colors={['#0F172A', '#334155']} style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('notificationsTitle') || "Notifications"}</Text>
                <View style={{width: 40}} />
            </LinearGradient>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#0F172A" /></View>
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F172A" />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="notifications-off-outline" size={48} color="#CBD5E1" />
                            <Text style={styles.emptyText}>{t('noNotifications') || "No new alerts."}</Text>
                        </View>
                    }
                    renderItem={({ item }) => {
                        const iconData = getIcon(item.type);
                        return (
                            <TouchableOpacity style={[styles.card, !item.is_read && styles.unread]} onPress={() => handlePress(item)}>
                                <View style={[styles.iconCircle, { backgroundColor: iconData.bg }]}>
                                    <Ionicons name={iconData.name as any} size={20} color={iconData.color} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.title}>{item.title || t('notificationDefaultTitle')}</Text>
                                    <Text style={styles.message} numberOfLines={2}>{item.message || item.body}</Text>
                                    <Text style={styles.time}>{new Date(item.created_at).toLocaleDateString()}</Text>
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
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#fff'
    },

    empty: { padding: 40, alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#94A3B8', fontSize: 16, fontWeight: '500', marginTop: 10 },

    card: { flexDirection: 'row', padding: 16, backgroundColor: '#fff', marginBottom: 12, alignItems: 'center', gap: 15, borderRadius: 16, borderWidth: 1, borderColor: 'transparent', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 5, elevation: 1 },
    unread: { borderColor: '#E2E8F0', backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },

    iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
    message: { fontSize: 13, color: '#64748B', marginTop: 2, lineHeight: 18 },
    time: { fontSize: 11, color: '#94A3B8', marginTop: 6 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }
});