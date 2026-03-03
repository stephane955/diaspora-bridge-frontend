import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, Image, TouchableOpacity,
    ActivityIndicator, Dimensions, StatusBar, Alert, RefreshControl, TextInput, Modal, Animated, KeyboardAvoidingView, Platform
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { mediumFeedback, successFeedback } from '@/utils/haptics';
import BudgetProgress from '@/components/BudgetProgress';
import { theme } from '@/constants/theme';

const { width, height } = Dimensions.get('window');
const HEADER_HEIGHT = 300;

export default function ProjectDetailsScreen() {
    const insets = useSafeAreaInsets();
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { t } = useLanguage();
    const scrollY = useRef(new Animated.Value(0)).current;

    // --- DATA STATE ---
    const [project, setProject] = useState<any>(null);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [applications, setApplications] = useState<any[]>([]);
    const [updates, setUpdates] = useState<any[]>([]); // Timeline Data
    const [review, setReview] = useState<any | null>(null);

    // --- UI STATE ---
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null); // Image Zoom

    // --- ACTION STATES ---
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    // Payment Form
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentDesc, setPaymentDesc] = useState('');
    const [processingPayment, setProcessingPayment] = useState(false);

    // Review Form
    const [rating, setRating] = useState(5);
    const [reviewText, setReviewText] = useState('');
    const [submittingReview, setSubmittingReview] = useState(false);

    // Note: 'hiring' state removed here because hiring moved to Proposals screen

    // --- 1. FETCH DATA ---
    const fetchData = useCallback(async () => {
        if (!id) return;
        try {
            // A. Project & Provider
            const { data: projectData, error: projError } = await supabase
                .from('projects')
                .select('*, profiles:assigned_provider_id(full_name, avatar_url, city, rating)')
                .eq('id', id)
                .single();

            if (projError) throw projError;

            // B. Expenses
            const { data: expData } = await supabase
                .from('project_expenses')
                .select('*')
                .eq('project_id', id)
                .eq('status', 'approved')
                .order('created_at', { ascending: false });

            // C. Applicants (Only if pending)
            let appData = [];
            if (projectData.status === 'pending') {
                const { data } = await supabase
                    .from('project_applications')
                    .select('*, profiles:provider_id(full_name, city, avatar_url, rating)')
                    .eq('project_id', id)
                    .eq('status', 'pending')
                    .order('bid_amount', { ascending: true }); // Cheapest first
                appData = data || [];
            }

            // D. Updates (The Timeline)
            const { data: updatesData } = await supabase
                .from('project_updates')
                .select('*')
                .eq('project_id', id)
                .order('created_at', { ascending: false });

            // E. Review
            const { data: reviewData } = await supabase
                .from('reviews')
                .select('*')
                .eq('project_id', id)
                .maybeSingle();

            setProject(projectData);
            setExpenses(expData || []);
            setApplications(appData || []);
            setUpdates(updatesData || []);
            setReview(reviewData || null);

        } catch (e: any) {
            console.error("Error loading project:", e.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // --- ANIMATION CONFIG ---
    const headerTranslateY = scrollY.interpolate({
        inputRange: [0, HEADER_HEIGHT],
        outputRange: [0, -HEADER_HEIGHT / 2],
        extrapolate: 'clamp',
    });
    const imageScale = scrollY.interpolate({
        inputRange: [-HEADER_HEIGHT, 0],
        outputRange: [2, 1],
        extrapolate: 'clamp',
    });

    // --- HANDLERS ---

    const handleReleaseFunds = async () => {
        if (!paymentAmount || !paymentDesc) {
            Alert.alert("Missing Info", "Please enter an amount and description.");
            return;
        }

        setProcessingPayment(true);
        try {
            // Using RPC for safe transaction
            const { error } = await supabase.rpc('release_milestone', {
                p_project_id: id,
                p_provider_id: project.assigned_provider_id,
                p_amount: parseFloat(paymentAmount),
                p_desc: paymentDesc
            });

            if (error) throw error;

            successFeedback();
            Alert.alert("Success", "Funds released to provider.");
            setShowPaymentModal(false);
            setPaymentAmount('');
            setPaymentDesc('');
            fetchData();
        } catch (err: any) {
            Alert.alert("Payment Failed", err.message);
        } finally {
            setProcessingPayment(false);
        }
    };

    const handleCompleteProject = async () => {
        setSubmittingReview(true);
        try {
            const { error } = await supabase.from('reviews').insert({
                project_id: id,
                provider_id: project.assigned_provider_id,
                client_id: project.owner_id,
                rating,
                comment: reviewText
            });

            if (error) throw error;

            await supabase.from('projects').update({ status: 'completed' }).eq('id', id);

            successFeedback();
            setShowCompleteModal(false);
            fetchData();
        } catch (e: any) {
            Alert.alert("Error", e.message);
        } finally {
            setSubmittingReview(false);
        }
    };

    // Helper: Render Stars
    const renderStars = (current: number, interactive = false) => (
        <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map(num => (
                <TouchableOpacity key={num} disabled={!interactive} onPress={() => setRating(num)}>
                    <Ionicons name={num <= current ? "star" : "star-outline"} size={24} color={theme.colors.warning} />
                </TouchableOpacity>
            ))}
        </View>
    );

    if (loading || !project) {
        return <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.text} /></View>;
    }

    // Status Helpers
    const totalSpent = expenses.reduce((sum, item) => sum + (item.amount || 0), 0);
    const isPending = project.status === 'pending';
    const isCompleted = project.status === 'completed';

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <StatusBar barStyle="light-content" />

            {/* --- HEADER --- */}
            <Animated.View style={[styles.headerContainer, { transform: [{ translateY: headerTranslateY }] }]}>
                <Animated.Image
                    source={{ uri: project.image_url || 'https://images.unsplash.com/photo-1503387762-592deb58ef4e' }}
                    style={[styles.headerImage, { transform: [{ scale: imageScale }] }]}
                />
                <LinearGradient colors={['rgba(0,0,0,0.1)', 'rgba(15, 23, 42, 0.9)']} style={styles.gradient} />
                <View style={styles.headerContent}>
                    <View style={[styles.statusBadge, isPending ? styles.bgWarning : styles.bgSuccess]}>
                        <Text style={[styles.statusText, isPending ? styles.textWarning : styles.textSuccess]}>
                            {project.status.replace('_', ' ').toUpperCase()}
                        </Text>
                    </View>
                    <Text style={styles.headerTitle}>{project.title}</Text>
                    <View style={styles.locationRow}>
                        <Ionicons name="location" size={16} color={theme.colors.textSubtle} />
                        <Text style={styles.headerLoc}>{project.city}</Text>
                    </View>
                </View>
            </Animated.View>

            {/* --- NAV BAR --- */}
            <View style={styles.navBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.navBtn}>
                    <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* --- SCROLL CONTENT --- */}
            <Animated.ScrollView
                contentContainerStyle={{ paddingTop: HEADER_HEIGHT - 30, paddingBottom: 140 }}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
            >
                <View style={styles.body}>

                    {/* 1. Glass Metrics */}
                    <View style={styles.metricsContainer}>
                        <BlurView intensity={30} tint="light" style={styles.glassRow}>
                            <View style={styles.metricItem}>
                                <Text style={styles.metricLabel}>Budget</Text>
                                <Text style={styles.metricValue}>{(project.budget / 1000).toFixed(0)}k</Text>
                            </View>
                            <View style={styles.metricDivider} />
                            <View style={styles.metricItem}>
                                <Text style={styles.metricLabel}>Spent</Text>
                                <Text style={styles.metricValue}>{(totalSpent / 1000).toFixed(0)}k</Text>
                            </View>
                            <View style={styles.metricDivider} />
                            <View style={styles.metricItem}>
                                <Text style={styles.metricLabel}>Remaining</Text>
                                <Text style={[styles.metricValue, { color: '#16A34A' }]}>{((project.budget - totalSpent) / 1000).toFixed(0)}k</Text>
                            </View>
                        </BlurView>
                    </View>

                    {/* 2. Overview */}
                    <Text style={styles.sectionTitle}>Overview</Text>
                    <Text style={styles.description}>{project.description || "No description available."}</Text>

                    {!isPending && (
                        <View style={styles.section}>
                            <BudgetProgress totalBudget={project.budget} spent={totalSpent} />
                        </View>
                    )}

                    {/* 3. Expenses List (If Approved) */}
                    {!isPending && expenses.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.subTitle}>Recent Expenses</Text>
                            {expenses.map((item) => (
                                <View key={item.id} style={styles.expenseRow}>
                                    <View style={styles.expenseIcon}>
                                        <Ionicons name="receipt-outline" size={16} color="#64748B" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.expenseTitle}>{item.description || "Milestone Payment"}</Text>
                                        <Text style={styles.expenseDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
                                    </View>
                                    <Text style={styles.expenseAmount}>-{item.amount?.toLocaleString()} CFA</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* 4. Provider / Applicants (UPDATED LINK) */}
                    <View style={{ marginTop: 24, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.sectionTitle}>
                            {isPending ? `Applicants (${applications.length})` : "Contractor"}
                        </Text>

                        {/* Link to Review Proposals Screen */}
                        {isPending && applications.length > 0 && (
                            <TouchableOpacity onPress={() => router.push(`/diaspora/project/proposals?id=${id}`)}>
                                <Text style={{ color: '#0EA5E9', fontWeight: '700', fontSize: 14 }}>Review All</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {isPending ? (
                        applications.length === 0 ? (
                            <View style={styles.emptyCard}>
                                <Ionicons name="people-outline" size={32} color="#CBD5E1" />
                                <Text style={styles.emptyText}>Waiting for providers...</Text>
                            </View>
                        ) : (
                            // Show top 3 max, guide user to click "View" to see details
                            applications.slice(0, 3).map((app) => (
                                <View key={app.id} style={styles.applicantCard}>
                                    <View style={styles.applicantInfo}>
                                        <Image source={{ uri: app.profiles?.avatar_url || 'https://i.pravatar.cc/150' }} style={styles.avatar} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.appName}>{app.profiles?.full_name}</Text>
                                            <Text style={styles.appRating}>⭐ {app.profiles?.rating || 'New'} • Bid: {app.bid_amount?.toLocaleString()}</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.hireBtn, { backgroundColor: '#F1F5F9' }]}
                                        onPress={() => router.push(`/diaspora/project/proposals?id=${id}`)}
                                    >
                                        <Text style={[styles.hireText, { color: '#0F172A' }]}>View</Text>
                                    </TouchableOpacity>
                                </View>
                            ))
                        )
                    ) : (
                        <View style={styles.activeProviderCard}>
                            <Image source={{ uri: project.profiles?.avatar_url || 'https://i.pravatar.cc/150' }} style={styles.largeAvatar} />
                            <View style={{ flex: 1, paddingHorizontal: 12 }}>
                                <Text style={styles.provName}>{project.profiles?.full_name}</Text>
                                <Text style={styles.provStatus}>Verified Professional</Text>
                            </View>
                            <TouchableOpacity style={styles.callBtn} onPress={() => { mediumFeedback(); router.push(`/chat/${id}`); }}>
                                <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* 5. Live Timeline (Project Updates) */}
                    {!isPending && (
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Site Activity</Text>
                            {updates.length === 0 ? (
                                <View style={styles.emptyTimeline}>
                                    <View style={styles.dashedLine} />
                                    <Text style={styles.emptyText}>Provider has not posted updates yet.</Text>
                                </View>
                            ) : (
                                updates.map((update, index) => (
                                    <View key={update.id} style={styles.timelineItem}>
                                        <View style={styles.timelineLeft}>
                                            <View style={styles.timelineDot} />
                                            {index !== updates.length - 1 && <View style={styles.timelineLine} />}
                                        </View>

                                        <View style={styles.timelineContent}>
                                            <View style={styles.timelineHeader}>
                                                <Text style={styles.updateTitle}>{update.title || "Update"}</Text>
                                                <Text style={styles.updateDate}>
                                                    {new Date(update.created_at).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                                                </Text>
                                            </View>

                                            <Text style={styles.updateDesc}>{update.description}</Text>

                                            {update.image_url && (
                                                <TouchableOpacity onPress={() => { mediumFeedback(); setSelectedImage(update.image_url); }}>
                                                    <Image source={{ uri: update.image_url }} style={styles.updateImage} />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>
                    )}

                    {/* 6. Reviews */}
                    {isCompleted && review && (
                        <View style={styles.reviewDisplay}>
                            <Text style={styles.reviewHeader}>Your Rating</Text>
                            <View style={styles.reviewContent}>
                                {renderStars(review.rating)}
                                <Text style={styles.reviewComment}>"{review.comment}"</Text>
                            </View>
                        </View>
                    )}

                </View>
            </Animated.ScrollView>

            {/* --- ACTION BAR (Bottom) --- */}
            {!isPending && !isCompleted && (
                <View style={styles.actionBar}>
                    <TouchableOpacity style={styles.actionPayBtn} onPress={() => setShowPaymentModal(true)}>
                        <Ionicons name="wallet-outline" size={20} color="#fff" />
                        <Text style={styles.actionPayText}>Release Funds</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionDoneBtn} onPress={() => setShowCompleteModal(true)}>
                        <Text style={styles.actionDoneText}>Complete</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* --- MODALS --- */}

            {/* 1. Payment Modal */}
            <Modal visible={showPaymentModal} transparent animationType="slide">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <TouchableOpacity style={{flex:1}} onPress={() => setShowPaymentModal(false)} />
                    <View style={styles.modalCard}>
                        <View style={styles.modalHandle} />
                        <Text style={styles.modalTitle}>Release Payment</Text>
                        <Text style={styles.modalSub}>Safe transfer from escrow to provider.</Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Amount (CFA)</Text>
                            <TextInput style={styles.input} placeholder="0" keyboardType="numeric" value={paymentAmount} onChangeText={setPaymentAmount} />
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Note</Text>
                            <TextInput style={styles.input} placeholder="e.g. For materials" value={paymentDesc} onChangeText={setPaymentDesc} />
                        </View>

                        <View style={styles.modalBtns}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPaymentModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.confirmBtn} onPress={handleReleaseFunds} disabled={processingPayment}>
                                {processingPayment ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Confirm</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* 2. Review Modal */}
            <Modal visible={showCompleteModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Project Complete</Text>
                        <Text style={styles.modalSub}>Please rate the contractor.</Text>
                        <View style={{ marginVertical: 20 }}>{renderStars(rating, true)}</View>
                        <TextInput style={styles.inputArea} placeholder="Write a review..." multiline value={reviewText} onChangeText={setReviewText} />
                        <View style={styles.modalBtns}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCompleteModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.confirmBtn} onPress={handleCompleteProject} disabled={submittingReview}>
                                {submittingReview ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Finish</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* 3. Image Zoom Modal */}
            <Modal visible={!!selectedImage} transparent animationType="fade">
                <View style={styles.zoomOverlay}>
                    <TouchableOpacity style={styles.closeZoom} onPress={() => setSelectedImage(null)}>
                        <Ionicons name="close-circle" size={40} color="#fff" />
                    </TouchableOpacity>
                    <Image source={{ uri: selectedImage || '' }} style={styles.zoomedImage} resizeMode="contain" />
                </View>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    headerContainer: { position: 'absolute', top: 0, left: 0, right: 0, height: HEADER_HEIGHT, overflow: 'hidden', zIndex: 0 },
    headerImage: { width: '100%', height: HEADER_HEIGHT, resizeMode: 'cover' },
    gradient: { ...StyleSheet.absoluteFillObject },
    headerContent: { position: 'absolute', bottom: 40, left: 20, right: 20 },

    statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 10 },
    bgWarning: { backgroundColor: 'rgba(245, 158, 11, 0.2)' },
    bgSuccess: { backgroundColor: 'rgba(22, 163, 74, 0.2)' },
    statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
    textWarning: { color: '#FCD34D' },
    textSuccess: { color: '#4ADE80' },

    headerTitle: { fontSize: 32, fontWeight: '800', color: '#fff', marginBottom: 4 },
    headerLoc: { color: '#E2E8F0', fontSize: 16, fontWeight: '600' },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

    navBar: { position: 'absolute', top: 50, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', zIndex: 10 },
    navBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' },

    body: { backgroundColor: theme.colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: theme.spacing.xl, paddingBottom: 40, minHeight: 800 },

    metricsContainer: { marginTop: -40, marginBottom: 24 },
    glassRow: { flexDirection: 'row', backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg, padding: theme.spacing.md, ...theme.shadow.soft, justifyContent: 'space-between' },
    metricItem: { alignItems: 'center', flex: 1 },
    metricLabel: { fontSize: 11, color: theme.colors.textMuted, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
    metricValue: { fontSize: 16, fontWeight: '800', color: theme.colors.text },
    metricDivider: { width: 1, height: 24, backgroundColor: theme.colors.border },

    sectionTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text, marginBottom: theme.spacing.sm },
    subTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.textMuted, marginBottom: theme.spacing.sm, textTransform: 'uppercase', marginTop: theme.spacing.sm },
    description: { fontSize: 15, color: '#475569', lineHeight: 24, marginBottom: 20 },
    section: { marginBottom: 24 },

    // Expense Styles
    expenseRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 8, gap: 12 },
    expenseIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    expenseTitle: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
    expenseDate: { fontSize: 12, color: '#94A3B8' },
    expenseAmount: { fontSize: 14, fontWeight: '700', color: '#EF4444' },

    // Timeline Styles
    timelineItem: { flexDirection: 'row' },
    timelineLeft: { width: 24, alignItems: 'center', marginRight: 12 },
    timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#0F172A', borderWidth: 2, borderColor: '#fff', zIndex: 10 },
    timelineLine: { width: 2, flex: 1, backgroundColor: '#E2E8F0', position: 'absolute', top: 12, bottom: -12 },
    timelineContent: { flex: 1, backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5 },
    timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    updateTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
    updateDate: { fontSize: 12, color: '#94A3B8' },
    updateDesc: { color: '#334155', lineHeight: 20 },
    updateImage: { width: '100%', height: 160, borderRadius: 12, marginTop: 12 },

    emptyTimeline: { alignItems: 'center', padding: 20 },
    dashedLine: { height: 40, width: 1, borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E1', marginBottom: 10 },
    emptyText: { color: '#94A3B8', fontWeight: '500' },

    // Provider / Applicant
    emptyCard: { alignItems: 'center', padding: 30, borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed', borderRadius: 16 },
    emptyText: { color: '#94A3B8', marginTop: 8, fontWeight: '600' },
    applicantCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5 },
    applicantInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E2E8F0' },
    appName: { fontWeight: '700', color: '#0F172A', fontSize: 15 },
    appRating: { fontSize: 12, color: '#64748B' },
    hireBtn: { backgroundColor: '#0F172A', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
    hireText: { color: '#fff', fontWeight: '700', fontSize: 12 },

    activeProviderCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', padding: 20, borderRadius: 20, shadowColor: '#0F172A', shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
    largeAvatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: '#fff' },
    provName: { color: '#fff', fontSize: 18, fontWeight: '700' },
    provStatus: { color: '#94A3B8', fontSize: 13 },
    callBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },

    // Actions & Reviews
    actionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: theme.colors.surface, flexDirection: 'row', padding: theme.spacing.lg, gap: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.border },
    actionPayBtn: { flex: 2, backgroundColor: theme.colors.primary, borderRadius: theme.radii.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, gap: theme.spacing.sm },
    actionPayText: { color: theme.colors.surface, fontWeight: '700', fontSize: 16 },
    actionDoneBtn: { flex: 1, backgroundColor: theme.colors.success + '18', borderRadius: theme.radii.sm, alignItems: 'center', justifyContent: 'center', height: 50, borderWidth: 1, borderColor: theme.colors.success + '50' },
    actionDoneText: { color: theme.colors.success, fontWeight: '700', fontSize: 16 },

    reviewDisplay: { marginTop: 10, padding: 16, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
    reviewHeader: { fontWeight: '700', marginBottom: 8, color: '#0F172A' },
    reviewContent: { gap: 6 },
    reviewComment: { color: '#334155', fontStyle: 'italic' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 10 },
    modalHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
    modalTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
    modalSub: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 10 },
    inputGroup: { marginBottom: 16 },
    label: { fontWeight: '700', color: '#64748B', marginBottom: 6 },
    input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, fontSize: 16, color: '#0F172A' },
    starRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
    inputArea: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 16, minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: '#E2E8F0', fontSize: 16 },
    modalBtns: { flexDirection: 'row', gap: 12, marginTop: 10 },
    cancelBtn: { flex: 1, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
    cancelText: { fontWeight: '700', color: '#64748B' },
    confirmBtn: { flex: 1, padding: theme.spacing.md, borderRadius: theme.radii.sm, backgroundColor: theme.colors.active, alignItems: 'center' },
    confirmText: { fontWeight: '700', color: theme.colors.surface },

    // Zoom
    zoomOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
    zoomedImage: { width: width, height: height * 0.7 },
    closeZoom: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
});
