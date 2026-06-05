import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ChatThread } from '@/hooks/useInboxThreads';
import { PREMIUM_GOLD, TEXT_PRIMARY, TEXT_SECONDARY } from '@/constants/layout';
import { mediumFeedback } from '@/utils/haptics';

type Props = {
    thread: ChatThread;
    onPress: () => void;
    voiceLabel?: string;
};

function formatThreadTime(iso: string) {
    if (iso === new Date(0).toISOString()) return '';
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ChatThreadRow({ thread, onPress, voiceLabel = '🎤 Voice Message' }: Props) {
    const preview = thread.isVoice ? voiceLabel : thread.latestPreview;

    return (
        <TouchableOpacity
            style={[styles.row, thread.unreadCount > 0 && styles.rowUnread]}
            activeOpacity={0.85}
            onPress={() => {
                mediumFeedback();
                onPress();
            }}
        >
            <Image
                source={{
                    uri: thread.projectImage || 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=200',
                }}
                style={styles.avatar}
            />
            <View style={styles.body}>
                <View style={styles.topRow}>
                    <Text style={styles.title} numberOfLines={1}>
                        {thread.projectTitle}
                    </Text>
                    <Text style={styles.time}>{formatThreadTime(thread.latestAt)}</Text>
                </View>
                {thread.projectCity ? (
                    <Text style={styles.city} numberOfLines={1}>{thread.projectCity}</Text>
                ) : null}
                <Text
                    style={[styles.preview, thread.unreadCount > 0 && styles.previewUnread]}
                    numberOfLines={2}
                >
                    {preview}
                </Text>
            </View>
            <View style={styles.trailing}>
                {thread.unreadCount > 0 ? (
                    <View style={styles.unreadDot}>
                        <Text style={styles.unreadText}>
                            {thread.unreadCount > 9 ? '9+' : thread.unreadCount}
                        </Text>
                    </View>
                ) : (
                    <Ionicons name="chevron-forward" size={18} color={TEXT_SECONDARY} />
                )}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        marginBottom: 10,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        gap: 12,
    },
    rowUnread: {
        borderColor: 'rgba(212,175,55,0.25)',
        backgroundColor: 'rgba(212,175,55,0.06)',
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 16,
        backgroundColor: '#1E293B',
    },
    body: { flex: 1, minWidth: 0 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    title: { flex: 1, fontSize: 16, fontWeight: '800', color: TEXT_PRIMARY },
    time: { fontSize: 11, fontWeight: '600', color: TEXT_SECONDARY },
    city: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 2 },
    preview: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 4, lineHeight: 18 },
    previewUnread: { color: TEXT_PRIMARY, fontWeight: '600' },
    trailing: { alignItems: 'center', justifyContent: 'center', minWidth: 24 },
    unreadDot: {
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: PREMIUM_GOLD,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    unreadText: { color: '#0A0F1A', fontSize: 11, fontWeight: '800' },
});
