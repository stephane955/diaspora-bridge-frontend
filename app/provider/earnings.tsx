import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import PremiumHeader from '@/components/PremiumHeader';
import PremiumEmptyState from '@/components/PremiumEmptyState';
import PulseLoader from '@/components/PulseLoader';
import { providerMenuItems } from '@/constants/premiumMenus';
import { useScreenOffsets } from '@/hooks/useScreenOffsets';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import { successFeedback, mediumFeedback } from '@/utils/haptics';
import { fetchUserAvailableBalanceMinor } from '@/lib/ledgerBalance';
import { resolveAmountMinor } from '@/lib/money';
import { P00_BALANCE_UNAVAILABLE } from '@/constants/p00Security';
import {
  PREMIUM_BG,
  PREMIUM_GOLD,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/constants/layout';

type Transaction = {
  id: string;
  amount: number;
  description: string;
  created_at: string;
  type: 'deposit' | 'withdrawal' | 'escrow_release';
  projects?: { title: string } | null;
};

export default function ProviderEarningsScreen() {
  const offsets = useScreenOffsets();
  const c = usePremiumColors();
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [pendingEscrow, setPendingEscrow] = useState(0);
  const [inReviewCount, setInReviewCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEarnings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [balanceMinor, projectsRes] = await Promise.all([
        fetchUserAvailableBalanceMinor(),
        supabase
          .from('projects')
          .select('id')
          .eq('assigned_provider_id', user.id),
      ]);

      setBalance(balanceMinor === null ? null : Number(balanceMinor));
      setTransactions([]);

      const projectIds = (projectsRes.data ?? []).map((p) => p.id);
      if (projectIds.length > 0) {
        const { data: miles } = await supabase
          .from('milestones')
          .select('amount_minor, status')
          .in('project_id', projectIds)
          .in('status', ['in_review', 'approved']);

        const pending = (miles ?? []).reduce(
          (sum, m) => sum + Number(resolveAmountMinor(m)),
          0,
        );
        setPendingEscrow(pending);
        setInReviewCount((miles ?? []).filter((m) => m.status === 'in_review').length);
      } else {
        setPendingEscrow(0);
        setInReviewCount(0);
      }
    } catch (err) {
      console.error('Error fetching earnings:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchEarnings();
    }, [fetchEarnings]),
  );

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`earnings:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'project_expenses',
          filter: `provider_id=eq.${user.id}`,
        },
        () => {
          fetchEarnings();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchEarnings]);

  const chartBars = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      return d;
    });
    const totals = days.map((day) => {
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      return transactions
        .filter((tx) => {
          const tDate = new Date(tx.created_at);
          return tDate >= day && tDate < next && Number(tx.amount) > 0;
        })
        .reduce((s, tx) => s + Number(tx.amount), 0);
    });
    const max = Math.max(...totals, 1);
    return totals.map((v) => Math.max(8, Math.round((v / max) * 100)));
  }, [transactions]);

  if (loading) {
    return (
      <View style={styles.screen}>
        <StatusBar barStyle={c.isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <PremiumHeader
          title={t('walletTitle')}
          subtitle={t('history')}
          showBack
          fallbackRoute="/provider/active"
          menuItems={providerMenuItems(router, t)}
        />
        <View style={styles.center}>
          <PulseLoader color={PREMIUM_GOLD} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle={c.isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
      <PremiumHeader
        title={t('walletTitle')}
        subtitle={t('history')}
        showBack
        fallbackRoute="/provider/active"
        menuItems={providerMenuItems(router, t)}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: offsets.top, paddingBottom: offsets.bottom },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchEarnings();
            }}
            tintColor={PREMIUM_GOLD}
          />
        }
      >
        <BlurView intensity={50} tint="dark" style={styles.balanceCard}>
          <LinearGradient
            colors={['rgba(212,175,55,0.22)', 'rgba(16,185,129,0.12)', 'transparent']}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.balanceLabel}>
            {(t('availableBalance') || 'AVAILABLE BALANCE').toUpperCase()}
          </Text>
          <Text style={styles.balanceValue}>
            {balance === null ? P00_BALANCE_UNAVAILABLE : `${balance.toLocaleString()} CFA`}
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Text style={styles.statPillLabel}>{t('pendingEscrow') || 'Pending Escrow'}</Text>
              <Text style={styles.statPillValue}>{pendingEscrow.toLocaleString()} CFA</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statPillLabel}>{t('inReview') || 'In Review'}</Text>
              <Text style={[styles.statPillValue, { color: PREMIUM_GOLD }]}>
                {inReviewCount}
              </Text>
            </View>
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.cardBtn}
              onPress={() => {
                successFeedback();
                router.push('/provider/withdraw');
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="arrow-up-circle" size={18} color="#0A0F1A" />
              <Text style={styles.cardBtnText}>{t('withdraw') || 'Withdraw'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cardBtnGhost}
              onPress={() => {
                mediumFeedback();
                router.push('/provider/payout-setup');
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="card-outline" size={18} color={PREMIUM_GOLD} />
              <Text style={styles.cardBtnGhostText}>{t('payoutSetupBtn')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.chartLabel}>{t('last7Days') || 'Last 7 days'}</Text>
          <View style={styles.chartContainer}>
            {chartBars.map((h, i) => (
              <View key={i} style={styles.chartBarWrapper}>
                <View
                  style={[
                    styles.chartBar,
                    {
                      height: `${h}%`,
                      opacity: i === chartBars.length - 1 ? 1 : 0.4,
                      backgroundColor: i === chartBars.length - 1 ? PREMIUM_GOLD : '#94A3B8',
                    },
                  ]}
                />
              </View>
            ))}
          </View>
        </BlurView>

        <Text style={styles.sectionTitle}>{t('history') || 'Transaction History'}</Text>

        {transactions.length === 0 ? (
          <PremiumEmptyState
            icon="wallet-outline"
            title={t('noEarnings') || 'No earnings yet'}
            subtitle={
              t('completeJobs') ||
              'Complete milestones and get paid to see your history here.'
            }
            actionLabel={t('browseJobs') || 'Browse Jobs'}
            onAction={() => router.push('/provider/market')}
          />
        ) : (
          transactions.map((txn) => {
            const isIncome = txn.amount > 0;
            return (
              <BlurView key={txn.id} intensity={28} tint="dark" style={styles.card}>
                <View style={[styles.iconBox, isIncome ? styles.bgGreen : styles.bgRed]}>
                  <Ionicons
                    name={isIncome ? 'arrow-down' : 'arrow-up'}
                    size={20}
                    color={isIncome ? '#34D399' : '#F87171'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {txn.projects?.title || txn.description || 'Transaction'}
                  </Text>
                  <Text style={styles.cardDate}>
                    {new Date(txn.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <Text style={[styles.amount, isIncome ? styles.textGreen : styles.textRed]}>
                  {isIncome ? '+' : ''}
                  {Number(txn.amount).toLocaleString()}
                </Text>
              </BlurView>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PREMIUM_BG },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 20 },

  balanceCard: {
    borderRadius: 28,
    padding: 22,
    marginBottom: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    backgroundColor: 'rgba(17,24,39,0.72)',
  },
  balanceLabel: {
    color: TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  balanceValue: {
    color: TEXT_PRIMARY,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  statPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statPillLabel: {
    color: TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  statPillValue: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: '800' },

  cardActions: { flexDirection: 'row', gap: 10, marginTop: 18, marginBottom: 18 },
  cardBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: PREMIUM_GOLD,
    paddingVertical: 12,
    borderRadius: 14,
  },
  cardBtnText: { color: '#0A0F1A', fontWeight: '800', fontSize: 13 },
  cardBtnGhost: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    paddingVertical: 12,
    borderRadius: 14,
  },
  cardBtnGhostText: { color: PREMIUM_GOLD, fontWeight: '800', fontSize: 13 },

  chartLabel: {
    color: TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 48,
  },
  chartBarWrapper: { height: '100%', justifyContent: 'flex-end', width: 10 },
  chartBar: { width: '100%', borderRadius: 4 },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 14,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    marginBottom: 10,
    gap: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(17,24,39,0.65)',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgGreen: { backgroundColor: 'rgba(52,211,153,0.15)' },
  bgRed: { backgroundColor: 'rgba(248,113,113,0.15)' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY },
  cardDate: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '800' },
  textGreen: { color: '#34D399' },
  textRed: { color: '#F87171' },
});
