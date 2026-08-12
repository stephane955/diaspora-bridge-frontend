import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { ChatThread } from '@/hooks/useInboxThreads';
import { PREMIUM_GOLD } from '@/constants/layout';
import { usePremiumColors } from '@/hooks/usePremiumColors';
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
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ChatThreadRow({
  thread,
  onPress,
  voiceLabel = 'Voice message',
}: Props) {
  const c = usePremiumColors();
  const hasUnread = thread.unreadCount > 0;
  const preview = thread.isVoice ? voiceLabel : thread.latestPreview || 'Tap to open chat';

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => {
        mediumFeedback();
        onPress();
      }}
      style={styles.wrap}
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? 48 : 36}
        tint={c.blurTint}
        style={[
          styles.card,
          {
            borderColor: hasUnread ? 'rgba(212,175,55,0.45)' : c.border,
            backgroundColor: hasUnread
              ? c.isDark
                ? 'rgba(212,175,55,0.1)'
                : 'rgba(212,175,55,0.08)'
              : c.glass,
          },
        ]}
      >
        {hasUnread ? (
          <LinearGradient
            colors={['rgba(212,175,55,0.55)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.accentBar}
          />
        ) : null}

        <View style={[styles.avatarRing, { borderColor: hasUnread ? PREMIUM_GOLD : c.border }]}>
          <Image
            source={{
              uri:
                thread.projectImage ||
                'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=200',
            }}
            style={styles.avatar}
          />
          {hasUnread ? <View style={styles.liveDot} /> : null}
        </View>

        <View style={styles.body}>
          <View style={styles.topRow}>
            <Text
              style={[styles.title, { color: c.textPrimary }]}
              numberOfLines={1}
            >
              {thread.projectTitle}
            </Text>
            <Text style={[styles.time, { color: hasUnread ? PREMIUM_GOLD : c.textSecondary }]}>
              {formatThreadTime(thread.latestAt)}
            </Text>
          </View>

          {thread.projectCity ? (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={12} color={c.muted} />
              <Text style={[styles.city, { color: c.textSecondary }]} numberOfLines={1}>
                {thread.projectCity}
              </Text>
            </View>
          ) : null}

          <View style={styles.previewRow}>
            {thread.isVoice ? (
              <View style={[styles.voicePill, { backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' }]}>
                <Ionicons name="mic" size={12} color={PREMIUM_GOLD} />
              </View>
            ) : null}
            <Text
              style={[
                styles.preview,
                { color: hasUnread ? c.textPrimary : c.textSecondary },
                hasUnread && styles.previewUnread,
              ]}
              numberOfLines={1}
            >
              {preview.replace(/^🎤\s*/, '')}
            </Text>
          </View>
        </View>

        <View style={styles.trailing}>
          {hasUnread ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>
                {thread.unreadCount > 99 ? '99+' : thread.unreadCount}
              </Text>
            </View>
          ) : (
            <View style={[styles.chevronWrap, { backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)' }]}>
              <Ionicons name="chevron-forward" size={16} color={c.textSecondary} />
            </View>
          )}
        </View>
      </BlurView>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
    borderRadius: 22,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.22,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 4 },
    }),
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    gap: 14,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
  },
  avatarRing: {
    width: 58,
    height: 58,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 2,
    backgroundColor: 'rgba(15,23,42,0.35)',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 15,
    backgroundColor: '#1E293B',
  },
  liveDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#0A0F1A',
  },
  body: { flex: 1, minWidth: 0, gap: 3 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  title: { flex: 1, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  time: { fontSize: 11, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  city: { fontSize: 12, fontWeight: '600', flex: 1 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  voicePill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '500' },
  previewUnread: { fontWeight: '700' },
  trailing: { alignItems: 'center', justifyContent: 'center', minWidth: 28 },
  unreadBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: PREMIUM_GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
    shadowColor: PREMIUM_GOLD,
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  unreadText: { color: '#0A0F1A', fontSize: 11, fontWeight: '900' },
  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
