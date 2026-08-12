import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  Home,
  Wallet,
  MessageCircle,
  User,
  HardHat,
  ScanLine,
} from 'lucide-react-native';
import { successFeedback } from '@/utils/haptics';
import { FLOATING_TAB_BAR_HEIGHT } from '@/constants/layout';
import { usePremiumColors } from '@/hooks/usePremiumColors';

export type TabBarRole = 'client' | 'provider';

const CLIENT_ROUTES = ['index', 'wallet', 'inbox', 'profile'] as const;
const PROVIDER_ROUTES = ['active', 'cart-hub', 'inbox', 'profile'] as const;

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

type Props = BottomTabBarProps & {
  role?: TabBarRole;
};

export default function GlassTabBar({ state, descriptors, navigation, role = 'client' }: Props) {
  const c = usePremiumColors();
  const allowed = role === 'provider' ? PROVIDER_ROUTES : CLIENT_ROUTES;
  const iconMap = role === 'provider' ? PROVIDER_ICONS : CLIENT_ICONS;

  const visibleRoutes = state.routes.filter((route) => {
    const options = descriptors[route.key]?.options ?? {};
    const href = (options as { href?: string | null }).href;
    const display = (options as { display?: string }).display;
    if (href === null || display === 'none') return false;
    return (allowed as readonly string[]).includes(route.name);
  });

  return (
    <View style={styles.container} pointerEvents="box-none">
      <BlurView
        intensity={Platform.OS === 'ios' ? 92 : 80}
        tint={c.blurTint}
        style={[styles.glass, { borderColor: c.isDark ? 'rgba(212,175,55,0.18)' : 'rgba(15,23,42,0.08)' }]}
      >
        <View style={[styles.glassTint, { backgroundColor: c.glass }]} pointerEvents="none" />
        {visibleRoutes.map((route) => {
          const isFocused = state.routes[state.index].key === route.key;
          const Icon = iconMap[route.name] ?? Home;
          const color = isFocused ? c.gold : c.textSecondary;

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
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              style={styles.tab}
              activeOpacity={0.85}
            >
              <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
                <Icon size={22} color={color} strokeWidth={isFocused ? 2.5 : 2} />
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
    bottom: 20,
    left: 16,
    right: 16,
    height: FLOATING_TAB_BAR_HEIGHT - 28,
    borderRadius: 999,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.4,
        shadowRadius: 28,
      },
      android: { elevation: 18 },
    }),
  },
  glass: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: 999,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(212,175,55,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
  },
  activeGlow: {
    position: 'absolute',
    bottom: 8,
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#D4AF37',
  },
});
