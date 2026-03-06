import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    Alert, ActivityIndicator, Image
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { FlashList } from '@shopify/flash-list';
import { useWorkroomQuery, useMilestoneUploadEvidence } from '@/hooks/useWorkroomData';

const WORKROOM_KEY = (projectId: string) => ['workroom', projectId] as const;

export default function WorkroomScreen() {
    const { id } = useLocalSearchParams();
    const projectId = typeof id === 'string' ? id : id?.[0];
    const { user } = useAuth();
    const router = useRouter();
    const queryClient = useQueryClient();

    const { data, isLoading: loading, refetch: fetchWorkroomData } = useWorkroomQuery(projectId);
    const project = data?.project ?? null;
    const milestones = data?.milestones ?? [];

    const [uploading, setUploading] = useState(false);
    const [advanceEligibility, setAdvanceEligibility] = useState<{ eligible: boolean; max_advance_pct?: number } | null>(null);
    const [existingAdvance, setExistingAdvance] = useState<any>(null);
    const [requestingAdvance, setRequestingAdvance] = useState(false);

    const uploadEvidence = useMilestoneUploadEvidence(projectId);

    useEffect(() => {
        if (!user?.id || !projectId) return;
        (async () => {
            const { data: elig } = await supabase.rpc('get_provider_advance_eligibility', { p_provider_id: user.id });
            setAdvanceEligibility(elig ? { eligible: (elig as any).eligible, max_advance_pct: (elig as any).max_advance_pct } : null);
            const { data: adv } = await supabase.from('provider_advances').select('*').eq('project_id', projectId).eq('provider_id', user.id).in('status', ['pending', 'disbursed']).maybeSingle();
            setExistingAdvance(adv || null);
        })();
    }, [user?.id, projectId]);

    const handleUploadEvidence = async (milestoneId: string) => {
        if (!projectId) return;
        const prev = queryClient.getQueryData<{ project: unknown; milestones: any[] }>(WORKROOM_KEY(projectId));
        queryClient.setQueryData(WORKROOM_KEY(projectId), (old: typeof prev) => {
            if (!old?.milestones) return old;
            return { ...old, milestones: old.milestones.map((m) => (m.id === milestoneId ? { ...m, status: 'in_review' as const } : m)) };
        });
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 0.5,
            });
            if (result.canceled) {
                if (prev) queryClient.setQueryData(WORKROOM_KEY(projectId), prev);
                return;
            }
            setUploading(true);

            const manipulatedResult = await ImageManipulator.manipulateAsync(
                result.assets[0].uri,
                [{ resize: { width: 800 } }],
                { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
            );
            const fileName = `${milestoneId}_${Date.now()}.jpg`;
            const filePath = `evidence/${fileName}`;
            const response = await fetch(manipulatedResult.uri);
            const blob = await response.blob();

            const { error: uploadError } = await supabase.storage.from('evidence').upload(filePath, blob);
            if (uploadError) throw uploadError;

            await uploadEvidence.mutateAsync({ milestoneId, evidenceUrl: filePath });
            Alert.alert("Success", "Evidence uploaded! Client notified.");
        } catch (e: any) {
            if (prev) queryClient.setQueryData(WORKROOM_KEY(projectId), prev);
            Alert.alert("Upload Failed", e?.message ?? "Check your internet connection.");
        } finally {
            setUploading(false);
        }
    };

    const renderMilestone = ({ item, index }: { item: any, index: number }) => {
        const isLocked = index > 0 && milestones[index - 1].status !== 'paid';
        const isPaid = item.status === 'paid';
        const isReview = item.status === 'in_review';

        return (
            <View style={[styles.milestoneCard, isLocked && styles.lockedCard]}>
                <View style={styles.milestoneHeader}>
                    <View style={styles.stepBadge}>
                        <Text style={styles.stepText}>Step {index + 1}</Text>
                    </View>
                    <Text style={[styles.statusText, isPaid ? styles.textGreen : styles.textOrange]}>
                        {item.status.toUpperCase().replace('_', ' ')}
                    </Text>
                </View>

                <Text style={styles.milestoneTitle}>{item.title}</Text>
                <Text style={styles.milestoneAmount}>{Number(item.amount).toLocaleString()} CFA</Text>

                {/* ACTION BUTTONS */}
                {!isLocked && !isPaid && (
                    <TouchableOpacity
                        style={[styles.actionBtn, isReview && styles.disabledBtn]}
                        onPress={() => !isReview && handleUploadEvidence(item.id)}
                        disabled={isReview || uploading}
                    >
                        {uploading ? (
                            <ActivityIndicator color="#fff" />
                        ) : isReview ? (
                            <Text style={styles.btnText}>Waiting for Approval...</Text>
                        ) : (
                            <View style={{flexDirection:'row', alignItems:'center', gap: 8}}>
                                <Ionicons name="camera" size={18} color="#fff" />
                                <Text style={styles.btnText}>Upload Proof</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                )}

                {isLocked && (
                    <View style={styles.lockOverlay}>
                        <Ionicons name="lock-closed" size={20} color="#94A3B8" />
                        <Text style={styles.lockText}>Complete previous step to unlock</Text>
                    </View>
                )}
            </View>
        );
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0F172A" /></View>;

    return (
        <View style={styles.container}>
            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Workroom</Text>
                <View style={{width: 40}} />
            </View>

            {/* UPGRADE: FlashList handles the scrolling (ListHeaderComponent) */}
            <View style={{flex: 1, paddingHorizontal: 20}}>
                <FlashList
                    data={milestones}
                    renderItem={renderMilestone}
                    estimatedItemSize={150}
                    ListHeaderComponent={
                        <View style={styles.projectCard}>
                            <Text style={styles.projectTitle}>{project?.title}</Text>
                            <TouchableOpacity
                                style={styles.materialCartBtn}
                                onPress={() => router.push({ pathname: '/provider/material-cart', params: { projectId: id } })}
                            >
                                <Ionicons name="cart" size={18} color={theme.colors.emerald} />
                                <Text style={styles.materialCartBtnText}>Material Cart</Text>
                            </TouchableOpacity>
                            {advanceEligibility?.eligible && !existingAdvance && milestones.length > 0 && milestones.some((m: any) => m.status === 'locked') && (
                                <TouchableOpacity
                                    style={styles.advanceBtn}
                                    onPress={async () => {
                                        const firstLocked = milestones.find((m: any) => m.status === 'locked');
                                        const pct = Math.min(20, advanceEligibility.max_advance_pct ?? 15);
                                        const amount = Math.floor((Number(firstLocked?.amount) || 0) * (pct / 100));
                                        if (amount <= 0) return;
                                        Alert.alert(
                                            'Bridge Credit',
                                            `Request ${amount.toLocaleString()} CFA (${pct}% of Milestone 1)? Repaid automatically from your final payout.`,
                                            [
                                                { text: 'Cancel', style: 'cancel' },
                                                {
                                                    text: 'Request',
                                                    onPress: async () => {
                                                        setRequestingAdvance(true);
                                                        try {
                                                            const { error } = await supabase.from('provider_advances').insert({
                                                                project_id: id,
                                                                provider_id: user?.id,
                                                                amount_cfa: amount,
                                                                status: 'pending',
                                                            });
                                                            if (error) throw error;
                                                            Alert.alert('Submitted', 'Your advance request has been recorded. Funds will be disbursed per platform policy.');
                                                            fetchWorkroomData();
                                                        } catch (e: any) {
                                                            Alert.alert('Error', e.message);
                                                        } finally {
                                                            setRequestingAdvance(false);
                                                        }
                                                    },
                                                },
                                            ]
                                        );
                                    }}
                                    disabled={requestingAdvance}
                                >
                                    {requestingAdvance ? <ActivityIndicator size="small" color="#fff" /> : (
                                        <>
                                            <Ionicons name="cash-outline" size={18} color="#fff" />
                                            <Text style={styles.advanceBtnText}>Request Advance</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            )}
                            {existingAdvance && (
                                <View style={styles.advanceStatus}>
                                    <Ionicons name="wallet-outline" size={16} color={theme.colors.textMuted} />
                                    <Text style={styles.advanceStatusText}>Advance: {Number(existingAdvance.amount_cfa).toLocaleString()} CFA ({existingAdvance.status})</Text>
                                </View>
                            )}
                            <View style={styles.clientRow}>
                                <Image source={{ uri: project?.profiles?.avatar_url }} style={styles.avatar} />
                                <View>
                                    <Text style={styles.clientName}>{project?.profiles?.full_name}</Text>
                                    <Text style={styles.clientCity}>{project?.profiles?.city}</Text>
                                </View>
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>IN PROGRESS</Text>
                                </View>
                            </View>
                            <Text style={styles.sectionTitle}>Project Milestones</Text>
                        </View>
                    }
                    contentContainerStyle={{ paddingBottom: 40 }}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 15, backgroundColor: '#fff' },
    backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },

    projectCard: { backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 20, marginTop: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
    projectTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 10 },
    materialCartBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginBottom: 10, paddingVertical: 8, paddingHorizontal: 14, borderRadius: theme.radii.pill, backgroundColor: theme.colors.emeraldSoft + '30', borderWidth: 1, borderColor: theme.colors.emerald + '50' },
    materialCartBtnText: { fontSize: 13, fontWeight: '700', color: theme.colors.emerald },
    advanceBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginBottom: 15, paddingVertical: 10, paddingHorizontal: 16, borderRadius: theme.radii.pill, backgroundColor: theme.colors.primary, ...theme.shadow.glow },
    advanceBtnText: { fontSize: 13, fontWeight: '800', color: '#fff' },
    advanceStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 15 },
    advanceStatusText: { fontSize: 12, color: theme.colors.textMuted, fontWeight: '600' },
    clientRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E2E8F0' },
    clientName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
    clientCity: { fontSize: 12, color: '#64748B' },
    badge: { marginLeft: 'auto', backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    badgeText: { fontSize: 10, fontWeight: '800', color: '#16A34A' },

    sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },

    milestoneCard: { backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0' },
    lockedCard: { opacity: 0.6, backgroundColor: '#F1F5F9' },

    milestoneHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    stepBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    stepText: { fontSize: 10, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' },
    statusText: { fontSize: 12, fontWeight: '700' },
    textGreen: { color: '#16A34A' },
    textOrange: { color: '#F59E0B' },

    milestoneTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
    milestoneAmount: { fontSize: 14, color: '#64748B', marginBottom: 15 },

    actionBtn: { backgroundColor: '#0F172A', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
    disabledBtn: { backgroundColor: '#94A3B8' },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    lockOverlay: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
    lockText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' }
});