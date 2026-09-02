import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/context/ThemeContext';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import { successFeedback } from '@/utils/haptics';
import { useLanguage } from '@/context/LanguageContext';

type Props = {
  /** Compact row for settings lists */
  compact?: boolean;
  /** Render inside SettingsSection card (no outer chrome) */
  embedded?: boolean;
};

/**
 * Sun/Moon theme toggle — cycles light ↔ dark (stores explicit mode, not system).
 */
export default function ThemeToggleRow({ compact, embedded }: Props) {
  const { isDark, setThemeMode, themeMode } = useTheme();
  const c = usePremiumColors();
  const { t } = useLanguage();

  const toggle = async () => {
    successFeedback();
    await setThemeMode(isDark ? 'light' : 'dark');
  };

  const row = (
    <>
      <View style={[styles.iconWrap, { backgroundColor: isDark ? 'rgba(212,175,55,0.15)' : 'rgba(37,99,235,0.12)' }]}>
        <Ionicons
          name={isDark ? 'moon' : 'sunny'}
          size={20}
          color={isDark ? c.gold : c.blue}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: c.textPrimary }]}>
          {t('appearance')}
        </Text>
        <Text style={[styles.sub, { color: c.textSecondary }]}>
          {isDark ? t('darkModeOn') : t('lightModeOn')}
          {themeMode === 'system' ? ` · ${t('system')}` : ''}
        </Text>
      </View>
      <Switch
        value={isDark}
        onValueChange={toggle}
        trackColor={{ false: '#CBD5E1', true: 'rgba(212,175,55,0.45)' }}
        thumbColor={isDark ? c.gold : '#FFFFFF'}
      />
      <TouchableOpacity onPress={toggle} hitSlop={8} style={styles.iconBtn}>
        <Ionicons
          name={isDark ? 'sunny-outline' : 'moon-outline'}
          size={18}
          color={c.textSecondary}
        />
      </TouchableOpacity>
    </>
  );

  if (embedded) {
    return (
      <View style={[styles.row, styles.embedded, compact && styles.compact]}>
        {row}
      </View>
    );
  }

  return (
    <BlurView intensity={36} tint={c.blurTint} style={[styles.row, compact && styles.compact]}>
      {row}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    marginBottom: 12,
  },
  embedded: {
    borderWidth: 0,
    borderRadius: 0,
    marginBottom: 0,
    backgroundColor: 'transparent',
  },
  compact: { paddingVertical: 12 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  iconBtn: { padding: 4 },
});
