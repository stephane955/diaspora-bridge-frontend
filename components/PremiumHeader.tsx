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
  const [menuOpen, setMenuOpen] = useState(false);

  const defaultItems: PremiumMenuItem[] = [
    {
      label: 'Profile',
      icon: 'profile',
      onPress: () => {
        setMenuOpen(false);
        router.push('/diaspora/profile');
      },
    },
    {
      label: 'Settings',
      icon: 'settings',
      onPress: () => {
        setMenuOpen(false);
        router.push('/diaspora/settings');
      },
    },
  ];

  const items = menuItems.length > 0 ? menuItems : defaultItems;

  const renderMenuIcon = (icon?: PremiumMenuItem['icon']) => {
    const color = '#E2E8F0';
    const size = 20;
    if (icon === 'settings') return <Settings size={size} color={color} />;
    if (icon === 'bell') return <Bell size={size} color={color} />;
    return <User size={size} color={color} />;
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
          tint="dark"
          style={[styles.blur, !transparent && styles.blurSolid]}
        >
          <View style={styles.row}>
            {showBack ? (
              <Pressable
                onPress={() => {
                  mediumFeedback();
                  safeGoBack(router, fallbackRoute);
                }}
                hitSlop={10}
                style={styles.iconBtn}
              >
                <ChevronLeft size={22} color="#F8FAFC" strokeWidth={2.5} />
              </Pressable>
            ) : (
              <Pressable
                onPress={() => {
                  lightFeedback();
                  setMenuOpen(true);
                }}
                hitSlop={10}
                style={styles.iconBtn}
              >
                <Menu size={20} color="#F8FAFC" strokeWidth={2.2} />
              </Pressable>
            )}

            <View style={styles.titleWrap}>
              {title ? (
                <Text style={styles.title} numberOfLines={1}>
                  {title}
                </Text>
              ) : null}
              {subtitle ? (
                <Text style={styles.subtitle} numberOfLines={1}>
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
                  style={styles.iconBtn}
                >
                  <Bell size={20} color="#F8FAFC" />
                </Pressable>
              ) : null}
              {rightSlot ?? (
                <Pressable
                  onPress={() => {
                    lightFeedback();
                    setMenuOpen(true);
                  }}
                  style={[styles.iconBtn, styles.avatarBtn, { borderColor: accent }]}
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
            <View style={[styles.menuSheet, { paddingBottom: insets.bottom + 24 }]}>
              <View style={styles.menuHandle} />
              <Text style={styles.menuLabel}>Menu</Text>
              <Text style={styles.menuUser}>
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
                >
                  <View style={styles.menuRowInner}>
                    {renderMenuIcon(item.icon)}
                    <Text
                      style={[
                        styles.menuItemText,
                        item.destructive && styles.menuItemDestructive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                </Pressable>
              ))}

              <View style={styles.menuDivider} />

              <Pressable
                onPress={async () => {
                  mediumFeedback();
                  closeMenu();
                  await signOut();
                }}
                style={styles.menuRow}
              >
                <View style={styles.menuRowInner}>
                  <LogOut size={20} color="#F87171" />
                  <Text style={[styles.menuItemText, styles.menuItemDestructive]}>
                    Log out
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
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  blurSolid: {
    backgroundColor: 'rgba(10,15,26,0.92)',
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
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  rightActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
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
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  menuHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
    alignSelf: 'center',
    marginBottom: 16,
  },
  menuLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  menuUser: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
    marginBottom: 8,
  },
  menuRow: {
    paddingVertical: 14,
  },
  menuRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemText: {
    color: '#F1F5F9',
    fontSize: 16,
    fontWeight: '600',
  },
  menuItemDestructive: {
    color: '#F87171',
    fontWeight: '700',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#1E293B',
    marginVertical: 12,
  },
});
