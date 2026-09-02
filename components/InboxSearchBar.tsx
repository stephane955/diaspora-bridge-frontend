import React from 'react';
import { View, TextInput, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import { GOLD, radius, space, text, withAlpha } from '@/constants/design';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
};

export default function InboxSearchBar({ value, onChangeText, placeholder = 'Search conversations…' }: Props) {
  const c = usePremiumColors();

  return (
    <View style={styles.wrap}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 44 : 32}
        tint={c.blurTint}
        style={[
          styles.bar,
          {
            borderColor: c.border,
            backgroundColor: c.isDark ? withAlpha('#111827', 0.75) : withAlpha('#FFFFFF', 0.9),
          },
        ]}
      >
        <Ionicons name="search" size={18} color={c.muted} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.muted}
          style={[styles.input, { color: c.textPrimary }]}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {value.length > 0 ? (
          <Ionicons name="options-outline" size={18} color={GOLD} />
        ) : null}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.md },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: Platform.OS === 'ios' ? space.sm : space.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    ...text.body,
    paddingVertical: space.xs,
  },
});
