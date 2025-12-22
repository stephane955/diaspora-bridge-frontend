import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function NotificationItem({ item }: { item: any }) {
    const getIcon = () => {
        switch(item.type) {
            case 'assignment': return { name: 'person-add', color: '#0EA5E9', bg: '#F0F9FF' };
            case 'payment': return { name: 'wallet', color: '#16A34A', bg: '#F0FDF4' };
            default: return { name: 'notifications', color: '#64748B', bg: '#F1F5F9' };
        }
    };

    const iconData = getIcon();

    return (
        <TouchableOpacity style={[styles.container, !item.is_read && styles.unread]}>
            <View style={[styles.iconCircle, { backgroundColor: iconData.bg }]}>
                <Ionicons name={iconData.name as any} size={20} color={iconData.color} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.message}>{item.message}</Text>
                <Text style={styles.time}>{new Date(item.created_at).toLocaleDateString()}</Text>
            </View>
            {!item.is_read && <View style={styles.unreadDot} />}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: { flexDirection: 'row', padding: 16, backgroundColor: '#fff', marginBottom: 1, alignItems: 'center', gap: 15 },
    unread: { backgroundColor: '#F8FAFC' },
    iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
    message: { fontSize: 13, color: '#64748B', marginTop: 2 },
    time: { fontSize: 11, color: '#94A3B8', marginTop: 4 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0EA5E9' }
});