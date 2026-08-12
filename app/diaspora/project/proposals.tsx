import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    Image, ActivityIndicator, Alert
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { mediumFeedback, successFeedback } from '@/utils/haptics';
import { useLanguage } from '@/context/LanguageContext';
import PremiumHeader from '@/components/PremiumHeader';
import PremiumEmptyState from '@/components/PremiumEmptyState';
import PulseLoader from '@/components/PulseLoader';
import { clientMenuItems } from '@/constants/premiumMenus';
import { theme } from '@/constants/theme';
import { FLOATING_TAB_BAR_HEIGHT, PREMIUM_BG, PREMIUM_GOLD, TEXT_PRIMARY, TEXT_SECONDARY } from '@/constants/layout';
import { rankBids, type ProviderStats } from '@/utils/bidScoring';
import { hireProvider } from '@/lib/hireProvider';
import FavoriteProviderButton from '@/components/FavoriteProviderButton';

export default function ProposalsScreen() {
    const insets = useSafeAreaInsets();
    const { id } = useLocalSearchParams(); // Project ID
    const router = useRouter();
    const { t } = useLanguage();

    const [project, setProject] = useState<any>(null);
    const [proposals, setProposals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [hiringId, setHiringId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (!id) return;
        try {
            // 1. Get Project Info (To compare budgets)
            const { data: proj } = await supabase
                .from('projects')
                .select('budget, title, status')
                .eq('id', id)
                .single();
            setProject(proj);

            // 2. Get Applications with Smart Bid fields
            const { data: apps, error } = await supabase
                .from('project_applications')
                .select('*, profiles:provider_id(full_name, avatar_url, rating, city)')
                .eq('project_id', id)
                .in('status', ['pending']);

            if (error) throw error;

            // 3. Fetch provider stats for AI scoring and rank bids
            const providerIds = [...new Set((apps || []).map((a: any) => a.provider_id))];
            const statsMap: Record<string, ProviderStats> = {};
            await Promise.all(providerIds.map(async (pid) => {
                const { data: stats } = await supabase.rpc('get_provider_stats', { p_provider_id: pid });
                if (stats && typeof stats === 'object') {
                    statsMap[pid] = {
                        completionRate: Number((stats as any).completion_rate) || 0,
                        avgReviewScore: Number((stats as any).avg_review_score) || 0,
                        disputeCount: Number((stats as any).dispute_count) || 0,
                        completedProjectsCount: Number((stats as any).completed_projects_count) || 0,
                    };
                }
            }));

            const getStats = (providerId: string) => statsMap[providerId] ?? null;
            const ranked = rankBids(apps || [], getStats, proj?.budget ?? undefined);
            setProposals(ranked);

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
        const budgetDiff = project?.budget ? item.bid_amount - project.budget : 0;
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
                        <Ionicons name="sparkles" size={12} color={theme.colors.emerald} />
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
                            <Ionicons name="star" size={14} color={theme.colors.warning} />
                            <Text style={styles.rating}>{item.profiles?.rating || 'New'} • {item.profiles?.city}</Text>
                        </View>
                    </View>
                    <View style={styles.bidBadge}>
                        <Text style={styles.bidAmount}>{item.bid_amount?.toLocaleString()} CFA</Text>
                    </View>
                    <FavoriteProviderButton providerId={item.provider_id} size={18} />
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
                {project?.budget && (
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
        <View style={styles.screen}>
            <PremiumHeader
                title={t('proposalsTitle')}
                subtitle={t('applicantsTitle')}
                showBack
                fallbackRoute={`/diaspora/project/${id}`}
                menuItems={clientMenuItems(router, t)}
            />
            {loading ? (
                <View style={styles.center}><PulseLoader color={PREMIUM_GOLD} /></View>
            ) : (
                <FlatList
                    data={proposals}
                    keyExtractor={item => item.id}
                    renderItem={renderProposal}
                    contentContainerStyle={{
                        paddingTop: insets.top + 88,
                        paddingBottom: FLOATING_TAB_BAR_HEIGHT + 40,
                        paddingHorizontal: theme.spacing.lg,
                    }}
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

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: PREMIUM_BG },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    list: { paddingTop: theme.spacing.md },

    card: { backgroundColor: 'rgba(17,24,39,0.75)', borderRadius: theme.radii.md, padding: theme.spacing.md, marginBottom: theme.spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    cardExpanded: { borderColor: PREMIUM_GOLD, borderWidth: 1.5 },
    cardRecommended: { borderColor: PREMIUM_GOLD, borderWidth: 2, backgroundColor: 'rgba(212,175,55,0.08)' },
    recommendedBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, marginBottom: theme.spacing.sm, paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radii.pill, backgroundColor: 'rgba(212,175,55,0.15)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)' },
    recommendedText: { fontSize: 11, fontWeight: '800', color: PREMIUM_GOLD, letterSpacing: 0.5 },
    smartBidRow: { flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.sm },
    smartBidText: { fontSize: 12, color: TEXT_SECONDARY, fontWeight: '600' },

    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1E293B' },
    name: { fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    rating: { fontSize: 12, color: TEXT_SECONDARY },

    bidBadge: { backgroundColor: 'rgba(212,175,55,0.12)', paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs, borderRadius: theme.radii.xs, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
    bidAmount: { fontSize: 14, fontWeight: '800', color: PREMIUM_GOLD },

    budgetRow: { marginBottom: theme.spacing.sm, paddingBottom: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
    overBudget: { color: '#F87171', fontSize: 12, fontWeight: '600' },
    underBudget: { color: '#34D399', fontSize: 12, fontWeight: '600' },

    letterContainer: { marginBottom: theme.spacing.md },
    letterLabel: { fontSize: 12, fontWeight: '700', color: TEXT_SECONDARY, marginBottom: 4, textTransform: 'uppercase' },
    letterText: { fontSize: 14, color: TEXT_PRIMARY, lineHeight: 22 },
    readMore: { fontSize: 12, color: PREMIUM_GOLD, fontWeight: '600', marginTop: 4 },

    hireBtn: { backgroundColor: PREMIUM_GOLD, paddingVertical: theme.spacing.md, borderRadius: 14, alignItems: 'center' },
    hireBtnDisabled: { opacity: 0.7 },
    hireText: { color: '#0A0F1A', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },

    emptyState: { alignItems: 'center', marginTop: 60, gap: theme.spacing.sm },
    emptyText: { fontSize: 18, fontWeight: '700', color: TEXT_PRIMARY },
    emptySub: { color: TEXT_SECONDARY },
});