import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import { radius, space, text, weight, withAlpha } from '@/constants/design';

type Props = {
  title: string;
  children: React.ReactNode;
  footer?: string;
};

export default function SettingsSection({ title, children, footer }: Props) {
  const c = usePremiumColors();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: c.textSecondary }]}>{title}</Text>
      <BlurView
        intensity={Platform.OS === 'ios' ? 52 : 40}
        tint={c.blurTint}
        style={[
          styles.card,
          {
            borderColor: c.border,
            backgroundColor: c.isDark ? withAlpha('#111827', 0.82) : withAlpha('#FFFFFF', 0.92),
          },
        ]}
      >
        {children}
      </BlurView>
      {footer ? (
        <Text style={[styles.footer, { color: c.muted }]}>{footer}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.lg },
  title: {
    ...text.micro,
    fontWeight: weight.heavy,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: space.sm,
    marginLeft: space.xxs,
  },
  card: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 3 },
    }),
  },
  footer: {
    ...text.caption,
    marginTop: space.sm,
    marginLeft: space.xxs,
    lineHeight: 18,
  },
});
