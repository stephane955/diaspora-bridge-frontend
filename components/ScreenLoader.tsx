import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PulseLoader from '@/components/PulseLoader';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import { space, text } from '@/constants/design';

type Props = {
  /** Optional caption below the pulse, e.g. "Loading your projects". */
  label?: string;
  /** Fill the screen and paint the themed background. Default true. */
  fullScreen?: boolean;
};

/**
 * The single full-screen loading state for the whole app.
 *
 * Replaces the previous split between PulseLoader on 17 screens,
 * bare ActivityIndicator on 10, and nothing at all on the rest.
 * Keep ActivityIndicator only for in-button spinners.
 */
export default function ScreenLoader({ label, fullScreen = true }: Props) {
  const c = usePremiumColors();

  return (
    <View
      style={[
        styles.wrap,
        fullScreen && { flex: 1, backgroundColor: c.bg },
      ]}
    >
      <PulseLoader />
      {label ? (
        <Text style={[styles.label, { color: c.textSecondary }]}>{label}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  label: {
    ...text.footnote,
    textAlign: 'center',
  },
});
