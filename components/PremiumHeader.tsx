import React, { useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Text,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Menu, ChevronLeft, Bell, LogOut, Settings, User } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { mediumFeedback, lightFeedback } from '@/utils/haptics';
import { safeGoBack } from '@/utils/navigation';
import { PREMIUM_GOLD } from '@/constants/layout';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import { useLanguage } from '@/context/LanguageContext';

export type PremiumMenuItem = {
  label: string;
  onPress: () => void;
  icon?: 'settings' | 'profile' | 'bell';
  destructive?: boolean;
};

type PremiumHeaderProps = {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  fallbackRoute?: string;
  transparent?: boolean;
  accent?: string;
  menuItems?: PremiumMenuItem[];
  onNotificationsPress?: () => void;
  rightSlot?: React.ReactNode;
};

export default function PremiumHeader({
  title,
  subtitle,
  showBack = false,
  fallbackRoute = '/',
  transparent = true,
  accent = PREMIUM_GOLD,
  menuItems = [],
  onNotificationsPress,
  rightSlot,
}: PremiumHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut, user } = useAuth();
  const c = usePremiumColors();
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);

  const defaultItems: PremiumMenuItem[] = [
    {
      label: t('tabProfile'),
      icon: 'profile',
      onPress: () => {
        setMenuOpen(false);
        router.push('/diaspora/profile');
      },
    },
    {
      label: t('settingsTitle'),
      icon: 'settings',
      onPress: () => {
        setMenuOpen(false);
        router.push('/diaspora/settings');
      },
    },
  ];

  const items = menuItems.length > 0 ? menuItems : defaultItems;
  const iconColor = c.textPrimary;

  const renderMenuIcon = (icon?: PremiumMenuItem['icon']) => {
    const size = 20;
    if (icon === 'settings') return <Settings size={size} color={c.textSecondary} />;
    if (icon === 'bell') return <Bell size={size} color={c.textSecondary} />;
    return <User size={size} color={c.textSecondary} />;
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <View
        style={[styles.wrapper, { paddingTop: insets.top }]}
        pointerEvents="box-none"
      >
        <BlurView
          intensity={transparent ? 55 : 90}
          tint={c.blurTint}
          style={[
            styles.blur,
            !transparent && { backgroundColor: c.glassStrong },
            { borderBottomColor: c.border },
          ]}
        >
          <View style={styles.row}>
            {showBack ? (
              <Pressable
                onPress={() => {
                  mediumFeedback();
                  safeGoBack(router, fallbackRoute);
                }}
                hitSlop={12}
                style={[styles.iconBtn, { backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' }]}
              >
                <ChevronLeft size={22} color={iconColor} strokeWidth={2.5} />
              </Pressable>
            ) : (
              <Pressable
                onPress={() => {
                  lightFeedback();
                  setMenuOpen(true);
                }}
                hitSlop={12}
                style={[styles.iconBtn, { backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' }]}
              >
                <Menu size={20} color={iconColor} strokeWidth={2.2} />
              </Pressable>
            )}

            <View style={styles.titleWrap}>
              {title ? (
                <Text style={[styles.title, { color: c.textPrimary }]} numberOfLines={1}>
                  {title}
                </Text>
              ) : null}
              {subtitle ? (
                <Text style={[styles.subtitle, { color: c.textSecondary }]} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>

            <View style={styles.rightActions}>
              {onNotificationsPress ? (
                <Pressable
                  onPress={() => {
                    lightFeedback();
                    onNotificationsPress();
                  }}
                  hitSlop={10}
                  style={[styles.iconBtn, { backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' }]}
                >
                  <Bell size={20} color={iconColor} />
                </Pressable>
              ) : null}
              {rightSlot ?? (
                <Pressable
                  onPress={() => {
                    lightFeedback();
                    setMenuOpen(true);
                  }}
                  hitSlop={10}
                  style={[
                    styles.iconBtn,
                    styles.avatarBtn,
                    {
                      borderColor: accent,
                      backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
                    },
                  ]}
                >
                  <User size={18} color={accent} />
                </Pressable>
              )}
            </View>
          </View>
          <View style={[styles.accentLine, { backgroundColor: accent }]} />
        </BlurView>
      </View>

      <Modal
        visible={menuOpen}
        transparent
        animationType="slide"
        onRequestClose={closeMenu}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeMenu}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View
              style={[
                styles.menuSheet,
                {
                  paddingBottom: insets.bottom + 24,
                  backgroundColor: c.surface,
                  borderColor: c.border,
                },
              ]}
            >
              <View style={[styles.menuHandle, { backgroundColor: c.muted }]} />
              <Text style={[styles.menuLabel, { color: c.muted }]}>{t('menuTitle')}</Text>
              <Text style={[styles.menuUser, { color: c.textPrimary }]}>
                {user?.email?.split('@')[0] ?? 'Account'}
              </Text>

              {items.map((item) => (
                <Pressable
                  key={item.label}
                  onPress={() => {
                    lightFeedback();
                    item.onPress();
                  }}
                  style={styles.menuRow}
                  hitSlop={6}
                >
                  <View style={styles.menuRowInner}>
                    {renderMenuIcon(item.icon)}
                    <Text
                      style={[
                        styles.menuItemText,
                        { color: c.textPrimary },
                        item.destructive && styles.menuItemDestructive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                </Pressable>
              ))}

              <View style={[styles.menuDivider, { backgroundColor: c.border }]} />

              <Pressable
                onPress={async () => {
                  mediumFeedback();
                  closeMenu();
                  await signOut();
                }}
                style={styles.menuRow}
                hitSlop={6}
              >
                <View style={styles.menuRowInner}>
                  <LogOut size={20} color="#F87171" />
                  <Text style={[styles.menuItemText, styles.menuItemDestructive]}>
                    {t('signOut')}
                  </Text>
                </View>
              </Pressable>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  blur: {
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 4,
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  rightActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBtn: {
    borderWidth: 1.5,
  },
  accentLine: {
    height: 2,
    opacity: 0.35,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  menuSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  menuHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  menuLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  menuUser: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
    marginBottom: 8,
  },
  menuRow: {
    paddingVertical: 14,
    minHeight: 48,
    justifyContent: 'center',
  },
  menuRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '600',
  },
  menuItemDestructive: {
    color: '#F87171',
    fontWeight: '700',
  },
  menuDivider: {
    height: 1,
    marginVertical: 12,
  },
});
