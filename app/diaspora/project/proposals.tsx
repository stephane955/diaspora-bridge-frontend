import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    Image, ActivityIndicator, Alert
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { mediumFeedback, successFeedback } from '@/utils/haptics';
import { useLanguage } from '@/context/LanguageContext';
import PremiumHeader from '@/components/PremiumHeader';
import PremiumEmptyState from '@/components/PremiumEmptyState';
import ScreenLoader from '@/components/ScreenLoader';
import { clientMenuItems } from '@/constants/premiumMenus';
import { usePremiumColors, type PremiumColors } from '@/hooks/usePremiumColors';
import { useScreenOffsets } from '@/hooks/useScreenOffsets';
import {
    DANGER_SOFT,
    GOLD,
    GOLD_BORDER,
    GOLD_TINT,
    icon as iconSize,
    radius,
    space,
    SUCCESS,
    text,
    WARNING,
    weight,
} from '@/constants/design';
import { rankBids, type ProviderStats } from '@/utils/bidScoring';
import { resolveProjectBudgetMinor, formatBudgetDisplay } from '@/lib/money';
import { hireProvider } from '@/lib/hireProvider';
import FavoriteProviderButton from '@/components/FavoriteProviderButton';
import { requiredRouteParam } from '@/utils/routeParams';

type ProposalProfile = {
    full_name: string | null;
    avatar_url: string | null;
    rating: number | null;
    city: string | null;
};

type ProposalRow = {
    id: string;
    project_id: string;
    provider_id: string;
    bid_amount: number | null;
    material_estimate: number | null;
    time_to_completion_days: number | null;
    message: string | null;
    status: string;
    created_at: string;
    updated_at: string;
    profiles: ProposalProfile | null;
    bidScore?: number;
};

export default function ProposalsScreen() {
    const c = usePremiumColors();
    const offsets = useScreenOffsets();
    const styles = useMemo(() => makeStyles(c), [c]);
    const params = useLocalSearchParams<{ id?: string | string[] }>();
    const id = requiredRouteParam(params.id);
    const router = useRouter();
    const { t } = useLanguage();

    const [project, setProject] = useState<any>(null);
    const [proposals, setProposals] = useState<ProposalRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [hiringId, setHiringId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!id) return;
        try {
            // 1. Get Project Info (To compare budgets)
            const { data: proj } = await supabase
                .from('projects')
                .select('estimated_budget_minor, title, status')
                .eq('id', id)
                .single();
            setProject(proj);

            // 2. Get Applications (profiles joined separately — no FK on provider_id)
            const { data: apps, error } = await supabase
                .from('project_applications')
                .select('*')
                .eq('project_id', id)
                .in('status', ['pending']);

            if (error) throw error;

            const providerIds = [...new Set((apps || []).map((a) => a.provider_id))];
            const profileById: Record<string, ProposalProfile> = {};
            if (providerIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, full_name, avatar_url, rating, city')
                    .in('id', providerIds);
                for (const p of profiles ?? []) {
                    profileById[p.id] = {
                        full_name: p.full_name,
                        avatar_url: p.avatar_url,
                        rating: p.rating,
                        city: p.city,
                    };
                }
            }

            const appsWithProfiles: ProposalRow[] = (apps || []).map((a) => ({
                ...a,
                profiles: profileById[a.provider_id] ?? null,
            }));

            // 3. Fetch provider stats for AI scoring and rank bids
            const statsMap: Record<string, ProviderStats> = {};
            await Promise.all(providerIds.map(async (pid) => {
                const { data: stats } = await supabase.rpc('get_provider_stats', { p_provider_id: pid });
                if (stats && typeof stats === 'object' && !Array.isArray(stats)) {
                    const s = stats as Record<string, unknown>;
                    statsMap[pid] = {
                        completionRate: Number(s.completion_rate) || 0,
                        avgReviewScore: Number(s.avg_review_score) || 0,
                        disputeCount: Number(s.dispute_count) || 0,
                        completedProjectsCount: Number(s.completed_projects_count) || 0,
                    };
                }
            }));

            const getStats = (providerId: string) => statsMap[providerId] ?? null;
            const projectBudgetMinor = Number(resolveProjectBudgetMinor(proj ?? {}));
            const rankedInput = appsWithProfiles.map((a) => ({
                ...a,
                bid_amount: a.bid_amount ?? undefined,
            }));
            const ranked = rankBids(rankedInput, getStats, projectBudgetMinor || undefined);
            setProposals(
                ranked.map((row) => ({
                    ...row,
                    bid_amount: row.bid_amount ?? null,
                })),
            );

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleHire = async (application: any) => {
        mediumFeedback();
        const name = application.profiles?.full_name || 'this provider';
        const amount = Number(application.bid_amount || 0).toLocaleString();
        Alert.alert(
            t('confirmHire') || 'Confirm Hire',
            `Are you sure you want to hire ${name} for ${amount} CFA? This will initialize the Escrow contract.`,
            [
                { text: t('cancel') || 'Cancel', style: 'cancel' },
                {
                    text: t('hireNow') || 'Hire & Start Escrow',
                    style: 'default',
                    onPress: async () => {
                        setHiringId(application.id);
                        try {
                            await hireProvider({
                                projectId: String(id),
                                applicationId: application.id,
                                providerId: application.provider_id,
                                bidAmount: Number(application.bid_amount || 0),
                            });
                            successFeedback();
                            Alert.alert(
                                t('success') || 'Success',
                                t('providerHiredEscrow') || 'Provider hired! Escrow workroom is ready.',
                            );
                            router.replace(`/diaspora/project/${id}`);
                        } catch (err: any) {
                            Alert.alert(t('errorTitle') || 'Error', err.message);
                            setHiringId(null);
                        }
                    },
                },
            ],
        );
    };

    const renderProposal = ({ item, index }: { item: any; index: number }) => {
        const isExpanded = expandedId === item.id;
        const projectBudgetMinor = Number(resolveProjectBudgetMinor(project ?? {}));
        const budgetDiff = projectBudgetMinor > 0 ? item.bid_amount - projectBudgetMinor : 0;
        const isOverBudget = budgetDiff > 0;
        const isAlgorithmRecommended = index === 0 && proposals.length > 0;

        return (
            <TouchableOpacity
                style={[
                    styles.card,
                    isExpanded && styles.cardExpanded,
                    isAlgorithmRecommended && styles.cardRecommended,
                ]}
                activeOpacity={0.9}
                onPress={() => setExpandedId(isExpanded ? null : item.id)}
            >
                {isAlgorithmRecommended && (
                    <View style={styles.recommendedBadge}>
                        <Ionicons name="sparkles" size={iconSize.xs} color={GOLD} />
                        <Text style={styles.recommendedText}>{t('algorithmRecommended')}</Text>
                    </View>
                )}
                {/* Header Row */}
                <View style={styles.cardHeader}>
                    <Image
                        source={{ uri: item.profiles?.avatar_url || 'https://i.pravatar.cc/150' }}
                        style={styles.avatar}
                    />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{item.profiles?.full_name}</Text>
                        <View style={styles.ratingRow}>
                            <Ionicons name="star" size={iconSize.xs} color={WARNING} />
                            <Text style={styles.rating}>{item.profiles?.rating || 'New'} • {item.profiles?.city}</Text>
                        </View>
                    </View>
                    <View style={styles.bidBadge}>
                        <Text style={styles.bidAmount}>{item.bid_amount?.toLocaleString()} CFA</Text>
                    </View>
                    <FavoriteProviderButton providerId={item.provider_id} size={iconSize.sm} />
                </View>

                {/* Smart Bid details */}
                {(item.material_estimate != null || item.time_to_completion_days != null) && (
                    <View style={styles.smartBidRow}>
                        {item.material_estimate != null && (
                            <Text style={styles.smartBidText}>Materials: {Number(item.material_estimate).toLocaleString()} CFA</Text>
                        )}
                        {item.time_to_completion_days != null && (
                            <Text style={styles.smartBidText}>Completion: {item.time_to_completion_days} days</Text>
                        )}
                    </View>
                )}

                {/* Budget Comparison Logic */}
                {projectBudgetMinor > 0 && (
                    <View style={styles.budgetRow}>
                        {isOverBudget ? (
                            <Text style={styles.overBudget}>⚠️ {budgetDiff.toLocaleString()} CFA over budget</Text>
                        ) : (
                            <Text style={styles.underBudget}>✅ {Math.abs(budgetDiff).toLocaleString()} CFA under budget</Text>
                        )}
                    </View>
                )}

                {/* Expandable Cover Letter */}
                <View style={styles.letterContainer}>
                    <Text style={styles.letterLabel}>Proposal:</Text>
                    <Text style={styles.letterText} numberOfLines={isExpanded ? undefined : 2}>
                        {item.cover_letter || "No cover letter provided."}
                    </Text>
                    {!isExpanded && (
                        <Text style={styles.readMore}>Tap to read more</Text>
                    )}
                </View>

                {/* Hire Button (Only visible if expanded to prevent accidental taps) */}
                {isExpanded && (
                    <TouchableOpacity
                        style={[styles.hireBtn, hiringId === item.id && styles.hireBtnDisabled]}
                        onPress={() => handleHire(item)}
                        disabled={!!hiringId}
                    >
                        {hiringId === item.id ? (
                            <ActivityIndicator color="#0A0F1A" />
                        ) : (
                            <Text style={styles.hireText}>HIRE FOR {item.bid_amount?.toLocaleString()} CFA</Text>
                        )}
                    </TouchableOpacity>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.screen, { backgroundColor: c.bg }]}>
            <PremiumHeader
                title={t('proposalsTitle')}
                subtitle={t('applicantsTitle')}
                showBack
                fallbackRoute={`/diaspora/project/${id}`}
                menuItems={clientMenuItems(router, t)}
            />
            {loading ? (
                <ScreenLoader />
            ) : (
                <FlatList
                    data={proposals}
                    keyExtractor={item => item.id}
                    renderItem={renderProposal}
                    contentContainerStyle={offsets.content}
                    ListEmptyComponent={
                        <PremiumEmptyState
                            icon="documents-outline"
                            title={t('noBidsYet') || 'No bids yet'}
                            subtitle={t('waitForProvidersApply') || 'Providers will appear here once they apply.'}
                        />
                    }
                />
            )}
        </View>
    );
}

const makeStyles = (c: PremiumColors) => StyleSheet.create({
    screen: { flex: 1 },

    card: { backgroundColor: c.surface, borderRadius: radius.lg, padding: space.md, marginBottom: space.md, borderWidth: 1, borderColor: c.border },
    cardExpanded: { borderColor: GOLD, borderWidth: 1.5 },
    cardRecommended: { borderColor: GOLD, borderWidth: 2, backgroundColor: GOLD_TINT },
    recommendedBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space.xs, marginBottom: space.sm, paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: GOLD_TINT, borderWidth: 1, borderColor: GOLD_BORDER },
    recommendedText: { ...text.micro, fontWeight: weight.heavy, color: GOLD, letterSpacing: 0.5 },
    smartBidRow: { flexDirection: 'row', gap: space.md, marginBottom: space.sm },
    smartBidText: { ...text.caption, color: c.textSecondary },

    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm },
    avatar: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: c.surfaceAlt },
    name: { ...text.body, fontWeight: weight.heavy, color: c.textPrimary },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: space.xxs, marginTop: 2 },
    rating: { ...text.caption, color: c.textSecondary },

    bidBadge: { backgroundColor: GOLD_TINT, paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.sm, borderWidth: 1, borderColor: GOLD_BORDER },
    bidAmount: { ...text.footnote, fontWeight: weight.heavy, color: GOLD },

    budgetRow: { marginBottom: space.sm, paddingBottom: space.sm, borderBottomWidth: 1, borderBottomColor: c.border },
    overBudget: { ...text.caption, color: DANGER_SOFT },
    underBudget: { ...text.caption, color: SUCCESS },

    letterContainer: { marginBottom: space.md },
    letterLabel: { ...text.label, color: c.textSecondary, marginBottom: space.xxs },
    letterText: { ...text.footnote, color: c.textPrimary, lineHeight: 22 },
    readMore: { ...text.caption, color: GOLD, marginTop: space.xxs },

    hireBtn: { backgroundColor: GOLD, paddingVertical: space.md, borderRadius: radius.lg, alignItems: 'center' },
    hireBtnDisabled: { opacity: 0.7 },
    hireText: { ...text.footnote, fontWeight: weight.heavy, color: '#0A0F1A', letterSpacing: 0.5 },
});
