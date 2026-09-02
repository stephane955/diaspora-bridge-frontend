import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  Home,
  Wallet,
  MessageCircle,
  User,
  HardHat,
  ScanLine,
  ClipboardList,
} from 'lucide-react-native';
import { successFeedback } from '@/utils/haptics';
import {
  ALPHA,
  FLOATING_TAB_BAR_HEIGHT,
  GOLD,
  GOLD_BORDER,
  GOLD_TINT,
  ICON_BUTTON_SIZE,
  icon as iconSize,
  radius,
  shadow,
  TAB_BAR_BOTTOM_GAP,
  TAB_BAR_SIDE_INSET,
  TAB_BAR_VISUAL_HEIGHT,
  withAlpha,
} from '@/constants/design';
import { usePremiumColors } from '@/hooks/usePremiumColors';

export type TabBarRole = 'client' | 'provider' | 'supplier';

const CLIENT_ROUTES = ['index', 'wallet', 'inbox', 'profile'] as const;
const PROVIDER_ROUTES = ['active', 'cart-hub', 'inbox', 'profile'] as const;
const SUPPLIER_ROUTES = ['dashboard', 'scanner'] as const;

/**
 * Full-bleed routes where a floating pill over the content is wrong — a camera
 * viewfinder needs its whole frame and its own capture control at the bottom.
 */
const HIDE_TAB_BAR_ON = new Set(['verification-scan', 'scanner']);

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const CLIENT_ICONS: Record<string, LucideIcon> = {
  index: Home,
  wallet: Wallet,
  inbox: MessageCircle,
  profile: User,
};

const PROVIDER_ICONS: Record<string, LucideIcon> = {
  active: HardHat,
  'cart-hub': ScanLine,
  inbox: MessageCircle,
  profile: User,
};

const SUPPLIER_ICONS: Record<string, LucideIcon> = {
  dashboard: ClipboardList,
  scanner: ScanLine,
};

type Props = BottomTabBarProps & {
  role?: TabBarRole;
};

export default function GlassTabBar({ state, descriptors, navigation, role = 'client' }: Props) {
  const c = usePremiumColors();
  const insets = useSafeAreaInsets();
  const allowed =
    role === 'provider' ? PROVIDER_ROUTES : role === 'supplier' ? SUPPLIER_ROUTES : CLIENT_ROUTES;
  const iconMap =
    role === 'provider' ? PROVIDER_ICONS : role === 'supplier' ? SUPPLIER_ICONS : CLIENT_ICONS;

  const visibleRoutes = state.routes.filter((route) => {
    const options = descriptors[route.key]?.options ?? {};
    const href = (options as { href?: string | null }).href;
    const display = (options as { display?: string }).display;
    if (href === null || display === 'none') return false;
    return (allowed as readonly string[]).includes(route.name);
  });

  if (HIDE_TAB_BAR_ON.has(state.routes[state.index]?.name)) return null;

  return (
    <View
      style={[styles.container, { bottom: Math.max(insets.bottom, TAB_BAR_BOTTOM_GAP) }]}
      pointerEvents="box-none"
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? 92 : 80}
        tint={c.blurTint}
        style={[
          styles.glass,
          { borderColor: c.isDark ? withAlpha(GOLD, ALPHA.medium) : c.border },
        ]}
      >
        <View style={[styles.glassTint, { backgroundColor: c.glass }]} pointerEvents="none" />
        {visibleRoutes.map((route) => {
          const isFocused = state.routes[state.index].key === route.key;
          const Icon = iconMap[route.name] ?? Home;
          const color = isFocused ? c.gold : c.textSecondary;
          const label =
            (descriptors[route.key]?.options as { title?: string })?.title ?? route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            successFeedback();
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              style={styles.tab}
              activeOpacity={0.85}
            >
              <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
                <Icon size={iconSize.md} color={color} strokeWidth={isFocused ? 2.5 : 2} />
              </View>
              {isFocused ? <View style={styles.activeGlow} /> : null}
            </TouchableOpacity>
          );
        })}
      </BlurView>
    </View>
  );
}

export { FLOATING_TAB_BAR_HEIGHT };

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: TAB_BAR_SIDE_INSET,
    right: TAB_BAR_SIDE_INSET,
    height: TAB_BAR_VISUAL_HEIGHT,
    borderRadius: radius.pill,
    overflow: 'hidden',
    ...shadow.floating,
  },
  glass: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: radius.pill,
    overflow: 'hidden',
    borderWidth: 1,
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
  },
  tab: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: ICON_BUTTON_SIZE,
    height: ICON_BUTTON_SIZE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: GOLD_TINT,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
  },
  activeGlow: {
    position: 'absolute',
    bottom: 8,
    width: 18,
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: GOLD,
  },
});
