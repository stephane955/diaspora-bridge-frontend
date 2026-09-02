import React, { useState, useCallback, useMemo } from 'react';
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
import ScreenLoader from '@/components/ScreenLoader';
import PremiumEmptyState from '@/components/PremiumEmptyState';
import VaultGate from '@/components/VaultGate';
import { successFeedback } from '@/utils/haptics';
import { fetchUserAvailableBalanceMinor } from '@/lib/ledgerBalance';
import { resolveAmountMinor } from '@/lib/money';
import { P00_BALANCE_UNAVAILABLE } from '@/constants/p00Security';
import { usePremiumColors, type PremiumColors } from '@/hooks/usePremiumColors';
import { useScreenOffsets } from '@/hooks/useScreenOffsets';
import {
    ALPHA,
    GOLD,
    GOLD_BORDER,
    GOLD_TINT,
    INFO_SOFT,
    NAVY,
    NAVY_SOFT,
    SUCCESS,
    font,
    icon as iconSize,
    radius,
    space,
    text,
    weight,
    withAlpha,
} from '@/constants/design';

/** Text that always sits on the dark escrow card, in both themes. */
const ON_DARK_PRIMARY = '#FFFFFF';
const ON_DARK_SECONDARY = withAlpha('#FFFFFF', 0.7);

type MaterialCartRow = {
    id: string;
    project_id: string;
    status: string;
    total_amount_cfa: number;
    created_at: string;
    supplier_id?: string | null;
    projects?: { title?: string | null } | null;
    supplier?: { full_name?: string | null } | null;
};

function cartTotalCfa(cart: MaterialCartRow) {
    return Number(cart.total_amount_cfa ?? 0);
}

function statusLabel(status: string, t: (key: string) => string) {
    if (status === 'pending_approval') return t('pendingApprovalStatus');
    if (status === 'approved') return t('fundedInEscrowStatus');
    if (status === 'collected') return t('collectedStatus');
    return status.replace('_', ' ');
}

function statusColor(status: string, c: PremiumColors) {
    if (status === 'pending_approval') return GOLD;
    if (status === 'approved') return INFO_SOFT;
    return c.muted;
}

export default function ClientWalletScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { t } = useLanguage();
    const c = usePremiumColors();
    const offsets = useScreenOffsets();
    const styles = useMemo(() => createStyles(c), [c]);

    const [transactions, setTransactions] = useState<any[]>([]);
    const [balance, setBalance] = useState<number | null>(null);
    const [escrowed, setEscrowed] = useState(0);
    const [materialCarts, setMaterialCarts] = useState<MaterialCartRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async () => {
        if (!user) return;
        try {
            const balanceMinor = await fetchUserAvailableBalanceMinor();
            setBalance(balanceMinor === null ? null : Number(balanceMinor));
            setTransactions([]);

            const { data: milestones } = await supabase
                .from('milestones')
                .select('amount, status, projects!inner(owner_id)')
                .eq('projects.owner_id', user.id)
                .eq('status', 'locked');

            const lockedTotal = milestones?.reduce(
                (acc: number, curr: any) => acc + Number(resolveAmountMinor(curr)),
                0,
            ) || 0;
            setEscrowed(lockedTotal);

            const { data: ownedProjects } = await supabase
                .from('projects')
                .select('id')
                .eq('owner_id', user.id);

            const projectIds = ownedProjects?.map((p) => p.id) ?? [];
            if (projectIds.length > 0) {
                const { data: carts } = await supabase
                    .from('project_material_carts')
                    .select('id, project_id, status, total_amount_cfa, created_at, supplier_id, projects(title)')
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
        <ScreenLoader />
    ) : (
        <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={offsets.content}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => { setRefreshing(true); fetchData(); }}
                    tintColor={GOLD}
                />
            }
        >
            {/* Black card — total escrow */}
            <View style={styles.cardGlowWrap}>
                <BlurView intensity={45} tint="dark" style={styles.cardGlow} />
                <LinearGradient
                    colors={[NAVY_SOFT, NAVY]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.escrowCard}
                >
                    <View style={styles.cardShine} />
                    <View style={styles.cardChipRow}>
                        <View style={styles.chip} />
                        <TouchableOpacity style={styles.topUpPill} onPress={handleTopUp} activeOpacity={0.85}>
                            <Plus size={iconSize.xs} color={GOLD} strokeWidth={2.5} />
                            <Text style={styles.topUpPillText}>{t('topUp')}</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.cardEyebrow}>{t('totalFundsInEscrow')}</Text>
                    <Text style={styles.cardBalance}>{escrowed.toLocaleString()} CFA</Text>

                    <View style={styles.cardFooter}>
                        <XStack alignItems="center" gap={space.xs}>
                            <Lock size={iconSize.xs} color={ON_DARK_SECONDARY} />
                            <TamaguiText color={ON_DARK_SECONDARY} fontSize={font.footnote} fontWeight={weight.semibold}>
                                {t('availableWalletBalance')}
                            </TamaguiText>
                        </XStack>
                        <Text style={styles.cardSubBalance}>
                            {balance === null ? P00_BALANCE_UNAVAILABLE : `${balance.toLocaleString()} CFA`}
                        </Text>
                    </View>
                </LinearGradient>
            </View>

            {/* Active material carts */}
            <YStack marginTop={space.xl} marginBottom={space.xs}>
                <TamaguiText color={c.textPrimary} fontSize={font.title} fontWeight={weight.heavy} letterSpacing={-0.3} marginBottom={space.sm}>
                    {t('activeMaterialCarts')}
                </TamaguiText>

                {activeCarts.length === 0 ? (
                    <View style={styles.emptyCartStrip}>
                        <TamaguiText color={c.textSecondary} fontSize={font.footnote}>
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
                                <Text style={[styles.cartStatus, { color: statusColor(cart.status, c) }]}>
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
            <YStack marginTop={space.xl}>
                <TamaguiText color={c.textPrimary} fontSize={font.title} fontWeight={weight.heavy} letterSpacing={-0.3} marginBottom={space.sm}>
                    {t('completedHandovers')}
                </TamaguiText>

                {collectedCarts.length === 0 ? (
                    <PremiumEmptyState
                        icon="checkmark-done-outline"
                        title={t('noCompletedHandovers')}
                        subtitle="When suppliers scan QR codes and collect materials, they appear here."
                    />
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
                                    <CheckCircle size={iconSize.sm} color={SUCCESS} strokeWidth={2.2} />
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
                <YStack marginTop={space.xl}>
                    <TamaguiText color={c.textPrimary} fontSize={font.title} fontWeight={weight.heavy} letterSpacing={-0.3} marginBottom={space.sm}>
                        Wallet Activity
                    </TamaguiText>
                    <YStack gap={0}>
                        {transactions.map((txn) => (
                            <View key={txn.id} style={styles.statementRow}>
                                <View style={[
                                    styles.statementIconWrap,
                                    { backgroundColor: txn.amount > 0 ? withAlpha(SUCCESS, ALPHA.medium) : withAlpha(c.isDark ? '#FFFFFF' : '#0F172A', ALPHA.faint) },
                                ]}>
                                    <Text style={{ color: txn.amount > 0 ? SUCCESS : c.muted, fontWeight: weight.heavy }}>
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
                                    { color: txn.amount > 0 ? SUCCESS : c.textPrimary },
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
        <View style={[styles.screen, { backgroundColor: c.bg }]}>
            <StatusBar barStyle={c.isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
            <PremiumHeader
                title={t('clientDashboard.myWallet') ?? 'Escrow'}
                subtitle="Funds & material carts"
                menuItems={clientMenuItems(router, t)}
                onNotificationsPress={() => router.push('/notifications')}
            />
            <VaultGate promptMessage={t('unlockWalletPrompt')} lockOnBlur>
                {walletContent}
            </VaultGate>
        </View>
    );
}

const createStyles = (c: PremiumColors) => StyleSheet.create({
    screen: {
        flex: 1,
    },

    cardGlowWrap: {
        position: 'relative',
        marginBottom: space.xxs,
    },
    cardGlow: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: radius.xl,
        overflow: 'hidden',
        opacity: 0.55,
        transform: [{ scale: 1.04 }],
    },
    escrowCard: {
        borderRadius: radius.xl,
        padding: space.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: GOLD_BORDER,
    },
    cardShine: {
        position: 'absolute',
        top: -40,
        right: -30,
        width: 140,
        height: 140,
        borderRadius: radius.pill,
        backgroundColor: GOLD_TINT,
    },
    cardChipRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: space.xl,
    },
    chip: {
        width: 42,
        height: 30,
        borderRadius: radius.sm,
        backgroundColor: GOLD_TINT,
        borderWidth: 1,
        borderColor: GOLD_BORDER,
    },
    topUpPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xxs,
        paddingHorizontal: space.sm,
        paddingVertical: space.xs,
        borderRadius: radius.pill,
        backgroundColor: withAlpha('#FFFFFF', ALPHA.soft),
        borderWidth: 1,
        borderColor: GOLD_BORDER,
    },
    topUpPillText: {
        ...text.caption,
        color: GOLD,
        fontWeight: weight.heavy,
    },
    cardEyebrow: {
        ...text.label,
        color: ON_DARK_SECONDARY,
        letterSpacing: 1.2,
    },
    cardBalance: {
        ...text.hero,
        color: GOLD,
        letterSpacing: -0.5,
        marginTop: space.xs,
    },
    cardFooter: {
        marginTop: space.lg,
        paddingTop: space.md,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: withAlpha('#FFFFFF', ALPHA.soft),
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cardSubBalance: {
        ...text.footnote,
        color: ON_DARK_PRIMARY,
        fontWeight: weight.heavy,
    },

    cartScrollRow: {
        gap: space.sm,
        paddingRight: space.xs,
    },
    cartCard: {
        width: 200,
        padding: space.md,
        borderRadius: radius.lg,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
    },
    cartProject: {
        ...text.footnote,
        color: c.textPrimary,
        fontWeight: weight.heavy,
        marginBottom: space.xs,
    },
    cartStatus: {
        ...text.micro,
        fontWeight: weight.heavy,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: space.sm,
    },
    cartAmount: {
        ...text.subtitle,
        color: c.textPrimary,
    },
    cartDate: {
        ...text.caption,
        color: c.textSecondary,
        marginTop: space.xxs,
    },
    emptyCartStrip: {
        padding: space.lg,
        borderRadius: radius.lg,
        backgroundColor: c.surfaceAlt,
        borderWidth: 1,
        borderColor: c.border,
    },

    statementRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: space.md,
        gap: space.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: c.border,
    },
    statementIconWrap: {
        width: 40,
        height: 40,
        borderRadius: radius.pill,
        backgroundColor: withAlpha(SUCCESS, ALPHA.medium),
        alignItems: 'center',
        justifyContent: 'center',
    },
    statementBody: {
        flex: 1,
    },
    statementTitle: {
        ...text.footnote,
        color: c.textPrimary,
        fontWeight: weight.heavy,
    },
    statementSub: {
        ...text.caption,
        color: c.textSecondary,
        marginTop: 2,
    },
    statementAmount: {
        ...text.footnote,
        color: c.textPrimary,
        fontWeight: weight.heavy,
    },
});
