import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useProjectUnreadCount } from '@/hooks/useProjectUnreadCount';
import { markProjectChatRead } from '@/lib/chatReadState';
import { SCROLL_BOTTOM_INSET, PREMIUM_GOLD } from '@/constants/layout';
import { successFeedback } from '@/utils/haptics';

type Props = {
    projectId: string;
    bottomOffset?: number;
    onPress: () => void;
};

export default function ProjectChatFab({ projectId, bottomOffset, onPress }: Props) {
    const { user } = useAuth();
    const { unreadCount, refreshUnread } = useProjectUnreadCount(projectId, user?.id);
    /** Sit clearly above the floating glass tab bar */
    const bottom = bottomOffset ?? SCROLL_BOTTOM_INSET + 8;

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.wrap, { bottom }]}
            onPress={async () => {
                successFeedback();
                if (user?.id) {
                    await markProjectChatRead(user.id, projectId);
                    await refreshUnread();
                }
                onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel="Open project chat"
        >
            <BlurView intensity={90} tint="dark" style={styles.blur}>
                <Ionicons name="chatbubbles" size={26} color={PREMIUM_GOLD} />
                {unreadCount > 0 && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                    </View>
                )}
            </BlurView>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    wrap: {
        position: 'absolute',
        right: 20,
        zIndex: 50,
        borderRadius: 28,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.35)',
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 8,
    },
    blur: {
        width: 56,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(10,15,26,0.75)',
    },
    badge: {
        position: 'absolute',
        top: 4,
        right: 4,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#EF4444',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        borderWidth: 1.5,
        borderColor: '#0A0F1A',
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '800',
    },
});
