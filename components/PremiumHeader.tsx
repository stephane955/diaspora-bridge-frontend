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
import type { Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Menu,
  ChevronLeft,
  Bell,
  LogOut,
  Settings,
  User,
  Wallet,
  Briefcase,
  PlusCircle,
  Bookmark,
  Store,
  HardHat,
  ScanLine,
  FileText,
} from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { mediumFeedback, lightFeedback } from '@/utils/haptics';
import { safeGoBack } from '@/utils/navigation';
import {
  ALPHA,
  DANGER_SOFT,
  GOLD,
  ICON_BUTTON_SIZE,
  icon as iconSize,
  radius,
  space,
  text,
  withAlpha,
} from '@/constants/design';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import { useLanguage } from '@/context/LanguageContext';
import { roleMenuItems } from '@/constants/premiumMenus';

export type PremiumMenuIcon =
  | 'settings'
  | 'profile'
  | 'bell'
  | 'home'
  | 'wallet'
  | 'projects'
  | 'new'
  | 'saved'
  | 'market'
  | 'cart'
  | 'requests'
  | 'scan';

export type PremiumMenuItem = {
  label: string;
  onPress: () => void;
  icon?: PremiumMenuIcon;
  destructive?: boolean;
};

type PremiumHeaderProps = {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  fallbackRoute?: Href;
  transparent?: boolean;
  accent?: string;
  menuItems?: PremiumMenuItem[];
  onNotificationsPress?: () => void;
  rightSlot?: React.ReactNode;
  /**
   * Hide the trailing avatar/menu button. Use on screens that are pure detail
   * views so the header shows only a back affordance and a title.
   */
  hideMenu?: boolean;
};

/**
 * The one header for every screen in the app.
 *
 * Renders as an absolute blur block of exactly `HEADER_BLOCK_HEIGHT` (62)
 * below the safe-area inset. Screens clear it with `useScreenOffsets().top`.
 * Never add a second header, title or back button underneath this one.
 */
export default function PremiumHeader({
  title,
  subtitle,
  showBack = false,
  fallbackRoute = '/',
  transparent = true,
  accent = GOLD,
  menuItems = [],
  onNotificationsPress,
  rightSlot,
  hideMenu = false,
}: PremiumHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut, user, role } = useAuth();
  const c = usePremiumColors();
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);

  const items = menuItems.length > 0 ? menuItems : roleMenuItems(role, router, t);
  const iconColor = c.textPrimary;
  const iconBtnFill = withAlpha(c.isDark ? '#FFFFFF' : '#0F172A', ALPHA.faint);

  const renderMenuIcon = (icon?: PremiumMenuIcon) => {
    if (!icon) return null;
    const props = { size: iconSize.sm, color: c.textSecondary };
    switch (icon) {
      case 'settings':
        return <Settings {...props} />;
      case 'profile':
        return <User {...props} />;
      case 'bell':
        return <Bell {...props} />;
      case 'home':
        return <HardHat {...props} />;
      case 'wallet':
        return <Wallet {...props} />;
      case 'projects':
        return <Briefcase {...props} />;
      case 'new':
        return <PlusCircle {...props} />;
      case 'saved':
        return <Bookmark {...props} />;
      case 'market':
        return <Store {...props} />;
      case 'cart':
      case 'scan':
        return <ScanLine {...props} />;
      case 'requests':
        return <FileText {...props} />;
      default:
        return null;
    }
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
                style={[styles.iconBtn, { backgroundColor: iconBtnFill }]}
              >
                <ChevronLeft size={iconSize.md} color={iconColor} strokeWidth={2.5} />
              </Pressable>
            ) : (
              <Pressable
                onPress={() => {
                  lightFeedback();
                  setMenuOpen(true);
                }}
                hitSlop={12}
                style={[styles.iconBtn, { backgroundColor: iconBtnFill }]}
              >
                <Menu size={iconSize.md} color={iconColor} strokeWidth={2.2} />
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
                  style={[styles.iconBtn, { backgroundColor: iconBtnFill }]}
                >
                  <Bell size={iconSize.md} color={iconColor} />
                </Pressable>
              ) : null}
              {rightSlot ??
                (hideMenu ? (
                  <View style={styles.iconBtnSpacer} />
                ) : (
                  <Pressable
                    onPress={() => {
                      lightFeedback();
                      setMenuOpen(true);
                    }}
                    hitSlop={10}
                    style={[
                      styles.iconBtn,
                      styles.avatarBtn,
                      { borderColor: accent, backgroundColor: iconBtnFill },
                    ]}
                  >
                    <User size={iconSize.sm} color={accent} />
                  </Pressable>
                ))}
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
                  paddingBottom: insets.bottom + space.xl - space.xxs,
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
                    closeMenu();
                    item.onPress();
                  }}
                  style={styles.menuRow}
                  hitSlop={6}
                >
                  <View style={styles.menuRowInner}>
                    <View style={styles.menuIconWrap}>{renderMenuIcon(item.icon)}</View>
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
                  <View style={styles.menuIconWrap}>
                    <LogOut size={iconSize.sm} color={DANGER_SOFT} />
                  </View>
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
  // 4 + 44 + 12 + 2 (accent line) = HEADER_BLOCK_HEIGHT (62)
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingTop: space.xxs,
    paddingBottom: space.sm,
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: space.xs,
  },
  title: text.subtitle,
  subtitle: {
    ...text.caption,
    marginTop: 2,
  },
  rightActions: {
    flexDirection: 'row',
    gap: space.xs,
  },
  iconBtn: {
    width: ICON_BUTTON_SIZE,
    height: ICON_BUTTON_SIZE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Keeps the title optically centred when the trailing button is hidden. */
  iconBtnSpacer: {
    width: ICON_BUTTON_SIZE,
    height: ICON_BUTTON_SIZE,
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
    backgroundColor: withAlpha('#000000', ALPHA.scrim),
  },
  menuSheet: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    borderTopWidth: 1,
  },
  menuHandle: {
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    alignSelf: 'center',
    marginBottom: space.md,
  },
  menuLabel: text.label,
  menuUser: {
    ...text.subtitle,
    marginTop: space.xxs,
    marginBottom: space.xs,
  },
  menuRow: {
    paddingVertical: space.sm + 2,
    minHeight: 48,
    justifyContent: 'center',
  },
  menuRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  menuIconWrap: {
    width: iconSize.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemText: text.body,
  menuItemDestructive: {
    color: DANGER_SOFT,
    fontWeight: '800',
  },
  menuDivider: {
    height: 1,
    marginVertical: space.sm,
  },
});
