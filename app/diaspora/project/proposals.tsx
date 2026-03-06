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
import NavigationBar from '@/components/NavigationBar';
import { theme } from '@/constants/theme';
import { rankBids, type ProviderStats } from '@/utils/bidScoring';

export default function ProposalsScreen() {
    const insets = useSafeAreaInsets();
    const { id } = useLocalSearchParams(); // Project ID
    const router = useRouter();

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
        Alert.alert(
            "Confirm Hiring",
            `Hire ${application.profiles.full_name} for ${application.bid_amount?.toLocaleString()} CFA?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Hire Now",
                    style: "default",
                    onPress: async () => {
                        setHiringId(application.id);
                        try {
                            // 1. Assign Provider & Start Project
                            const { error: updateError } = await supabase
                                .from('projects')
                                .update({
                                    assigned_provider_id: application.provider_id,
                                    status: 'in_progress' // <--- The Project Goes Live!
                                })
                                .eq('id', id);

                            if (updateError) throw updateError;

                            // 2. Mark this app as accepted
                            await supabase
                                .from('project_applications')
                                .update({ status: 'accepted' })
                                .eq('id', application.id);

                            // 3. Reject others (Optional cleanup)
                            await supabase
                                .from('project_applications')
                                .update({ status: 'rejected' })
                                .eq('project_id', id)
                                .neq('id', application.id);

                            // --- 4. NEW: AUTO-CREATE MILESTONES ---
                            // This ensures the Workroom is not empty.
                            // We split the bid into 2 chunks (50% / 50%) for simplicity.
                            const halfAmount = Math.floor(application.bid_amount / 2);
                            const remainder = application.bid_amount - halfAmount;

                            const { error: milesError } = await supabase.from('milestones').insert([
                                {
                                    project_id: id,
                                    title: "Phase 1: Mobilization & Materials",
                                    amount: halfAmount,
                                    status: 'locked',
                                    step_order: 1,
                                },
                                {
                                    project_id: id,
                                    title: "Phase 2: Completion & Handover",
                                    amount: remainder,
                                    status: 'locked',
                                    step_order: 2,
                                },
                            ]);

                            if (milesError) throw milesError;

                            // Set project funds status to escrow (optional: add funds_status column to projects)
                            const { error: escrowErr } = await supabase.from('projects').update({ funds_status: 'escrow' }).eq('id', id);
                            if (escrowErr) { /* column may not exist */ }

                            successFeedback();
                            Alert.alert("Success", "Provider Hired! Workroom created.");
                            // Go back to Project Details so Client can see the "Active Provider" view
                            router.replace(`/diaspora/project/${id}`);

                        } catch (err: any) {
                            Alert.alert("Error", err.message);
                            setHiringId(null);
                        }
                    }
                }
            ]
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
                        <Text style={styles.recommendedText}>Algorithm Recommended</Text>
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
                            <ActivityIndicator color={theme.colors.surface} />
                        ) : (
                            <Text style={styles.hireText}>HIRE FOR {item.bid_amount?.toLocaleString()}</Text>
                        )}
                    </TouchableOpacity>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <NavigationBar title="Proposals" showBack dynamicColor={theme.colors.active} />
            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.text} /></View>
            ) : (
                <FlatList
                    data={proposals}
                    keyExtractor={item => item.id}
                    renderItem={renderProposal}
                    contentContainerStyle={[styles.list, { paddingBottom: 120, paddingHorizontal: theme.spacing.lg }]}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="documents-outline" size={48} color={theme.colors.textSubtle} />
                            <Text style={styles.emptyText}>No bids yet.</Text>
                            <Text style={styles.emptySub}>Wait for providers to apply.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    list: { paddingTop: theme.spacing.md },

    card: { backgroundColor: theme.colors.surface, borderRadius: theme.radii.md, padding: theme.spacing.md, marginBottom: theme.spacing.md, ...theme.shadow.soft, borderWidth: 1, borderColor: theme.colors.border },
    cardExpanded: { borderColor: theme.colors.active, borderWidth: 1 },
    cardRecommended: { borderColor: theme.colors.emerald, borderWidth: 2, ...theme.shadow.glowEmerald },
    recommendedBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, marginBottom: theme.spacing.sm, paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radii.pill, backgroundColor: theme.colors.emeraldSoft + '30', borderWidth: 1, borderColor: theme.colors.emerald + '60' },
    recommendedText: { fontSize: 11, fontWeight: '800', color: theme.colors.emerald, letterSpacing: 0.5 },
    smartBidRow: { flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.sm },
    smartBidText: { fontSize: 12, color: theme.colors.textMuted, fontWeight: '600' },

    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.border },
    name: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    rating: { fontSize: 12, color: theme.colors.textMuted },

    bidBadge: { backgroundColor: theme.colors.activeSoft + '25', paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs, borderRadius: theme.radii.xs },
    bidAmount: { fontSize: 14, fontWeight: '800', color: theme.colors.active },

    budgetRow: { marginBottom: theme.spacing.sm, paddingBottom: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    overBudget: { color: theme.colors.danger, fontSize: 12, fontWeight: '600' },
    underBudget: { color: theme.colors.success, fontSize: 12, fontWeight: '600' },

    letterContainer: { marginBottom: theme.spacing.md },
    letterLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textSubtle, marginBottom: 4, textTransform: 'uppercase' },
    letterText: { fontSize: 14, color: theme.colors.text, lineHeight: 22 },
    readMore: { fontSize: 12, color: theme.colors.active, fontWeight: '600', marginTop: 4 },

    hireBtn: { backgroundColor: theme.colors.primary, paddingVertical: theme.spacing.md, borderRadius: theme.radii.sm, alignItems: 'center' },
    hireBtnDisabled: { opacity: 0.7 },
    hireText: { color: theme.colors.surface, fontWeight: '700', fontSize: 14, letterSpacing: 0.5 },

    emptyState: { alignItems: 'center', marginTop: 60, gap: theme.spacing.sm },
    emptyText: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
    emptySub: { color: theme.colors.textMuted },
});