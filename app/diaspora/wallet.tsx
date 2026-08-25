import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    StatusBar,
    Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { CheckCircle, Lock, Plus } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { YStack, XStack, Text as TamaguiText } from 'tamagui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import PremiumHeader from '@/components/PremiumHeader';
import { clientMenuItems } from '@/constants/premiumMenus';
import PulseLoader from '@/components/PulseLoader';
import VaultGate from '@/components/VaultGate';
import { successFeedback } from '@/utils/haptics';
import {
    FLOATING_TAB_BAR_HEIGHT,
    PREMIUM_BG,
    PREMIUM_GOLD,
    PREMIUM_MUTED,
} from '@/constants/layout';

type MaterialCartRow = {
    id: string;
    project_id: string;
    status: string;
    total_amount_cfa: number;
    labor_amount_cfa?: number | null;
    created_at: string;
    supplier_id?: string | null;
    projects?: { title?: string | null } | null;
    supplier?: { full_name?: string | null } | null;
};

function cartTotalCfa(cart: MaterialCartRow) {
    return Number(cart.total_amount_cfa ?? 0) + Number(cart.labor_amount_cfa ?? 0);
}

function statusLabel(status: string, t: (key: string) => string) {
    if (status === 'pending_approval') return t('pendingApprovalStatus');
    if (status === 'approved') return t('fundedInEscrowStatus');
    if (status === 'collected') return t('collectedStatus');
    return status.replace('_', ' ');
}

function statusColor(status: string) {
    if (status === 'pending_approval') return PREMIUM_GOLD;
    if (status === 'approved') return '#60A5FA';
    return PREMIUM_MUTED;
}

export default function ClientWalletScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { user } = useAuth();
    const { t } = useLanguage();

    const [transactions, setTransactions] = useState<any[]>([]);
    const [balance, setBalance] = useState(0);
    const [escrowed, setEscrowed] = useState(0);
    const [materialCarts, setMaterialCarts] = useState<MaterialCartRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                setTransactions(data);
                const total = data.reduce((acc: number, curr: any) => acc + Number(curr.amount), 0);
                setBalance(total);
            }

            const { data: milestones } = await supabase
                .from('milestones')
                .select('amount, status, projects!inner(owner_id)')
                .eq('projects.owner_id', user.id)
                .eq('status', 'locked');

            const lockedTotal = milestones?.reduce((acc: number, curr: any) => acc + Number(curr.amount), 0) || 0;
            setEscrowed(lockedTotal);

            const { data: ownedProjects } = await supabase
                .from('projects')
                .select('id')
                .eq('owner_id', user.id);

            const projectIds = ownedProjects?.map((p) => p.id) ?? [];
            if (projectIds.length > 0) {
                const { data: carts } = await supabase
                    .from('project_material_carts')
                    .select('id, project_id, status, total_amount_cfa, labor_amount_cfa, created_at, supplier_id, projects(title)')
                    .in('project_id', projectIds)
                    .order('created_at', { ascending: false });

                const rows = (carts ?? []) as MaterialCartRow[];
                const supplierIds = [...new Set(rows.map((c) => c.supplier_id).filter(Boolean))] as string[];
                let supplierMap: Record<string, string> = {};
                if (supplierIds.length > 0) {
                    const { data: suppliers } = await supabase
                        .from('profiles')
                        .select('id, full_name')
                        .in('id', supplierIds);
                    supplierMap = Object.fromEntries(
                        (suppliers ?? []).map((s) => [s.id, s.full_name ?? t('supplierFallback')])
                    );
                }
                setMaterialCarts(
                    rows.map((cart) => ({
                        ...cart,
                        supplier: cart.supplier_id
                            ? { full_name: supplierMap[cart.supplier_id] ?? null }
                            : null,
                    }))
                );
            } else {
                setMaterialCarts([]);
            }
        } catch (err) {
            console.error('Client Wallet Error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user, t]);

    useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

    const handleTopUp = () => {
        successFeedback();
        Alert.alert(t('addFunds'), t('addFundsStripeBody'));
    };

    const activeCarts = materialCarts.filter((c) =>
        c.status === 'pending_approval' || c.status === 'approved'
    );
    const collectedCarts = materialCarts.filter((c) => c.status === 'collected');

    const walletContent = loading ? (
        <View style={styles.loaderWrap}>
            <PulseLoader />
        </View>
    ) : (
        <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
                styles.scrollContent,
                { paddingTop: insets.top + 88, paddingBottom: FLOATING_TAB_BAR_HEIGHT + 40 },
            ]}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => { setRefreshing(true); fetchData(); }}
                    tintColor={PREMIUM_GOLD}
                />
            }
        >
            {/* Black card — total escrow */}
            <View style={styles.cardGlowWrap}>
                <BlurView intensity={45} tint="dark" style={styles.cardGlow} />
                <LinearGradient
                    colors={['#1E293B', '#0F172A', '#050810']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.escrowCard}
                >
                    <View style={styles.cardShine} />
                    <View style={styles.cardChipRow}>
                        <View style={styles.chip} />
                        <TouchableOpacity style={styles.topUpPill} onPress={handleTopUp} activeOpacity={0.85}>
                            <Plus size={14} color={PREMIUM_GOLD} strokeWidth={2.5} />
                            <Text style={styles.topUpPillText}>{t('topUp')}</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.cardEyebrow}>{t('totalFundsInEscrow')}</Text>
                    <Text style={styles.cardBalance}>{escrowed.toLocaleString()} CFA</Text>

                    <View style={styles.cardFooter}>
                        <XStack alignItems="center" gap={6}>
                            <Lock size={14} color="rgba(255,255,255,0.55)" />
                            <TamaguiText color="rgba(255,255,255,0.55)" fontSize={13} fontWeight="600">
                                {t('availableWalletBalance')}
                            </TamaguiText>
                        </XStack>
                        <Text style={styles.cardSubBalance}>{balance.toLocaleString()} CFA</Text>
                    </View>
                </LinearGradient>
            </View>

            {/* Active material carts */}
            <YStack marginTop={28} marginBottom={8}>
                <TamaguiText color="#F8FAFC" fontSize={20} fontWeight="800" letterSpacing={-0.3} marginBottom={14}>
                    {t('activeMaterialCarts')}
                </TamaguiText>

                {activeCarts.length === 0 ? (
                    <View style={styles.emptyCartStrip}>
                        <TamaguiText color={PREMIUM_MUTED} fontSize={14}>
                            {t('noCartsAwaiting')}
                        </TamaguiText>
                    </View>
                ) : (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.cartScrollRow}
                        decelerationRate="fast"
                    >
                        {activeCarts.map((cart) => (
                            <TouchableOpacity
                                key={cart.id}
                                activeOpacity={0.92}
                                onPress={() => router.push(`/diaspora/project/${cart.project_id}`)}
                                style={styles.cartCard}
                            >
                                <Text style={styles.cartProject} numberOfLines={1}>
                                    {cart.projects?.title ?? t('projectFallback')}
                                </Text>
                                <Text style={[styles.cartStatus, { color: statusColor(cart.status) }]}>
                                    {statusLabel(cart.status, t)}
                                </Text>
                                <Text style={styles.cartAmount}>
                                    {cartTotalCfa(cart).toLocaleString()} CFA
                                </Text>
                                <Text style={styles.cartDate}>
                                    {new Date(cart.created_at).toLocaleDateString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                    })}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}
            </YStack>

            {/* Completed handovers */}
            <YStack marginTop={24}>
                <TamaguiText color="#F8FAFC" fontSize={20} fontWeight="800" letterSpacing={-0.3} marginBottom={14}>
                    {t('completedHandovers')}
                </TamaguiText>

                {collectedCarts.length === 0 ? (
                    <View style={styles.emptyHistory}>
                        <CheckCircle size={36} color="#94A3B8" />
                        <Text style={styles.emptyHistoryTitle}>{t('noCompletedHandovers')}</Text>
                        <Text style={styles.emptyHistorySub}>
                            When suppliers scan QR codes and collect materials, they appear here.
                        </Text>
                    </View>
                ) : (
                    <YStack gap={0}>
                        {collectedCarts.map((cart) => (
                            <TouchableOpacity
                                key={cart.id}
                                style={styles.statementRow}
                                activeOpacity={0.85}
                                onPress={() => router.push(`/diaspora/project/${cart.project_id}`)}
                            >
                                <View style={styles.statementIconWrap}>
                                    <CheckCircle size={20} color="#34D399" strokeWidth={2.2} />
                                </View>
                                <View style={styles.statementBody}>
                                    <Text style={styles.statementTitle} numberOfLines={1}>
                                        {cart.supplier?.full_name ?? cart.projects?.title ?? t('supplierFallback')}
                                    </Text>
                                    <Text style={styles.statementSub}>
                                        {new Date(cart.created_at).toLocaleDateString(undefined, {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                        })}
                                    </Text>
                                </View>
                                <Text style={styles.statementAmount}>
                                    {cartTotalCfa(cart).toLocaleString()} CFA
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </YStack>
                )}
            </YStack>

            {/* Legacy transaction history (unchanged data) */}
            {transactions.length > 0 && (
                <YStack marginTop={28}>
                    <TamaguiText color="#F8FAFC" fontSize={20} fontWeight="800" letterSpacing={-0.3} marginBottom={14}>
                        Wallet Activity
                    </TamaguiText>
                    <YStack gap={0}>
                        {transactions.map((txn) => (
                            <View key={txn.id} style={styles.statementRow}>
                                <View style={[
                                    styles.statementIconWrap,
                                    { backgroundColor: txn.amount > 0 ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.06)' },
                                ]}>
                                    <Text style={{ color: txn.amount > 0 ? '#34D399' : PREMIUM_MUTED, fontWeight: '800' }}>
                                        {txn.amount > 0 ? '+' : '−'}
                                    </Text>
                                </View>
                                <View style={styles.statementBody}>
                                    <Text style={styles.statementTitle} numberOfLines={1}>
                                        {txn.description || 'Transaction'}
                                    </Text>
                                    <Text style={styles.statementSub}>
                                        {new Date(txn.created_at).toLocaleDateString()}
                                    </Text>
                                </View>
                                <Text style={[
                                    styles.statementAmount,
                                    { color: txn.amount > 0 ? '#34D399' : '#F8FAFC' },
                                ]}>
                                    {txn.amount > 0 ? '+' : ''}{Number(txn.amount).toLocaleString()}
                                </Text>
                            </View>
                        ))}
                    </YStack>
                </YStack>
            )}
        </ScrollView>
    );

    return (
        <View style={styles.screen}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <PremiumHeader
                title={t('clientDashboard.myWallet') ?? 'Escrow'}
                subtitle="Funds & material carts"
                menuItems={clientMenuItems(router, t)}
            />
            <VaultGate promptMessage={t('unlockWalletPrompt')} lockOnBlur>
                {walletContent}
            </VaultGate>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: PREMIUM_BG,
    },
    loaderWrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: PREMIUM_BG,
    },
    scrollContent: {
        paddingHorizontal: 16,
    },

    cardGlowWrap: {
        position: 'relative',
        marginBottom: 4,
    },
    cardGlow: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 24,
        overflow: 'hidden',
        opacity: 0.55,
        transform: [{ scale: 1.04 }],
    },
    escrowCard: {
        borderRadius: 22,
        padding: 22,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.22)',
    },
    cardShine: {
        position: 'absolute',
        top: -40,
        right: -30,
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: 'rgba(212,175,55,0.08)',
    },
    cardChipRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 28,
    },
    chip: {
        width: 42,
        height: 30,
        borderRadius: 6,
        backgroundColor: 'rgba(212,175,55,0.35)',
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.5)',
    },
    topUpPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.35)',
    },
    topUpPillText: {
        color: PREMIUM_GOLD,
        fontSize: 12,
        fontWeight: '800',
    },
    cardEyebrow: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
    },
    cardBalance: {
        color: PREMIUM_GOLD,
        fontSize: 36,
        fontWeight: '800',
        letterSpacing: -0.5,
        marginTop: 6,
    },
    cardFooter: {
        marginTop: 22,
        paddingTop: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.1)',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cardSubBalance: {
        color: '#F8FAFC',
        fontSize: 15,
        fontWeight: '700',
    },

    cartScrollRow: {
        gap: 12,
        paddingRight: 8,
    },
    cartCard: {
        width: 200,
        padding: 16,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    cartProject: {
        color: '#F8FAFC',
        fontSize: 15,
        fontWeight: '800',
        marginBottom: 8,
    },
    cartStatus: {
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 10,
    },
    cartAmount: {
        color: '#F8FAFC',
        fontSize: 18,
        fontWeight: '800',
    },
    cartDate: {
        color: PREMIUM_MUTED,
        fontSize: 12,
        marginTop: 4,
        fontWeight: '600',
    },
    emptyCartStrip: {
        padding: 18,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.04)',
    },

    statementRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        gap: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    statementIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(52,211,153,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statementBody: {
        flex: 1,
    },
    statementTitle: {
        color: '#F8FAFC',
        fontSize: 15,
        fontWeight: '700',
    },
    statementSub: {
        color: PREMIUM_MUTED,
        fontSize: 12,
        marginTop: 2,
        fontWeight: '500',
    },
    statementAmount: {
        color: '#F8FAFC',
        fontSize: 15,
        fontWeight: '800',
    },

    emptyHistory: {
        alignItems: 'center',
        paddingVertical: 32,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 18,
        gap: 8,
    },
    emptyHistoryTitle: {
        color: '#E2E8F0',
        fontSize: 16,
        fontWeight: '700',
        marginTop: 4,
    },
    emptyHistorySub: {
        color: PREMIUM_MUTED,
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 18,
    },
});
