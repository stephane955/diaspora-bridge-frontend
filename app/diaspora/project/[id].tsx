import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, Image, ScrollView, TouchableOpacity,
    ActivityIndicator, Dimensions, StatusBar, Alert, RefreshControl, TextInput, Modal
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import NavigationBar from '@/components/NavigationBar';
import BudgetProgress from '@/components/BudgetProgress';
import { useLanguage } from '@/context/LanguageContext';

const { width } = Dimensions.get('window');

export default function ProjectDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { t } = useLanguage();

    const [project, setProject] = useState<any>(null);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [applications, setApplications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [review, setReview] = useState<any | null>(null);
    const [rating, setRating] = useState(5);
    const [reviewText, setReviewText] = useState('');
    const [submittingReview, setSubmittingReview] = useState(false);
    const [showCompleteModal, setShowCompleteModal] = useState(false);

    const fetchData = useCallback(async () => {
        if (!id) {
            setLoading(false);
            return;
        }

        try {
            const { data: projectData, error: projError } = await supabase
                .from('projects')
                .select('*')
                .eq('id', id)
                .single();

            if (projError) throw projError;

            const { data: expData } = await supabase
                .from('project_expenses')
                .select('*')
                .eq('project_id', id)
                .order('created_at', { ascending: false });

            const { data: appData } = await supabase
                .from('project_applications')
                .select('id')
                .eq('project_id', id)
                .eq('status', 'pending');

            const { data: reviewData } = await supabase
                .from('reviews')
                .select('*')
                .eq('project_id', id)
                .eq('client_id', projectData.owner_id)
                .maybeSingle();

            setProject(projectData);
            setExpenses(expData || []);
            setApplications(appData || []);
            setReview(reviewData || null);

        } catch (e: any) {
            console.error("Error loading project:", e.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    // --- NEW: ACCEPT APPLICATION LOGIC ---
    const handleAcceptApplication = async (providerId: string) => {
        try {
            const { error } = await supabase
                .from('projects')
                .update({
                    provider_id: providerId,
                    status: 'in_progress'
                })
                .eq('id', id);

            if (error) throw error;

            Alert.alert(t('success') || "Success", t('providerHired') || "Provider assigned to project");
            fetchData(); // Refresh the local state to show "In Progress"
        } catch (err: any) {
            Alert.alert(t('errorTitle'), err.message);
        }
    };

    const handleCompleteProject = async () => {
        if (!project?.provider_id) {
            Alert.alert(t('missingProviderTitle'), t('missingProviderBody'));
            return;
        }
        setSubmittingReview(true);
        const { error: reviewError } = await supabase.from('reviews').insert({
            project_id: id,
            provider_id: project.provider_id,
            client_id: project.owner_id,
            rating,
            review: reviewText
        });

        if (reviewError) {
            setSubmittingReview(false);
            Alert.alert(t('errorTitle'), reviewError.message || t('reviewSubmitFailed'));
            return;
        }

        const { error: statusError } = await supabase
            .from('projects')
            .update({ status: 'completed' })
            .eq('id', id);

        setSubmittingReview(false);

        if (statusError) {
            Alert.alert(t('errorTitle'), statusError.message || t('completeProjectFailed'));
            return;
        }

        setReview({ rating, review: reviewText });
        setShowCompleteModal(false);
        Alert.alert(t('completedTitle'), t('projectCompletedBody'));
        router.back();
    };

    const renderStars = (current: number, interactive = false) => (
        <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map(num => (
                <TouchableOpacity
                    key={num}
                    disabled={!interactive}
                    onPress={() => setRating(num)}
                    style={styles.starBtn}
                >
                    <Ionicons name={num <= current ? "star" : "star-outline"} size={22} color="#FBBF24" />
                </TouchableOpacity>
            ))}
        </View>
    );

    const handleDeleteProject = async () => {
        if (!project) return;
        Alert.alert(t('deleteProjectTitle'), t('deleteProjectBody'), [
            { text: t('cancel'), style: "cancel" },
            {
                text: t('deleteAction'),
                style: 'destructive',
                onPress: async () => {
                    await supabase.from('projects').delete().eq('id', id);
                    router.replace('/diaspora');
                }
            }
        ]);
    };

    const getStatusStep = () => {
        if (!project) return 0;
        const normalized = project.status?.toString().toLowerCase().replace(/\s+/g, '_');
        if (normalized === 'pending') return 0;
        if (normalized === 'in_progress') return 1;
        if (normalized === 'completed') return 2;
        return 0;
    };

    const normalizedStatus = project?.status?.toString().toLowerCase().replace(/\s+/g, '_');
    const statusLabel = normalizedStatus === 'pending'
        ? t('statusPending')
        : normalizedStatus === 'in_progress'
            ? t('statusInProgress')
            : normalizedStatus === 'completed'
                ? t('statusCompleted')
                : project?.status?.toString() || '';

    const totalSpent = expenses.reduce((sum, item) => sum + (item.status === 'approved' ? item.amount : 0), 0);

    if (loading) return (
        <View style={styles.center}><ActivityIndicator size="large" color="#0F172A" /></View>
    );

    if (!project) return (
        <View style={styles.center}><Text>{t('projectNotFound')}</Text></View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <NavigationBar title={t('projectHubTitle')} showBack={true} />

            <ScrollView
                contentContainerStyle={{ paddingBottom: 60 }}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <View style={styles.imageHeader}>
                    <Image
                        source={{ uri: project.image_url || 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5' }}
                        style={styles.heroImage}
                    />
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.gradientOverlay}>
                        <View style={styles.headerContent}>
                            <View style={styles.tag}>
                                <Text style={styles.tagText}>{statusLabel.toUpperCase()}</Text>
                            </View>
                            <Text style={styles.title}>{project.title}</Text>
                            <Text style={styles.location}>
                                <Ionicons name="location" size={16} color="#CBD5E1" /> {project.city}
                            </Text>
                        </View>
                    </LinearGradient>
                </View>

                <View style={styles.body}>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>{t('projectStatusTitle')}</Text>
                        <View style={styles.stepperContainer}>
                            {[t('statusPending'), t('statusInProgress'), t('statusCompleted')].map((step, index) => {
                                const activeStep = getStatusStep();
                                const isActive = index <= activeStep;
                                return (
                                    <View key={index} style={styles.stepWrapper}>
                                        <View style={[styles.stepCircle, isActive && styles.stepActive]}>
                                            {index < activeStep ? (
                                                <Ionicons name="checkmark" size={14} color="#fff" />
                                            ) : (
                                                <Text style={[styles.stepNum, isActive && { color: '#fff' }]}>{index + 1}</Text>
                                            )}
                                        </View>
                                        <Text style={[styles.stepLabel, isActive && styles.labelActive]}>{step}</Text>
                                        {index < 2 && <View style={[styles.stepLine, index < activeStep && styles.lineActive]} />}
                                    </View>
                                );
                            })}
                        </View>
                    </View>

                    <BudgetProgress totalBudget={project.budget || 0} spent={totalSpent} />

                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: id } })}
                        >
                            <Ionicons name="chatbubbles" size={20} color="#0EA5E9" />
                            <Text style={styles.actionText}>{t('chatAction')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => router.push({ pathname: '/diaspora/timeline', params: { id: id } })}
                        >
                            <Ionicons name="images" size={20} color="#0EA5E9" />
                            <Text style={styles.actionText}>{t('photosAction')}</Text>
                        </TouchableOpacity>
                    </View>

                    {normalizedStatus === 'pending' && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>{t('providerRequestsTitle')}</Text>
                            <TouchableOpacity
                                style={styles.waitingCard}
                                onPress={() => router.push(`/diaspora/project/${id}/applicants`)}
                            >
                                <Ionicons name="people-outline" size={24} color="#64748B" />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.waitingText}>
                                        {applications.length === 0 ? t('noApplicantsYet') : `${applications.length} ${t('applicantsCount')}`}
                                    </Text>
                                    <Text style={styles.appDate}>{t('tapToReviewHire')}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>
                    )}

                    {normalizedStatus !== 'pending' && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>{t('assignedProviderTitle')}</Text>
                            <View style={styles.providerCard}>
                                <Image source={{ uri: 'https://i.pravatar.cc/150?u=provider' }} style={styles.providerImg} />
                                <View>
                                    <Text style={styles.providerName}>{t('providerAssignedName')}</Text>
                                    <Text style={styles.providerSub}>{t('providerAssignedSub')}</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {normalizedStatus === 'pending' && (
                        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteProject}>
                            <Ionicons name="trash-outline" size={20} color="#EF4444" />
                            <Text style={styles.deleteText}>{t('deleteProjectAction')}</Text>
                        </TouchableOpacity>
                    )}

                    {normalizedStatus === 'in_progress' && (
                        <TouchableOpacity style={styles.completeBtn} onPress={() => setShowCompleteModal(true)}>
                            <Ionicons name="checkmark-circle" size={20} color="#fff" />
                            <Text style={styles.completeText}>{t('markCompleteAction')}</Text>
                        </TouchableOpacity>
                    )}

                    {normalizedStatus === 'completed' && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>{t('rateProviderTitle')}</Text>
                            {review ? (
                                <View style={styles.reviewCard}>
                                    {renderStars(review.rating || 0)}
                                    <Text style={styles.reviewText}>{review.review || t('noCommentProvided')}</Text>
                                </View>
                            ) : (
                                <View style={styles.reviewCard}>
                                    <Text style={styles.reviewText}>{t('noReviewSubmitted')}</Text>
                                </View>
                            )}
                        </View>
                    )}

                </View>
            </ScrollView>

            <Modal visible={showCompleteModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>{t('completeProjectTitle')}</Text>
                        <Text style={styles.modalSub}>{t('completeProjectSub')}</Text>
                        {renderStars(rating, true)}
                        <TextInput
                            style={styles.reviewInput}
                            placeholder={t('reviewPlaceholder')}
                            placeholderTextColor="#94A3B8"
                            multiline
                            value={reviewText}
                            onChangeText={setReviewText}
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowCompleteModal(false)}>
                                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.submitBtn} onPress={handleCompleteProject} disabled={submittingReview}>
                                {submittingReview ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{t('submitCompleteAction')}</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    imageHeader: { height: 250, width: '100%', position: 'relative' },
    heroImage: { width: '100%', height: '100%' },
    gradientOverlay: { position: 'absolute', bottom: 0, width: '100%', height: '100%', justifyContent: 'flex-end', padding: 24 },
    headerContent: { marginBottom: 10 },
    tag: { backgroundColor: '#0EA5E9', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 10 },
    tagText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    title: { color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 4 },
    location: { color: '#E2E8F0', fontSize: 16, fontWeight: '500' },
    body: { padding: 24, marginTop: -20, backgroundColor: '#F8FAFC', borderTopLeftRadius: 30, borderTopRightRadius: 30 },
    section: { marginBottom: 30 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 16 },
    stepperContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10 },
    stepWrapper: { alignItems: 'center', flex: 1, position: 'relative' },
    stepCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', marginBottom: 8, zIndex: 2 },
    stepActive: { backgroundColor: '#0EA5E9' },
    stepNum: { fontSize: 12, fontWeight: '700', color: '#64748B' },
    stepLabel: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
    labelActive: { color: '#0F172A' },
    stepLine: { position: 'absolute', top: 16, left: '50%', width: '100%', height: 2, backgroundColor: '#E2E8F0', zIndex: 1 },
    lineActive: { backgroundColor: '#0EA5E9' },
    actionRow: { flexDirection: 'row', gap: 12, marginBottom: 30 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', paddingVertical: 12, borderRadius: 14, gap: 8, borderWidth: 1, borderColor: '#E2E8F0' },
    actionText: { color: '#0F172A', fontWeight: '700', fontSize: 14 },
    waitingCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, backgroundColor: '#F1F5F9', borderRadius: 16 },
    waitingText: { color: '#64748B', fontWeight: '600' },
    appDate: { fontSize: 12, color: '#64748B' },
    providerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
    providerImg: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
    providerName: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
    providerSub: { fontSize: 12, color: '#64748B' },
    deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, padding: 15, borderRadius: 14, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FEE2E2' },
    deleteText: { color: '#EF4444', fontWeight: '700', fontSize: 14 },
    completeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, padding: 15, borderRadius: 14, backgroundColor: '#16A34A' },
    completeText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    reviewCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', gap: 12 },
    starRow: { flexDirection: 'row', gap: 4 },
    starBtn: { padding: 4 },
    reviewInput: { backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', padding: 12, minHeight: 90, textAlignVertical: 'top', color: '#0F172A' },
    submitBtn: { backgroundColor: '#0EA5E9', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
    submitText: { color: '#fff', fontWeight: '800' },
    reviewText: { color: '#334155', fontSize: 14, lineHeight: 20 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, gap: 14 },
    modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
    modalSub: { fontSize: 13, color: '#64748B' },
    modalActions: { flexDirection: 'row', gap: 12, marginTop: 6 },
    modalCancel: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
    modalCancelText: { color: '#0F172A', fontWeight: '700' }
});