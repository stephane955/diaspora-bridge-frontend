import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import {
  ALPHA,
  GOLD,
  icon as iconSize,
  radius,
  space,
  text,
  withAlpha,
} from '@/constants/design';
import { successFeedback } from '@/utils/haptics';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * The single empty state for the whole app. Every list, feed and gallery that
 * can be empty should render this rather than a bare string or a bespoke
 * icon + text block.
 */
export default function PremiumEmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: Props) {
  const c = usePremiumColors();

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.iconDisk,
          {
            backgroundColor: withAlpha(c.isDark ? '#FFFFFF' : '#0F172A', ALPHA.soft),
            borderColor: c.border,
          },
        ]}
      >
        <Ionicons name={icon} size={iconSize.lg} color={c.textSecondary} />
      </View>
      <Text style={[styles.title, { color: c.textPrimary }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: c.textSecondary }]}>{subtitle}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity
          style={styles.btn}
          activeOpacity={0.88}
          onPress={() => {
            successFeedback();
            onAction();
          }}
        >
          <Text style={styles.btnText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xxl,
    paddingVertical: space.xxl + space.sm,
    gap: space.xs,
  },
  iconDisk: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
    borderWidth: 1,
  },
  title: {
    ...text.title,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitle: {
    ...text.footnote,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 280,
  },
  btn: {
    marginTop: space.sm,
    backgroundColor: GOLD,
    paddingHorizontal: space.xl - space.xxs,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
  },
  btnText: {
    color: '#0A0F1A',
    ...text.footnote,
    fontWeight: '800',
  },
});
