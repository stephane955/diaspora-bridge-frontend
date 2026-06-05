import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mediumFeedback } from '@/utils/haptics';
import { PREMIUM_GOLD, PREMIUM_MUTED } from '@/constants/layout';

export type NotificationRecord = {
    id: number | string;
    type?: string;
    title?: string;
    message?: string;
    created_at: string;
    is_read?: boolean;
    project_id?: string | null;
};

type IconName = keyof typeof Ionicons.glyphMap;

function getIcon(type?: string) {
    switch (type) {
        case 'chat':
        case 'new_message':
        case 'message':
            return { name: 'chatbubbles' as IconName, color: '#60A5FA', bg: 'rgba(96,165,250,0.15)' };
        case 'assignment':
            return { name: 'person-add' as IconName, color: '#60A5FA', bg: 'rgba(96,165,250,0.12)' };
        case 'payment':
            return { name: 'wallet' as IconName, color: '#34D399', bg: 'rgba(52,211,153,0.12)' };
        default:
            return { name: 'notifications' as IconName, color: PREMIUM_MUTED, bg: 'rgba(255,255,255,0.06)' };
    }
}

export default function NotificationItem({
    item,
    onPress,
    unreadLabel = 'Unread',
    tapHint = 'Tap to open conversation',
}: {
    item: NotificationRecord;
    onPress?: () => void;
    unreadLabel?: string;
    tapHint?: string;
}) {
    const isUnread = !item.is_read;
    const iconData = getIcon(item.type);
    const isMessage = item.type === 'chat' || item.type === 'new_message' || item.type === 'message';

    return (
        <TouchableOpacity
            style={[styles.container, isUnread ? styles.unread : styles.read]}
            onPress={() => {
                mediumFeedback();
                onPress?.();
            }}
            activeOpacity={0.85}
        >
            {isUnread && <View style={styles.unreadAccent} />}
            <View style={[styles.iconCircle, { backgroundColor: iconData.bg }]}>
                <Ionicons name={iconData.name} size={20} color={iconData.color} />
            </View>
            <View style={styles.body}>
                <View style={styles.titleRow}>
                    <Text style={[styles.title, isUnread && styles.titleUnread]} numberOfLines={1}>
                        {item.title || 'Notification'}
                    </Text>
                    {isUnread && (
                        <View style={styles.unreadPill}>
                            <Text style={styles.unreadPillText}>{unreadLabel}</Text>
                        </View>
                    )}
                </View>
                <Text style={[styles.message, isUnread && styles.messageUnread]} numberOfLines={2}>
                    {item.message}
                </Text>
                <Text style={styles.time}>
                    {new Date(item.created_at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                </Text>
                {isUnread && isMessage && (
                    <Text style={styles.tapHint}>{tapHint}</Text>
                )}
            </View>
            {isUnread && <View style={styles.unreadDot} />}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        padding: 16,
        marginBottom: 10,
        alignItems: 'flex-start',
        gap: 12,
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
        position: 'relative',
    },
    read: {
        backgroundColor: 'rgba(17,24,39,0.55)',
        borderColor: 'rgba(255,255,255,0.06)',
    },
    unread: {
        backgroundColor: 'rgba(37,99,235,0.12)',
        borderColor: 'rgba(212,175,55,0.35)',
    },
    unreadAccent: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        backgroundColor: PREMIUM_GOLD,
    },
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    body: { flex: 1, gap: 2 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    title: { fontSize: 15, fontWeight: '600', color: PREMIUM_MUTED, flex: 1 },
    titleUnread: { fontWeight: '800', color: '#F8FAFC' },
    unreadPill: {
        backgroundColor: 'rgba(212,175,55,0.2)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.4)',
    },
    unreadPillText: { fontSize: 10, fontWeight: '800', color: PREMIUM_GOLD, letterSpacing: 0.3 },
    message: { fontSize: 13, color: '#94A3B8', lineHeight: 18 },
    messageUnread: { color: '#E2E8F0', fontWeight: '600' },
    time: { fontSize: 11, color: '#94A3B8', marginTop: 4 },
    tapHint: { fontSize: 11, color: PREMIUM_GOLD, fontWeight: '700', marginTop: 4 },
    unreadDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: PREMIUM_GOLD,
        marginTop: 4,
    },
});
