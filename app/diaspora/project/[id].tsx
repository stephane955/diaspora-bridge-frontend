import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, Image, TouchableOpacity,
    ActivityIndicator, Dimensions, StatusBar, Alert, RefreshControl, TextInput, Modal, Animated, KeyboardAvoidingView, Platform, Linking
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MessageCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YStack, XStack } from 'tamagui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { mediumFeedback, successFeedback } from '@/utils/haptics';
import NavigationBar from '@/components/NavigationBar';
import { theme } from '@/constants/theme';
import { generateAndShareReceipt } from '@/utils/pdfReceipt';
import { getProjectAccessRole, createObserverInvite } from '@/utils/observers';
import { getContractHtml, uploadContractPdfFromUri } from '@/utils/contractPdf';
import ClientApprovalCard from '@/components/ClientApprovalCard';

const NAVY = '#0F172A';
const SLATE = '#1E293B';
const GOLD = '#D4AF37';

const { width, height } = Dimensions.get('window');
const HEADER_HEIGHT = 300;

export default function ProjectDetailsScreen() {
    const insets = useSafeAreaInsets();
    const { id, openApproval } = useLocalSearchParams<{ id: string; openApproval?: string }>();
    const router = useRouter();
    const { t } = useLanguage();
    const { user } = useAuth();
    const scrollY = useRef(new Animated.Value(0)).current;

    // --- DATA STATE ---
    const [project, setProject] = useState<any>(null);
    const [projectAccessRole, setProjectAccessRole] = useState<'owner' | 'provider' | 'observer' | null>(null);
    const [observerInviteLink, setObserverInviteLink] = useState<string | null>(null);
    const [showObserverInviteModal, setShowObserverInviteModal] = useState(false);
    const [contract, setContract] = useState<any>(null);
    const [showContractModal, setShowContractModal] = useState(false);
    const [contractSignName, setContractSignName] = useState('');
    const [signingContract, setSigningContract] = useState(false);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [applications, setApplications] = useState<any[]>([]);
    const [updates, setUpdates] = useState<any[]>([]);
    const [milestones, setMilestones] = useState<any[]>([]);
    const [review, setReview] = useState<any | null>(null);
    const [materialCart, setMaterialCart] = useState<any | null>(null);
    const [supplierName, setSupplierName] = useState<string | null>(null);
    const [defects, setDefects] = useState<any[]>([]);
    const [showDefectModal, setShowDefectModal] = useState(false);
    const [defectDescription, setDefectDescription] = useState('');
    const [submittingDefect, setSubmittingDefect] = useState(false);

    // --- UI STATE ---
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [updatesError, setUpdatesError] = useState<string | null>(null);
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
        setLoadError(null);
        setUpdatesError(null);
        try {
            // A. Project & Provider (incl. dispute for arbitration)
            const { data: projectData, error: projError } = await supabase
                .from('projects')
                .select('*, profiles:assigned_provider_id(full_name, avatar_url, city, rating)')
                .eq('id', id)
                .single();

            if (projError) throw projError;

            // B. Expenses (all: approved + pending for material ledger)
            const { data: expData } = await supabase
                .from('project_expenses')
                .select('*')
                .eq('project_id', id)
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
            const { data: updatesData, error: updatesErr } = await supabase
                .from('project_updates')
                .select('*')
                .eq('project_id', id)
                .order('created_at', { ascending: false });
            if (updatesErr) {
                setUpdatesError('We could not load photo updates right now. Pull to refresh and try again.');
            }

            // E. Review
            const { data: reviewData } = await supabase
                .from('reviews')
                .select('*')
                .eq('project_id', id)
                .maybeSingle();

            // F. Milestones (for sequential escrow: step N+1 locked until N paid)
            const { data: milestonesData } = await supabase
                .from('milestones')
                .select('*')
                .eq('project_id', id)
                .order('step_order', { ascending: true });

            // G. Contract (e-signature)
            let contractData = null;
            const { data: contractRow } = await supabase.from('project_contracts').select('*').eq('project_id', id).maybeSingle();
            if (contractRow) contractData = contractRow;
            else if (milestonesData?.length) {
                const { data: inserted } = await supabase.from('project_contracts').insert({ project_id: id }).select().single();
                if (inserted) contractData = inserted;
            }

            // H. Material cart (B2B supply chain) — latest cart per project
            const { data: cartData } = await supabase.from('project_material_carts').select('*').eq('project_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle();
            setMaterialCart(cartData || null);
            if (cartData?.supplier_id) {
                const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', cartData.supplier_id).maybeSingle();
                setSupplierName(prof?.full_name || null);
            } else setSupplierName(null);

            // I. Defects (handoff / warranty)
            const { data: defectsData } = await supabase.from('project_defects').select('*').eq('project_id', id).order('created_at', { ascending: false });
            setDefects(defectsData || []);

            setProject(projectData);
            setExpenses(expData || []);
            setApplications(appData || []);
            setUpdates(updatesData || []);
            setMilestones(milestonesData || []);
            setReview(reviewData || null);
            setContract(contractData);

        } catch (e: any) {
            setLoadError(e?.message || 'Could not load project data.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Live milestones: when RPC updates milestone (e.g. release), refetch so UI updates instantly
    useEffect(() => {
        if (!id) return;
        const channel = supabase
            .channel(`milestones:${id}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'milestones', filter: `project_id=eq.${id}` },
                () => { fetchData(); }
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'milestones', filter: `project_id=eq.${id}` },
                () => { fetchData(); }
            )
            .subscribe();
        return () => supabase.removeChannel(channel);
    }, [id, fetchData]);

    useEffect(() => {
        if (!id || !user?.id) return;
        getProjectAccessRole(id as string, user.id).then(setProjectAccessRole);
    }, [id, user?.id]);

    // Sequential escrow: step N+1 stays locked until step N is paid
    const nextReleasableMilestone = milestones.find((m: any) => m.status === 'locked');
    const hasReleasableStep = !!nextReleasableMilestone;

    // Deep link: open approval modal when notification action was "Approve" / "View Proof"
    const openApprovalHandled = useRef(false);
    useEffect(() => {
        if (openApproval === '1' && nextReleasableMilestone && !openApprovalHandled.current) {
            openApprovalHandled.current = true;
            setPaymentAmount(String(nextReleasableMilestone.amount ?? ''));
            setShowPaymentModal(true);
        }
    }, [openApproval, nextReleasableMilestone]);

    // Pulsing Live badge
    const liveOpacity = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        if (!isCommandCenter || isCompleted) return;
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(liveOpacity, { toValue: 0.5, duration: 800, useNativeDriver: true }),
                Animated.timing(liveOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, [isCommandCenter, isCompleted]);

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
            try {
                await generateAndShareReceipt({
                    projectTitle: project?.title ?? 'Project',
                    amount: `${parseFloat(paymentAmount).toLocaleString()} CFA`,
                    currency: 'CFA',
                    date: new Date().toLocaleDateString(),
                    description: paymentDesc,
                });
            } catch (_) { /* share optional */ }
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

    const handleContractSign = async () => {
        if (!contract || !contractSignName.trim() || !user?.id) return;
        const now = new Date().toISOString();
        setSigningContract(true);
        try {
            if (isOwner && !contract.client_signed_at) {
                await supabase.from('project_contracts').update({
                    client_signed_at: now,
                    updated_at: now,
                }).eq('project_id', id);
            } else if (isProvider && !contract.provider_signed_at) {
                await supabase.from('project_contracts').update({
                    provider_signed_at: now,
                    updated_at: now,
                }).eq('project_id', id);
            }
            const { data: updated } = await supabase.from('project_contracts').select('*').eq('project_id', id).single();
            setContract(updated);
            setShowContractModal(false);
            setContractSignName('');
            if (updated?.client_signed_at && updated?.provider_signed_at) {
                const contractData = {
                    projectTitle: project?.title ?? '',
                    projectCity: project?.city ?? '',
                    budget: project?.budget ?? 0,
                    milestones: milestones.map((m: any) => ({ title: m.title, amount: m.amount ?? 0, step_order: m.step_order ?? 0 })),
                    clientSignedAt: updated.client_signed_at,
                    providerSignedAt: updated.provider_signed_at,
                };
                const html = getContractHtml(contractData);
                try {
                    const Print = require('expo-' + 'print') as { printToFileAsync: (opts: { html: string }) => Promise<{ uri: string }> };
                    const { uri } = await Print.printToFileAsync({ html });
                    const pdfUrl = await uploadContractPdfFromUri(id as string, uri);
                    await supabase.from('project_contracts').update({ pdf_url: pdfUrl, updated_at: now }).eq('project_id', id);
                    setContract((c: any) => (c ? { ...c, pdf_url: pdfUrl } : c));
                } catch (_) {
                    /* expo-print not installed or upload failed; contract is still signed */
                }
            }
            fetchData();
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Could not save signature.');
        } finally {
            setSigningContract(false);
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

    if (loading) {
        return <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.text} /></View>;
    }
    if (!project) {
        return (
            <View style={styles.center}>
                <Text style={styles.emptyText}>{loadError || 'Project data is unavailable right now.'}</Text>
                <TouchableOpacity style={styles.inviteObserverBtn} onPress={fetchData}>
                    <Ionicons name="refresh" size={18} color={theme.colors.active} />
                    <Text style={styles.inviteObserverText}>Retry loading project</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Status Helpers
    const approvedExpenses = expenses.filter((e: any) => e.status === 'approved');
    const totalSpent = approvedExpenses.reduce((sum, item) => sum + (item.amount || 0), 0);
    const materialExpenses = expenses.filter((e: any) => e.type === 'material');
    const pendingMaterial = materialExpenses.filter((e: any) => e.status === 'pending');
    const isPending = project.status === 'pending';
    const isCompleted = project.status === 'completed';
    const isCommandCenter = project.status === 'in_progress' || project.status === 'In Progress' || project.status === 'completed';
    const isObserver = projectAccessRole === 'observer';
    const isOwner = projectAccessRole === 'owner';
    const isProvider = projectAccessRole === 'provider';
    const hasActiveDispute = !!project?.dispute_milestone_id;

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <StatusBar barStyle="light-content" />
            <NavigationBar title={project?.title ?? 'Project'} showBack dynamicColor={theme.colors.active} />

            {/* --- HEADER --- */}
            <Animated.View style={[styles.headerContainer, { transform: [{ translateY: headerTranslateY }] }]}>
                <Animated.Image
                    source={{ uri: project.image_url || 'https://images.unsplash.com/photo-1503387762-592deb58ef4e' }}
                    style={[styles.headerImage, { transform: [{ scale: imageScale }] }]}
                />
                <LinearGradient colors={['rgba(0,0,0,0.1)', 'rgba(15, 23, 42, 0.9)']} style={styles.gradient} />
                <View style={styles.headerContent}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        {isCommandCenter && !isCompleted && (
                            <Animated.View style={[styles.liveBadge, { opacity: liveOpacity }]}>
                                <View style={styles.liveDot} />
                                <Text style={styles.liveText}>LIVE</Text>
                            </Animated.View>
                        )}
                        <View style={[styles.statusBadge, isPending ? styles.bgWarning : styles.bgSuccess]}>
                            <Text style={[styles.statusText, isPending ? styles.textWarning : styles.textSuccess]}>
                                {project.status.replace('_', ' ').toUpperCase()}
                            </Text>
                        </View>
                        {isObserver && (
                            <View style={[styles.statusBadge, { backgroundColor: 'rgba(148, 163, 184, 0.3)' }]}>
                                <Text style={[styles.statusText, { color: '#94A3B8' }]}>VIEW ONLY</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.headerTitle}>{project.title}</Text>
                    <View style={styles.locationRow}>
                        <Ionicons name="location" size={16} color={theme.colors.textSubtle} />
                        <Text style={styles.headerLoc}>{project.city}</Text>
                    </View>
                </View>
            </Animated.View>

            {/* --- SCROLL CONTENT --- */}
            <Animated.ScrollView
                contentContainerStyle={{ paddingTop: HEADER_HEIGHT - 30, paddingBottom: 120, paddingHorizontal: theme.spacing.lg }}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
            >
                <View style={styles.body}>

                    {isCommandCenter && (
                        /* ========== PROJECT COMMAND CENTER ========== */
                        <>
                            {/* 1. Financial Dashboard Card */}
                            <View style={styles.metricsContainer}>
                                <BlurView intensity={50} tint="dark" style={styles.financialCard}>
                                    <LinearGradient colors={[NAVY, SLATE] as [string, string]} style={StyleSheet.absoluteFill} />
                                    <YStack gap={16} padding={20}>
                                        <XStack justifyContent="space-between" alignItems="center">
                                            <Text style={styles.financialTitle}>Budget Overview</Text>
                                            <Text style={styles.financialPercent}>{Math.min(100, ((totalSpent / project.budget) * 100)).toFixed(0)}%</Text>
                                        </XStack>
                                        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, (totalSpent / project.budget) * 100)}%` }]} /></View>
                                        <XStack gap={12}>
                                            <View style={styles.gridCol}><Text style={styles.gridLabel}>Total Budget</Text><Text style={styles.gridValue}>{project.budget.toLocaleString()}</Text></View>
                                            <View style={[styles.gridCol, styles.gridBorder]}><Text style={styles.gridLabel}>Total Spent</Text><Text style={[styles.gridValue, { color: '#94A3B8' }]}>{totalSpent.toLocaleString()}</Text></View>
                                            <View style={styles.gridCol}><Text style={styles.gridLabel}>Remaining</Text><Text style={[styles.gridValue, { color: '#4ADE80' }]}>{(project.budget - totalSpent).toLocaleString()}</Text></View>
                                        </XStack>
                                    </YStack>
                                </BlurView>
                            </View>

                            {/* 2. Ablauf Timeline (Milestones) */}
                            {milestones.length > 0 && (
                                <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>Ablauf Timeline</Text>
                                    <YStack gap={0}>
                                        {milestones.map((m: any, idx: number) => {
                                            const isDone = m.status === 'paid' || m.status === 'released';
                                            const isCurrent = m.status === 'locked';
                                            const isFuture = !isDone && !isCurrent;
                                            return (
                                                <View key={m.id} style={[styles.timelineStep, isFuture && styles.timelineStepFaded]}>
                                                    <View style={[styles.timelineDot, isDone && styles.timelineDotDone, isCurrent && styles.timelineDotCurrent]}>
                                                        {isDone && <Ionicons name="checkmark" size={14} color="#fff" />}
                                                    </View>
                                                    {idx < milestones.length - 1 && <View style={[styles.timelineConnector, isDone && styles.timelineConnectorDone]} />}
                                                    <View style={[styles.timelineCard, isCurrent && styles.timelineCardGlow]}>
                                                        <XStack justifyContent="space-between" alignItems="center">
                                                            <Text style={styles.timelineTitle}>{m.title}</Text>
                                                            <Text style={styles.timelineAmount}>{Number(m.amount || 0).toLocaleString()} CFA</Text>
                                                        </XStack>
                                                        <Text style={styles.timelineStatus}>{isDone ? 'Completed' : isCurrent ? 'Current step' : 'Upcoming'}</Text>
                                                    </View>
                                                </View>
                                            );
                                        })}
                                    </YStack>
                                </View>
                            )}

                            {/* 3. Material Cart Action Card */}
                            {materialCart && (
                                <View style={styles.section}>
                                    <Text style={styles.sectionTitle}>Material Cart</Text>
                                    <LinearGradient colors={[SLATE, NAVY] as [string, string]} style={styles.cartActionCard}>
                                        <XStack alignItems="center" justifyContent="space-between" marginBottom={12}>
                                            <Text style={styles.cartSupplier}>{supplierName || 'Supplier'}</Text>
                                            <Text style={styles.cartTotal}>{Number(materialCart.total_amount_cfa || 0).toLocaleString()} CFA</Text>
                                        </XStack>
                                        <View style={styles.cartProgressRow}>
                                            <Text style={[styles.cartProgressLabel, materialCart.status !== 'rejected' && styles.cartProgressLabelActive]}>Pending</Text>
                                            <View style={styles.cartProgressBar}><View style={[styles.cartProgressFill, { width: materialCart.status === 'approved' || materialCart.status === 'collected' ? '50%' : '0%' }]} /></View>
                                            <Text style={[styles.cartProgressLabel, (materialCart.status === 'approved' || materialCart.status === 'collected') && styles.cartProgressLabelActive]}>Funded</Text>
                                            <View style={styles.cartProgressBar}><View style={[styles.cartProgressFill, { width: materialCart.status === 'collected' ? '100%' : '0%' }]} /></View>
                                            <Text style={[styles.cartProgressLabel, materialCart.status === 'collected' && styles.cartProgressLabelActive]}>Collected</Text>
                                        </View>
                                        {isOwner && materialCart.status === 'pending_approval' && (
                                            <ClientApprovalCard cart={{ id: materialCart.id, items: materialCart.items ?? [], total_amount_cfa: Number(materialCart.total_amount_cfa ?? 0) + Number(materialCart.labor_amount_cfa ?? 0), status: materialCart.status, payment_status: materialCart.payment_status }} onApproved={fetchData} />
                                        )}
                                    </LinearGradient>
                                </View>
                            )}

                            {/* Invite Observer */}
                            {isOwner && (
                        <TouchableOpacity
                            style={styles.inviteObserverBtn}
                            onPress={async () => {
                                try {
                                    const { link } = await createObserverInvite(id as string);
                                    setObserverInviteLink(link);
                                    setShowObserverInviteModal(true);
                                } catch (e: any) {
                                    Alert.alert('Error', e.message || 'Could not create invite.');
                                }
                            }}
                        >
                            <Ionicons name="people-outline" size={18} color={theme.colors.active} />
                            <Text style={styles.inviteObserverText}>Invite view-only (family / observer)</Text>
                        </TouchableOpacity>
                            )}

                            {/* 3. Expenses & Material Ledger */}
                            {!isPending && (expenses.length > 0 || isProvider || (project.material_budget != null && project.material_budget > 0)) && (
                        <View style={styles.section}>
                            <Text style={styles.subTitle}>Expenses</Text>
                            {project.material_budget != null && project.material_budget > 0 && (
                                <View style={styles.materialBudgetRow}>
                                    <Text style={styles.expenseTitle}>Material budget</Text>
                                    <Text style={styles.expenseAmount}>{Number(project.material_budget).toLocaleString()} CFA</Text>
                                </View>
                            )}
                            {isProvider && (
                                <TouchableOpacity
                                    style={styles.inviteObserverBtn}
                                    onPress={() => router.push(`/provider/add-receipt?projectId=${id}`)}
                                >
                                    <Ionicons name="receipt-outline" size={18} color={theme.colors.emerald} />
                                    <Text style={[styles.inviteObserverText, { color: theme.colors.emerald }]}>Add material receipt</Text>
                                </TouchableOpacity>
                            )}
                            {pendingMaterial.length > 0 && isOwner && pendingMaterial.map((item: any) => (
                                <View key={item.id} style={[styles.expenseRow, { borderWidth: 1, borderColor: theme.colors.warning + '40' }]}>
                                    {item.receipt_url ? (
                                        <Image source={{ uri: item.receipt_url }} style={{ width: 44, height: 44, borderRadius: 8 }} />
                                    ) : (
                                        <View style={styles.expenseIcon}>
                                            <Ionicons name="receipt-outline" size={16} color="#64748B" />
                                        </View>
                                    )}
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.expenseTitle}>{item.description || "Material receipt"}</Text>
                                        <Text style={styles.expenseDate}>Pending · {new Date(item.created_at).toLocaleDateString()}</Text>
                                    </View>
                                    <Text style={styles.expenseAmount}>{item.amount?.toLocaleString()} CFA</Text>
                                    <TouchableOpacity
                                        style={styles.approveExpenseBtn}
                                        onPress={async () => {
                                            const { error } = await supabase.from('project_expenses').update({ status: 'approved' }).eq('id', item.id);
                                            if (!error) fetchData();
                                        }}
                                    >
                                        <Text style={styles.approveExpenseText}>Approve</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                            {(expenses.filter((e: any) => !(e.type === 'material' && e.status === 'pending' && isOwner))).map((item: any) => (
                                <View key={item.id} style={styles.expenseRow}>
                                    {item.receipt_url ? (
                                        <Image source={{ uri: item.receipt_url }} style={{ width: 44, height: 44, borderRadius: 8 }} />
                                    ) : (
                                        <View style={styles.expenseIcon}>
                                            <Ionicons name={item.type === 'material' ? 'receipt-outline' : 'wallet-outline'} size={16} color="#64748B" />
                                        </View>
                                    )}
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.expenseTitle}>{item.description || (item.type === 'material' ? 'Material' : 'Milestone Payment')}</Text>
                                        <Text style={styles.expenseDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
                                    </View>
                                    <Text style={styles.expenseAmount}>-{item.amount?.toLocaleString()} CFA</Text>
                                </View>
                            ))}
                        </View>
                            )}
                        </>
                    )}

                    <Text style={styles.sectionTitle}>Overview</Text>
                    <Text style={styles.description}>{project.description || "No description available."}</Text>

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

                    {/* 4.4 Handoff & Warranty (30-day retainage) */}
                    {isCompleted && isOwner && (project.warranty_status === 'held' || project.warranty_status === 'frozen') && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Handoff & Warranty</Text>
                            <View style={[styles.glassRow, { padding: 16 }]}>
                                <View>
                                    <Text style={styles.metricLabel}>Retainage (10%)</Text>
                                    <Text style={styles.metricValue}>{Number(project.warranty_retainage_cfa || 0).toLocaleString()} CFA</Text>
                                </View>
                                <View>
                                    <Text style={styles.metricLabel}>Status</Text>
                                    <Text style={[styles.metricValue, { color: project.warranty_status === 'frozen' ? theme.colors.warning : theme.colors.text }]}>
                                        {project.warranty_status === 'frozen' ? 'Frozen (defect reported)' : 'Held (30 days)'}
                                    </Text>
                                </View>
                                {project.warranty_hold_until && (
                                    <View>
                                        <Text style={styles.metricLabel}>Releases</Text>
                                        <Text style={styles.metricValue}>{new Date(project.warranty_hold_until).toLocaleDateString()}</Text>
                                    </View>
                                )}
                            </View>
                            {isOwner && (
                                <TouchableOpacity
                                    style={[styles.inviteObserverBtn, { borderColor: theme.colors.warning + '60', backgroundColor: theme.colors.warning + '15' }]}
                                    onPress={() => setShowDefectModal(true)}
                                >
                                    <Ionicons name="warning-outline" size={18} color={theme.colors.warning} />
                                    <Text style={[styles.inviteObserverText, { color: theme.colors.warning }]}>Report post-completion defect</Text>
                                </TouchableOpacity>
                            )}
                            {defects.length > 0 && (
                                <View style={styles.defectList}>
                                    {defects.map((d) => (
                                        <View key={d.id} style={styles.defectRow}>
                                            <Text style={styles.defectDesc}>{d.description}</Text>
                                            <Text style={styles.defectStatus}>{d.status} · {new Date(d.created_at).toLocaleDateString()}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    )}

                    {/* 4.5 Contract (e-signature) */}
                    {!isPending && contract && milestones.length > 0 && (isOwner || isProvider) && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Contract</Text>
                            {contract.client_signed_at && contract.provider_signed_at ? (
                                <View style={styles.contractSigned}>
                                    <Ionicons name="checkmark-circle" size={24} color={theme.colors.success} />
                                    <Text style={styles.contractSignedText}>Both parties signed</Text>
                                    {contract.pdf_url ? (
                                        <TouchableOpacity onPress={() => Linking.openURL(contract.pdf_url)}>
                                            <Text style={{ color: theme.colors.active, fontWeight: '600', marginTop: 4 }}>View PDF</Text>
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                            ) : (
                                <TouchableOpacity style={styles.inviteObserverBtn} onPress={() => { setContractSignName(''); setShowContractModal(true); }}>
                                    <Ionicons name="document-text-outline" size={18} color={theme.colors.active} />
                                    <Text style={styles.inviteObserverText}>
                                        {(isOwner && !contract.client_signed_at) || (isProvider && !contract.provider_signed_at)
                                            ? 'Sign contract'
                                            : 'View contract'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* 5. Live Timeline (Project Updates) */}
                    {!isPending && (
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Site Activity</Text>
                            {updatesError ? (
                                <View style={styles.emptyTimeline}>
                                    <Ionicons name="cloud-offline-outline" size={28} color={theme.colors.textMuted} />
                                    <Text style={styles.emptyText}>{updatesError}</Text>
                                    <TouchableOpacity style={styles.inviteObserverBtn} onPress={fetchData}>
                                        <Ionicons name="refresh" size={18} color={theme.colors.active} />
                                        <Text style={styles.inviteObserverText}>Retry updates</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : null}
                            {!updatesError && updates.length === 0 ? (
                                <View style={styles.emptyTimeline}>
                                    <View style={styles.dashedLine} />
                                    <Text style={styles.emptyText}>Provider has not posted updates yet.</Text>
                                </View>
                            ) : !updatesError ? (
                                [...updates]
                                    .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                                    .map((update, index) => (
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
                            ) : null}
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

            {/* --- DISPUTE BANNER (Arbitration) --- */}
            {!isPending && !isCompleted && hasActiveDispute && (
                <View style={styles.disputeBar}>
                    <Ionicons name="warning" size={22} color={theme.colors.warning} />
                    <Text style={styles.disputeBarText}>Dispute in progress – milestone locked. Resolution required.</Text>
                    {isOwner && (
                        <TouchableOpacity
                            style={styles.resolveDisputeBtn}
                            onPress={async () => {
                                Alert.alert('Resolve dispute', 'Clear dispute and unlock this milestone?', [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                        text: 'Resolve',
                                        onPress: async () => {
                                            await supabase.from('projects').update({ dispute_milestone_id: null }).eq('id', id);
                                            await supabase.from('milestones').update({ dispute_status: 'resolved' }).eq('id', project.dispute_milestone_id);
                                            const { data: d } = await supabase.from('project_disputes').select('id').eq('project_id', id).eq('status', 'open').maybeSingle();
                                            if (d) await supabase.from('project_disputes').update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: user?.id }).eq('id', d.id);
                                            fetchData();
                                        },
                                    },
                                ]);
                            }}
                        >
                            <Text style={styles.resolveDisputeText}>Resolve</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* --- FAB: Chat with Contractor --- */}
            {isCommandCenter && !isObserver && (
                <TouchableOpacity
                    style={[styles.fab, { right: 20, bottom: (insets?.bottom ?? 0) + 100 }]}
                    onPress={() => { mediumFeedback(); router.push(`/chat/${id}`); }}
                    activeOpacity={0.9}
                >
                    <LinearGradient colors={[GOLD, '#B8860B'] as [string, string]} style={styles.fabGradient}>
                        <MessageCircle size={24} color="#0F172A" strokeWidth={2} />
                    </LinearGradient>
                </TouchableOpacity>
            )}

            {/* --- ACTION BAR (Bottom) --- */}
            {!isPending && !isCompleted && !isObserver && !hasActiveDispute && (
                <View style={styles.actionBar}>
                    <TouchableOpacity
                        style={[styles.actionPayBtn, !hasReleasableStep && styles.actionPayBtnDisabled]}
                        onPress={() => {
                            if (nextReleasableMilestone) {
                                setPaymentAmount(String(nextReleasableMilestone.amount ?? ''));
                                setShowPaymentModal(true);
                            }
                        }}
                        disabled={!hasReleasableStep}
                    >
                        <Ionicons name="wallet-outline" size={20} color="#fff" />
                        <Text style={styles.actionPayText}>
                            {hasReleasableStep ? `Release Funds (Step ${(nextReleasableMilestone?.step_order ?? 1)})` : 'Release Funds'}
                        </Text>
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
                        <Text style={styles.modalSub}>
                            {nextReleasableMilestone
                                ? `Escrow · Step ${nextReleasableMilestone.step_order ?? 1} of ${milestones.length}: ${nextReleasableMilestone.title ?? 'Milestone'}`
                                : 'Safe transfer from escrow to provider.'}
                        </Text>

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
                        {nextReleasableMilestone && (
                            <TouchableOpacity
                                style={styles.disputeMilestoneBtn}
                                onPress={() => {
                                    setShowPaymentModal(false);
                                    Alert.alert('Dispute milestone', 'Freeze escrow and open Arbitration Room for this milestone?', [
                                        { text: 'Cancel', style: 'cancel' },
                                        {
                                            text: 'Dispute',
                                            style: 'destructive',
                                            onPress: async () => {
                                                try {
                                                    await supabase.from('milestones').update({ dispute_status: 'open', disputed_at: new Date().toISOString() }).eq('id', nextReleasableMilestone.id);
                                                    await supabase.from('projects').update({ dispute_milestone_id: nextReleasableMilestone.id }).eq('id', id);
                                                    await supabase.from('project_disputes').insert({
                                                        project_id: id,
                                                        milestone_id: nextReleasableMilestone.id,
                                                        opened_by: user?.id,
                                                        status: 'open',
                                                    });
                                                    fetchData();
                                                    Alert.alert('Dispute opened', 'Funds are frozen. Resolve from the project screen when ready.');
                                                } catch (e: any) {
                                                    Alert.alert('Error', e.message);
                                                }
                                            },
                                        },
                                    ]);
                                }}
                            >
                                <Text style={styles.disputeMilestoneText}>Dispute milestone</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[styles.disputeMilestoneBtn, { marginTop: 4 }]}
                            onPress={() => {
                                Alert.alert('Lock project', 'Escalate to full project lock? This revokes update access and notifies platform admins.', [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                        text: 'Lock project',
                                        style: 'destructive',
                                        onPress: async () => {
                                            try {
                                                const { data, error } = await supabase.rpc('trigger_dispute', { p_project_id: id });
                                                if (error) throw error;
                                                successFeedback();
                                                fetchData();
                                                Alert.alert('Project locked', 'Admins have been notified.');
                                            } catch (e: any) {
                                                Alert.alert('Error', e.message);
                                            }
                                        },
                                    },
                                ]);
                            }}
                        >
                            <Text style={styles.disputeMilestoneText}>Lock project (escalate dispute)</Text>
                        </TouchableOpacity>
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

            {/* 4. Observer Invite Modal */}
            <Modal visible={showObserverInviteModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>View-only invite</Text>
                        <Text style={styles.modalSub}>Share this link. They can view timeline, photos, and chat but cannot release funds.</Text>
                        {observerInviteLink ? (
                            <>
                                <Text style={styles.inviteLinkText} selectable numberOfLines={3}>{observerInviteLink}</Text>
                                <TouchableOpacity
                                    style={styles.confirmBtn}
                                    onPress={async () => {
                                        try {
                                            const Clipboard = (await import('expo-clipboard')).default;
                                            await Clipboard.setStringAsync(observerInviteLink);
                                            Alert.alert('Copied', 'Link copied to clipboard.');
                                        } catch (_) {}
                                    }}
                                >
                                    <Text style={styles.confirmText}>Copy link</Text>
                                </TouchableOpacity>
                            </>
                        ) : null}
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowObserverInviteModal(false); setObserverInviteLink(null); }}>
                            <Text style={styles.cancelText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* 5. Contract Sign Modal */}
            <Modal visible={showContractModal} transparent animationType="slide">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowContractModal(false)} />
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Sign contract</Text>
                        <Text style={styles.modalSub}>Agreed: {project?.title}, {milestones.length} milestone(s).</Text>
                        {(isOwner && !contract?.client_signed_at) || (isProvider && !contract?.provider_signed_at) ? (
                            <>
                                <Text style={styles.label}>Full name</Text>
                                <TextInput style={styles.input} value={contractSignName} onChangeText={setContractSignName} placeholder="Your full name" />
                                <View style={styles.modalBtns}>
                                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowContractModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                                    <TouchableOpacity style={styles.confirmBtn} onPress={handleContractSign} disabled={!contractSignName.trim() || signingContract}>
                                        {signingContract ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>I sign</Text>}
                                    </TouchableOpacity>
                                </View>
                            </>
                        ) : (
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowContractModal(false)}><Text style={styles.cancelText}>Close</Text></TouchableOpacity>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* 6. Report Defect Modal (Handoff / Warranty) */}
            <Modal visible={showDefectModal} transparent animationType="slide">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowDefectModal(false)} />
                    <View style={styles.modalCard}>
                        <View style={styles.modalHandle} />
                        <Text style={styles.modalTitle}>Report post-completion defect</Text>
                        <Text style={styles.modalSub}>This will freeze the 10% retainage until the issue is resolved.</Text>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Description</Text>
                            <TextInput
                                style={styles.inputArea}
                                placeholder="e.g. Roof leak in north corner"
                                value={defectDescription}
                                onChangeText={setDefectDescription}
                                multiline
                            />
                        </View>
                        <View style={styles.modalBtns}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowDefectModal(false); setDefectDescription(''); }}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.confirmBtn}
                                onPress={async () => {
                                    if (!defectDescription.trim() || !id || !user?.id) return;
                                    setSubmittingDefect(true);
                                    try {
                                        await supabase.from('project_defects').insert({
                                            project_id: id,
                                            reported_by: user.id,
                                            description: defectDescription.trim(),
                                            status: 'open',
                                        });
                                        await supabase.from('projects').update({ warranty_status: 'frozen' }).eq('id', id);
                                        successFeedback();
                                        setShowDefectModal(false);
                                        setDefectDescription('');
                                        fetchData();
                                    } catch (e: any) {
                                        Alert.alert('Error', e.message);
                                    } finally {
                                        setSubmittingDefect(false);
                                    }
                                }}
                                disabled={submittingDefect || !defectDescription.trim()}
                            >
                                {submittingDefect ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Report</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
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

    liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(239, 68, 68, 0.9)', marginRight: 8 },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
    liveText: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 1 },
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
    financialCard: { borderRadius: theme.radii.xl, overflow: 'hidden', ...theme.shadow.soft },
    financialTitle: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
    financialPercent: { fontSize: 14, fontWeight: '800', color: '#D4AF37' },
    progressTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: GOLD, borderRadius: 4 },
    gridCol: { flex: 1, alignItems: 'center' },
    gridBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    gridLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
    gridValue: { fontSize: 14, fontWeight: '800', color: '#fff' },
    timelineStep: { flexDirection: 'row', marginBottom: 4, position: 'relative' },
    timelineStepFaded: { opacity: 0.5 },
    timelineDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    timelineDotDone: { backgroundColor: '#D4AF37' },
    timelineDotCurrent: { backgroundColor: theme.colors.active, shadowColor: theme.colors.active, shadowOpacity: 0.6, shadowRadius: 8 },
    timelineConnector: { position: 'absolute', left: 13, top: 28, bottom: -8, width: 2, backgroundColor: theme.colors.border },
    timelineConnectorDone: { backgroundColor: '#D4AF37' },
    timelineCard: { flex: 1, backgroundColor: theme.colors.surface, padding: 16, borderRadius: theme.radii.md, borderWidth: 1, borderColor: theme.colors.border },
    timelineCardGlow: { borderColor: theme.colors.active, shadowColor: theme.colors.active, shadowOpacity: 0.3, shadowRadius: 8 },
    timelineTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
    timelineAmount: { fontSize: 14, fontWeight: '700', color: theme.colors.textMuted },
    timelineStatus: { fontSize: 12, color: theme.colors.textMuted, marginTop: 4 },
    cartActionCard: { padding: 20, borderRadius: theme.radii.lg, overflow: 'hidden', marginBottom: 16 },
    cartSupplier: { fontSize: 16, fontWeight: '700', color: '#fff' },
    cartTotal: { fontSize: 16, fontWeight: '800', color: '#D4AF37' },
    cartProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cartProgressBar: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden' },
    cartProgressFill: { height: '100%', backgroundColor: '#D4AF37', borderRadius: 3 },
    cartProgressLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '700' },
    cartProgressLabelActive: { color: '#D4AF37' },
    fab: { position: 'absolute', width: 58, height: 58, borderRadius: 29, ...theme.shadow.glowEmerald },
    fabGradient: { flex: 1, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
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
    materialBudgetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: theme.colors.surfaceAlt, borderRadius: 12, marginBottom: 8 },
    approveExpenseBtn: { backgroundColor: theme.colors.success, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    approveExpenseText: { color: '#fff', fontWeight: '700', fontSize: 12 },

    glassCard: { padding: theme.spacing.md, borderRadius: theme.radii.lg, borderWidth: 1, borderColor: theme.colors.border, marginBottom: theme.spacing.sm },
    glassCardText: { fontSize: 14, color: theme.colors.text, marginBottom: 4 },
    approveCartBtn: { backgroundColor: theme.colors.emerald, paddingVertical: 14, borderRadius: theme.radii.md, alignItems: 'center', marginTop: 12 },
    approveCartBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
    defectList: { marginTop: 12 },
    defectRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    defectDesc: { fontSize: 14, color: theme.colors.text },
    defectStatus: { fontSize: 12, color: theme.colors.textMuted, marginTop: 4 },

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

    inviteObserverBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radii.sm, marginBottom: 24 },
    inviteObserverText: { fontSize: 14, fontWeight: '600', color: theme.colors.active },
    inviteLinkText: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 12, padding: 8, backgroundColor: theme.colors.surfaceAlt, borderRadius: 8 },
    contractSigned: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: theme.colors.surfaceAlt, borderRadius: 12 },
    contractSignedText: { fontSize: 14, fontWeight: '600', color: theme.colors.text },

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
    actionPayBtnDisabled: { opacity: 0.6 },
    actionPayText: { color: theme.colors.surface, fontWeight: '700', fontSize: 16 },
    actionDoneBtn: { flex: 1, backgroundColor: theme.colors.success + '18', borderRadius: theme.radii.sm, alignItems: 'center', justifyContent: 'center', height: 50, borderWidth: 1, borderColor: theme.colors.success + '50' },
    actionDoneText: { color: theme.colors.success, fontWeight: '700', fontSize: 16 },
    disputeBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md, gap: 10, backgroundColor: theme.colors.warning + '18', borderTopWidth: 1, borderTopColor: theme.colors.warning + '50' },
    disputeBarText: { flex: 1, fontSize: 13, fontWeight: '600', color: theme.colors.text },
    resolveDisputeBtn: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: theme.colors.warning, borderRadius: 8 },
    resolveDisputeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    disputeMilestoneBtn: { marginTop: 8, paddingVertical: 10, alignItems: 'center' },
    disputeMilestoneText: { fontSize: 13, color: theme.colors.danger, fontWeight: '600' },

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
