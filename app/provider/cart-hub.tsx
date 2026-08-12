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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { providerMenuItems } from '@/constants/premiumMenus';
import { supabase } from '@/lib/supabase';
import {
  SCROLL_BOTTOM_INSET,
  PREMIUM_BG,
  PREMIUM_GOLD,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/constants/layout';
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
    color: '#FBBF24',
    bg: 'rgba(251,191,36,0.15)',
  },
  approved: { label: 'Approved', color: '#34D399', bg: 'rgba(52,211,153,0.15)' },
  collected: { label: 'Collected', color: '#60A5FA', bg: 'rgba(96,165,250,0.15)' },
  rejected: { label: 'Rejected', color: '#F87171', bg: 'rgba(248,113,113,0.15)' },
};

export default function CartHubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      colors: ['#10B981', '#059669'] as [string, string],
      onPress: openCreateCart,
    },
    {
      key: 'scan',
      title: t('scanQR'),
      subtitle: t('scanQRSub'),
      icon: ScanLine,
      colors: ['#2563EB', '#1D4ED8'] as [string, string],
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
      colors: ['#D4AF37', '#B8860B'] as [string, string],
      onPress: openTakePhoto,
    },
  ];

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <PremiumHeader
        title={t('cartHubTitle')}
        subtitle={t('cartHubQuickActionsSub')}
        menuItems={providerMenuItems(router, t)}
      />

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 88,
          paddingHorizontal: 20,
          paddingBottom: SCROLL_BOTTOM_INSET,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={PREMIUM_GOLD}
          />
        }
      >
        <Text style={styles.heroTitle}>{t('cartHubQuickActions')}</Text>
        <Text style={styles.heroSub}>{t('cartHubQuickActionsSub')}</Text>

        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <TouchableOpacity key={action.key} activeOpacity={0.92} onPress={action.onPress}>
              <BlurView intensity={40} tint="dark" style={styles.actionCard}>
                <LinearGradient colors={action.colors} style={styles.actionIcon}>
                  <Icon size={26} color="#fff" strokeWidth={2.2} />
                </LinearGradient>
                <View style={styles.actionCopy}>
                  <Text style={styles.actionTitle}>{action.title}</Text>
                  <Text style={styles.actionSub}>{action.subtitle}</Text>
                </View>
                <ChevronRight size={22} color={PREMIUM_GOLD} />
              </BlurView>
            </TouchableOpacity>
          );
        })}

        <Text style={styles.sectionTitle}>{t('recentCarts') || 'Recent carts'}</Text>

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
                <BlurView intensity={32} tint="dark" style={styles.cartRow}>
                  <View style={[styles.cartIcon, { backgroundColor: meta.bg }]}>
                    <Ionicons name="cart" size={20} color={meta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cartTitle} numberOfLines={1}>
                      {cart.projects?.title || t('materialCartTitle') || 'Material cart'}
                    </Text>
                    <Text style={styles.cartMeta}>
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
  screen: { flex: 1, backgroundColor: PREMIUM_BG },
  heroTitle: {
    color: TEXT_PRIMARY,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroSub: {
    color: TEXT_SECONDARY,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(17,24,39,0.6)',
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCopy: { flex: 1, gap: 4 },
  actionTitle: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: '800' },
  actionSub: { color: TEXT_SECONDARY, fontSize: 13, lineHeight: 18 },
  sectionTitle: {
    marginTop: 8,
    color: TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '800',
  },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(17,24,39,0.65)',
  },
  cartIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartTitle: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '700' },
  cartMeta: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '800' },
});
