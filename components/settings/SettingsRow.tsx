import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import { lightFeedback } from '@/utils/haptics';
import { GOLD, radius, space, text, weight, withAlpha } from '@/constants/design';

type IconName = keyof typeof Ionicons.glyphMap;

type Props = {
  icon: IconName;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showDivider?: boolean;
  destructive?: boolean;
  trailing?: React.ReactNode;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
  switchTrackOn?: string;
};

export default function SettingsRow({
  icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  onPress,
  showDivider = false,
  destructive = false,
  trailing,
  switchValue,
  onSwitchChange,
  switchTrackOn,
}: Props) {
  const c = usePremiumColors();
  const isSwitch = onSwitchChange !== undefined && switchValue !== undefined;
  const interactive = !!onPress || isSwitch;

  const content = (
    <>
      {showDivider ? (
        <View style={[styles.divider, { backgroundColor: c.border }]} />
      ) : null}
      <View style={styles.row}>
        <LinearGradient
          colors={[withAlpha(iconBg, 0.95), withAlpha(iconBg, 0.55)]}
          style={styles.iconWrap}
        >
          <Ionicons name={icon} size={20} color={iconColor} />
        </LinearGradient>

        <View style={styles.copy}>
          <Text
            style={[
              styles.title,
              { color: destructive ? c.danger : c.textPrimary },
            ]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: c.textSecondary }]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {trailing ?? (isSwitch ? (
          <Switch
            value={switchValue}
            onValueChange={(v) => {
              lightFeedback();
              onSwitchChange?.(v);
            }}
            trackColor={{
              false: c.isDark ? '#334155' : '#CBD5E1',
              true: switchTrackOn ?? withAlpha(GOLD, 0.45),
            }}
            thumbColor={switchValue ? GOLD : c.isDark ? '#94A3B8' : '#FFFFFF'}
          />
        ) : onPress ? (
          <View style={[styles.chevronWrap, { backgroundColor: c.isDark ? withAlpha('#FFFFFF', 0.06) : withAlpha('#0F172A', 0.05) }]}>
            <Ionicons name="chevron-forward" size={16} color={c.textSecondary} />
          </View>
        ) : null)}
      </View>
    </>
  );

  if (interactive && onPress && !isSwitch) {
    return (
      <TouchableOpacity activeOpacity={0.82} onPress={() => { lightFeedback(); onPress(); }}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 72,
    marginRight: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    gap: space.md,
    minHeight: 68,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 2 },
  title: { ...text.body, fontWeight: weight.heavy, letterSpacing: -0.2 },
  subtitle: { ...text.caption, fontWeight: weight.semibold, lineHeight: 18 },
  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
