import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    Image, ActivityIndicator, Alert
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { mediumFeedback, successFeedback } from '@/utils/haptics';

export default function ProposalsScreen() {
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

            // 2. Get Applications (Cheapest first)
            const { data: apps, error } = await supabase
                .from('project_applications')
                .select('*, profiles:provider_id(full_name, avatar_url, rating, city)')
                .eq('project_id', id)
                .order('bid_amount', { ascending: true });

            if (error) throw error;
            setProposals(apps || []);

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
                                    status: 'pending' // Provider must upload proof
                                },
                                {
                                    project_id: id,
                                    title: "Phase 2: Completion & Handover",
                                    amount: remainder,
                                    status: 'pending' // Locked until Phase 1 is done
                                }
                            ]);

                            if (milesError) throw milesError;

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

    const renderProposal = ({ item }: { item: any }) => {
        const isExpanded = expandedId === item.id;
        // Calculate difference
        const budgetDiff = project?.budget ? item.bid_amount - project.budget : 0;
        const isOverBudget = budgetDiff > 0;

        return (
            <TouchableOpacity
                style={[styles.card, isExpanded && styles.cardExpanded]}
                activeOpacity={0.9}
                onPress={() => setExpandedId(isExpanded ? null : item.id)}
            >
                {/* Header Row */}
                <View style={styles.cardHeader}>
                    <Image
                        source={{ uri: item.profiles?.avatar_url || 'https://i.pravatar.cc/150' }}
                        style={styles.avatar}
                    />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{item.profiles?.full_name}</Text>
                        <View style={styles.ratingRow}>
                            <Ionicons name="star" size={14} color="#FBBF24" />
                            <Text style={styles.rating}>{item.profiles?.rating || 'New'} • {item.profiles?.city}</Text>
                        </View>
                    </View>
                    <View style={styles.bidBadge}>
                        <Text style={styles.bidAmount}>{item.bid_amount?.toLocaleString()} CFA</Text>
                    </View>
                </View>

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
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.hireText}>HIRE FOR {item.bid_amount?.toLocaleString()}</Text>
                        )}
                    </TouchableOpacity>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>Review Proposals</Text>
                    <Text style={styles.headerSub}>Select the best provider</Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#0F172A" /></View>
            ) : (
                <FlatList
                    data={proposals}
                    keyExtractor={item => item.id}
                    renderItem={renderProposal}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="documents-outline" size={48} color="#CBD5E1" />
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
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 16 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
    headerSub: { fontSize: 13, color: '#64748B' },

    list: { padding: 20 },

    card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3, borderWidth: 1, borderColor: '#F1F5F9' },
    cardExpanded: { borderColor: '#0EA5E9', borderWidth: 1 },

    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E2E8F0' },
    name: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    rating: { fontSize: 12, color: '#64748B' },

    bidBadge: { backgroundColor: '#F0F9FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    bidAmount: { fontSize: 14, fontWeight: '800', color: '#0284C7' },

    budgetRow: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    overBudget: { color: '#EF4444', fontSize: 12, fontWeight: '600' },
    underBudget: { color: '#16A34A', fontSize: 12, fontWeight: '600' },

    letterContainer: { marginBottom: 16 },
    letterLabel: { fontSize: 12, fontWeight: '700', color: '#94A3B8', marginBottom: 4, textTransform: 'uppercase' },
    letterText: { fontSize: 14, color: '#334155', lineHeight: 22 },
    readMore: { fontSize: 12, color: '#0EA5E9', fontWeight: '600', marginTop: 4 },

    hireBtn: { backgroundColor: '#0F172A', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    hireBtnDisabled: { opacity: 0.7 },
    hireText: { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 0.5 },

    emptyState: { alignItems: 'center', marginTop: 60, gap: 10 },
    emptyText: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
    emptySub: { color: '#64748B' },
});