import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ShoppingCart, ScanLine, Camera, ChevronRight } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import PremiumHeader from '@/components/PremiumHeader';
import PremiumEmptyState from '@/components/PremiumEmptyState';
import ScreenLoader from '@/components/ScreenLoader';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { providerMenuItems } from '@/constants/premiumMenus';
import { supabase } from '@/lib/supabase';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import { useScreenOffsets } from '@/hooks/useScreenOffsets';
import {
  ALPHA,
  DANGER,
  DANGER_SOFT,
  GOLD,
  GOLD_DEEP,
  INFO,
  INFO_SOFT,
  SUCCESS,
  SUCCESS_DEEP,
  WARNING,
  font,
  icon as iconSize,
  radius,
  space,
  text,
  weight,
  withAlpha,
} from '@/constants/design';
import { successFeedback } from '@/utils/haptics';

type CartRow = {
  id: string;
  status: string;
  payment_status: string;
  total_amount_cfa: number;
  created_at: string;
  project_id: string;
  projects?: { title?: string } | null;
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending_approval: {
    label: 'Pending',
    color: WARNING,
    bg: withAlpha(WARNING, ALPHA.medium),
  },
  approved: { label: 'Approved', color: SUCCESS, bg: withAlpha(SUCCESS, ALPHA.medium) },
  collected: { label: 'Collected', color: INFO_SOFT, bg: withAlpha(INFO_SOFT, ALPHA.medium) },
  rejected: { label: 'Rejected', color: DANGER_SOFT, bg: withAlpha(DANGER, ALPHA.medium) },
};

export default function CartHubScreen() {
  const router = useRouter();
  const offsets = useScreenOffsets();
  const c = usePremiumColors();
  const { t } = useLanguage();
  const { user } = useAuth();

  const [carts, setCarts] = useState<CartRow[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [{ data: cartData }, { data: projects }] = await Promise.all([
        supabase
          .from('project_material_carts')
          .select('id, status, payment_status, total_amount_cfa, created_at, project_id, projects(title)')
          .eq('provider_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('projects')
          .select('id, title')
          .eq('assigned_provider_id', user.id)
          .in('status', ['in_progress', 'In Progress'])
          .order('updated_at', { ascending: false })
          .limit(1),
      ]);
      setCarts((cartData as any) ?? []);
      setActiveProjectId(projects?.[0]?.id ?? null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openCreateCart = () => {
    successFeedback();
    if (activeProjectId) {
      router.push({
        pathname: '/provider/material-cart',
        params: { projectId: activeProjectId },
      });
      return;
    }
    Alert.alert(
      t('noActiveJobs') || 'No active site',
      t('createCartHint') ||
        'Win or open an active site first, then create a material cart from the workroom.',
      [
        { text: t('cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('tabActive') || 'Active Sites',
          onPress: () => router.push('/provider/active'),
        },
      ],
    );
  };

  const openTakePhoto = () => {
    successFeedback();
    if (activeProjectId) {
      router.push(`/workroom/${activeProjectId}`);
      return;
    }
    router.push('/provider/active');
  };

  const ACTIONS = [
    {
      key: 'cart',
      title: t('createCart'),
      subtitle: t('createCartSub'),
      icon: ShoppingCart,
      colors: [SUCCESS, SUCCESS_DEEP] as [string, string],
      onPress: openCreateCart,
    },
    {
      key: 'scan',
      title: t('scanQR'),
      subtitle: t('scanQRSub'),
      icon: ScanLine,
      colors: [INFO, INFO] as [string, string],
      onPress: () => {
        successFeedback();
        router.push('/provider/verification-scan?type=front');
      },
    },
    {
      key: 'photo',
      title: t('takePhoto'),
      subtitle: t('takePhotoSub'),
      icon: Camera,
      colors: [GOLD, GOLD_DEEP] as [string, string],
      onPress: openTakePhoto,
    },
  ];

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        <StatusBar barStyle={c.isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <PremiumHeader
          title={t('cartHubTitle')}
          subtitle={t('cartHubQuickActionsSub')}
          menuItems={providerMenuItems(router, t)}
        onNotificationsPress={() => router.push('/notifications')}
        />
        <ScreenLoader />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <StatusBar barStyle={c.isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <PremiumHeader
        title={t('cartHubTitle')}
        subtitle={t('cartHubQuickActionsSub')}
        menuItems={providerMenuItems(router, t)}
        onNotificationsPress={() => router.push('/notifications')}
      />

      <ScrollView
        contentContainerStyle={[offsets.content, { gap: space.md }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={GOLD}
          />
        }
      >
        <Text style={[styles.heroTitle, { color: c.textPrimary }]}>{t('cartHubQuickActions')}</Text>
        <Text style={[styles.heroSub, { color: c.textSecondary }]}>{t('cartHubQuickActionsSub')}</Text>

        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <TouchableOpacity key={action.key} activeOpacity={0.92} onPress={action.onPress}>
              <BlurView
                intensity={40}
                tint={c.blurTint}
                style={[styles.actionCard, { backgroundColor: c.surface, borderColor: c.border }]}
              >
                <LinearGradient colors={action.colors} style={styles.actionIcon}>
                  <Icon size={iconSize.md} color="#FFFFFF" strokeWidth={2.2} />
                </LinearGradient>
                <View style={styles.actionCopy}>
                  <Text style={[styles.actionTitle, { color: c.textPrimary }]}>{action.title}</Text>
                  <Text style={[styles.actionSub, { color: c.textSecondary }]}>{action.subtitle}</Text>
                </View>
                <ChevronRight size={iconSize.md} color={GOLD} />
              </BlurView>
            </TouchableOpacity>
          );
        })}

        <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>{t('recentCarts') || 'Recent carts'}</Text>

        {!loading && carts.length === 0 ? (
          <PremiumEmptyState
            icon="cart-outline"
            title={t('noMaterialCarts') ?? 'No carts in progress'}
            subtitle={
              t('createCartHint') ??
              'Open an active site, then create a material cart to escrow supplies.'
            }
            actionLabel={t('createCart') ?? 'Create Cart'}
            onAction={openCreateCart}
          />
        ) : (
          carts.map((cart) => {
            const meta = STATUS_META[cart.status] ?? STATUS_META.pending_approval;
            return (
              <TouchableOpacity
                key={cart.id}
                activeOpacity={0.9}
                onPress={() => {
                  successFeedback();
                  router.push({
                    pathname: '/provider/material-cart',
                    params: { projectId: cart.project_id },
                  });
                }}
              >
                <BlurView
                  intensity={32}
                  tint={c.blurTint}
                  style={[styles.cartRow, { backgroundColor: c.surface, borderColor: c.border }]}
                >
                  <View style={[styles.cartIcon, { backgroundColor: meta.bg }]}>
                    <Ionicons name="cart" size={iconSize.sm} color={meta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cartTitle, { color: c.textPrimary }]} numberOfLines={1}>
                      {cart.projects?.title || t('materialCartTitle') || 'Material cart'}
                    </Text>
                    <Text style={[styles.cartMeta, { color: c.textSecondary }]}>
                      {Number(cart.total_amount_cfa || 0).toLocaleString()} CFA ·{' '}
                      {new Date(cart.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </BlurView>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  heroTitle: {
    fontSize: font.displayLg,
    fontWeight: weight.heavy,
    letterSpacing: -0.5,
  },
  heroSub: {
    ...text.footnote,
    lineHeight: 22,
    marginBottom: space.xs,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCopy: { flex: 1, gap: space.xxs },
  actionTitle: text.subtitle,
  actionSub: { ...text.caption, lineHeight: 18 },
  sectionTitle: {
    ...text.subtitle,
    marginTop: space.xs,
  },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
  },
  cartIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartTitle: { ...text.footnote, fontWeight: weight.heavy },
  cartMeta: { ...text.caption, marginTop: 2 },
  badge: { paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.pill },
  badgeText: { fontSize: font.micro, fontWeight: weight.heavy },
});
