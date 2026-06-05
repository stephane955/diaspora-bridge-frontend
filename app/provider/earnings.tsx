import React, { useState, useCallback, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    RefreshControl, StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import PremiumHeader from '@/components/PremiumHeader';
import PulseLoader from '@/components/PulseLoader';
import { providerMenuItems } from '@/constants/premiumMenus';
import { theme } from '@/constants/theme';
import { successFeedback, mediumFeedback } from '@/utils/haptics';
import { FLOATING_TAB_BAR_HEIGHT, PREMIUM_BG, PREMIUM_MUTED } from '@/constants/layout';

type Transaction = {
    id: string;
    amount: number;
    description: string;
    created_at: string;
    type: 'deposit' | 'withdrawal' | 'escrow_release';
    projects?: { title: string } | null;
};

export default function ProviderEarningsScreen() {
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const router = useRouter();
    const { t } = useLanguage();

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchEarnings = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*, projects(title)')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) {
                setTransactions(data as any);
                const total = data.reduce((acc, curr) => acc + Number(curr.amount), 0);
                setBalance(total);
            }
        } catch (err) {
            console.error("Error fetching earnings:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user]);

    useFocusEffect(useCallback(() => { fetchEarnings(); }, [fetchEarnings]));

    // Live: when client releases escrow, project_expenses or transactions get new rows for this provider — refetch
    useEffect(() => {
        if (!user?.id) return;
        const channel = supabase
            .channel(`earnings:${user.id}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'project_expenses', filter: `provider_id=eq.${user.id}` },
                () => { fetchEarnings(); }
            )
            .subscribe();
        return () => supabase.removeChannel(channel);
    }, [user?.id, fetchEarnings]);

    if (loading) {
        return (
            <View style={styles.screen}>
                <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
                <PremiumHeader
                    title={t('walletTitle')}
                    subtitle={t('history')}
                    showBack
                    fallbackRoute="/provider/active"
                    menuItems={providerMenuItems(router, t)}
                />
                <View style={styles.center}>
                    <PulseLoader color={theme.colors.emerald} />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <PremiumHeader
                title={t('walletTitle')}
                subtitle={t('history')}
                showBack
                fallbackRoute="/provider/active"
                menuItems={providerMenuItems(router, t)}
            />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 88, paddingBottom: FLOATING_TAB_BAR_HEIGHT + 32 }]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEarnings(); }} tintColor="#D4AF37" />}
            >
                {/* Mesh Gradient Balance Card */}
                <LinearGradient
                    colors={[theme.colors.emerald, '#059669', '#047857']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.balanceCard}
                >
                    <View style={styles.cardPattern}>
                        <View style={[styles.patternCircle, { top: -30, right: -10 }]} />
                        <View style={[styles.patternCircle, { bottom: -20, left: -20, width: 100, height: 100 }]} />
                    </View>

                    <Text style={styles.balanceLabel}>{t('totalBalance') || "TOTAL BALANCE"}</Text>
                    <Text style={styles.balanceValue}>{balance.toLocaleString()} CFA</Text>

                    <View style={styles.cardActions}>
                        <TouchableOpacity
                            style={styles.cardBtn}
                            onPress={() => { successFeedback(); router.push('/provider/withdraw'); }}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="arrow-up-circle" size={18} color={theme.colors.emerald} />
                            <Text style={styles.cardBtnText}>{t('withdraw') || "Withdraw"}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.cardBtn}
                            onPress={() => { mediumFeedback(); router.push('/provider/payout-setup'); }}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="card-outline" size={18} color={theme.colors.emerald} />
                            <Text style={styles.cardBtnText}>{t('payoutSetupBtn')}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Mini Chart */}
                    <View style={styles.chartContainer}>
                        {[30, 50, 40, 70, 50, 80, 60, 90, 40].map((h, i) => (
                            <View key={i} style={styles.chartBarWrapper}>
                                <View style={[styles.chartBar, { height: `${h}%`, opacity: i === 7 ? 1 : 0.35 }]} />
                            </View>
                        ))}
                    </View>
                </LinearGradient>

                {/* Transaction History */}
                <Text style={styles.sectionTitle}>{t('history') || "Transaction History"}</Text>

                {transactions.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="wallet-outline" size={56} color={theme.colors.border} />
                        <Text style={styles.emptyTitle}>{t('noEarnings') || "No earnings yet"}</Text>
                        <Text style={styles.emptySub}>{t('completeJobs') || "Complete jobs to see transactions."}</Text>
                        <TouchableOpacity
                            style={styles.emptyBtn}
                            onPress={() => { mediumFeedback(); router.push('/provider/market'); }}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.emptyBtnText}>{t('browseJobs')}</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    transactions.map((txn) => {
                        const isIncome = txn.amount > 0;
                        return (
                            <View key={txn.id} style={styles.card}>
                                <View style={[styles.iconBox, isIncome ? styles.bgGreen : styles.bgRed]}>
                                    <Ionicons
                                        name={isIncome ? "arrow-down" : "arrow-up"}
                                        size={20}
                                        color={isIncome ? theme.colors.success : theme.colors.danger}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.cardTitle}>
                                        {txn.projects?.title || txn.description || "Transaction"}
                                    </Text>
                                    <Text style={styles.cardDate}>
                                        {new Date(txn.created_at).toLocaleDateString(undefined, {
                                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                        })}
                                    </Text>
                                </View>
                                <Text style={[styles.amount, isIncome ? styles.textGreen : styles.textRed]}>
                                    {isIncome ? "+" : ""}{Number(txn.amount).toLocaleString()}
                                </Text>
                            </View>
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
    scrollContent: { paddingHorizontal: theme.spacing.lg },

    balanceCard: {
        borderRadius: theme.radii.xl,
        padding: 24,
        marginBottom: 28,
        overflow: 'hidden',
        shadowColor: theme.colors.emerald,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    cardPattern: { ...StyleSheet.absoluteFillObject },
    patternCircle: {
        position: 'absolute',
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    balanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, ...theme.typography.label, marginBottom: 4 },
    balanceValue: { color: '#fff', fontSize: 36, ...theme.typography.title },

    cardActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
        marginBottom: 20,
    },
    cardBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: theme.radii.pill,
    },
    cardBtnText: { color: theme.colors.text, fontWeight: '800', fontSize: 13 },

    chartContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 40 },
    chartBarWrapper: { height: '100%', justifyContent: 'flex-end', width: 6 },
    chartBar: { width: '100%', backgroundColor: '#fff', borderRadius: 3 },

    sectionTitle: { fontSize: 18, ...theme.typography.title, color: theme.colors.text, marginBottom: theme.spacing.md },

    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.md,
        borderRadius: theme.radii.md,
        marginBottom: theme.spacing.sm,
        gap: theme.spacing.md,
        ...theme.shadow.soft,
        shadowOpacity: 0.05,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
    },
    iconBox: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    bgGreen: { backgroundColor: theme.colors.success + '20' },
    bgRed: { backgroundColor: theme.colors.danger + '15' },

    cardTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
    cardDate: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
    amount: { fontSize: 16, fontWeight: '700' },
    textGreen: { color: theme.colors.success },
    textRed: { color: theme.colors.danger },

    emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
    emptyTitle: { fontSize: 18, ...theme.typography.title, color: theme.colors.text },
    emptySub: { color: theme.colors.textMuted, fontSize: 14 },
    emptyBtn: {
        marginTop: 16,
        backgroundColor: theme.colors.emerald,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: theme.radii.pill,
    },
    emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
