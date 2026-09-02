import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import {
  ALPHA,
  GOLD,
  GOLD_BORDER,
  NAVY,
  SUCCESS,
  icon as iconSize,
  radius,
  space,
  text,
  weight,
  withAlpha,
} from '@/constants/design';

type Props = {
  total: number;
  unread: number;
  roleLabel: string;
};

export default function InboxHeroCard({ total, unread, roleLabel }: Props) {
  const c = usePremiumColors();

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={[withAlpha(NAVY, 0.95), withAlpha('#1E293B', 0.88)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <BlurView intensity={Platform.OS === 'ios' ? 24 : 16} tint="dark" style={styles.inner}>
          <View style={styles.topRow}>
            <View style={styles.iconBadge}>
              <Ionicons name="chatbubbles" size={iconSize.md} color={GOLD} />
            </View>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live</Text>
            </View>
          </View>

          <Text style={styles.headline}>{roleLabel}</Text>
          <Text style={styles.sub}>
            {total === 0
              ? 'Project chats appear here once work begins.'
              : `${total} active ${total === 1 ? 'thread' : 'threads'} · end-to-end encrypted`}
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{total}</Text>
              <Text style={styles.statLabel}>Threads</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: withAlpha('#FFFFFF', ALPHA.medium) }]} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, unread > 0 && { color: GOLD }]}>
                {unread}
              </Text>
              <Text style={styles.statLabel}>Unread</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: withAlpha('#FFFFFF', ALPHA.medium) }]} />
            <View style={styles.stat}>
              <View style={styles.secureRow}>
                <Ionicons name="shield-checkmark" size={14} color={SUCCESS} />
                <Text style={[styles.statValue, { fontSize: 16 }]}>Secure</Text>
              </View>
              <Text style={styles.statLabel}>Escrow chat</Text>
            </View>
          </View>
        </BlurView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: space.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GOLD_BORDER,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.28,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 6 },
    }),
  },
  gradient: { borderRadius: radius.xl },
  inner: {
    padding: space.lg,
    gap: space.xs,
    backgroundColor: withAlpha('#0A0F1A', 0.15),
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.xs,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: withAlpha(GOLD, ALPHA.medium),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: GOLD_BORDER,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xxs,
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs,
    borderRadius: radius.pill,
    backgroundColor: withAlpha(SUCCESS, ALPHA.medium),
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: SUCCESS,
  },
  liveText: {
    ...text.micro,
    color: SUCCESS,
    fontWeight: weight.heavy,
  },
  headline: {
    ...text.title,
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  sub: {
    ...text.caption,
    color: withAlpha('#FFFFFF', 0.72),
    lineHeight: 18,
    marginBottom: space.sm,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: withAlpha('#FFFFFF', 0.12),
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: {
    ...text.subtitle,
    color: '#FFFFFF',
    fontWeight: weight.heavy,
  },
  statLabel: {
    ...text.micro,
    color: withAlpha('#FFFFFF', 0.55),
    fontWeight: weight.heavy,
    textTransform: 'uppercase',
  },
  statDivider: { width: 1, height: 32 },
  secureRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
