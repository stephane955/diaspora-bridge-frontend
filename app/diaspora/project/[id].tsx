import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, Image, TouchableOpacity,
    ActivityIndicator, Dimensions, StatusBar, Alert, RefreshControl, TextInput, Modal, Animated, KeyboardAvoidingView, Platform, Linking
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
import NavigationBar from '@/components/NavigationBar';
import { theme } from '@/constants/theme';
import { generateAndShareReceipt } from '@/utils/pdfReceipt';
import { getProjectAccessRole, createObserverInvite } from '@/utils/observers';
import { getContractHtml, uploadContractPdfFromUri } from '@/utils/contractPdf';

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

            setProject(projectData);
            setExpenses(expData || []);
            setApplications(appData || []);
            setUpdates(updatesData || []);
            setMilestones(milestonesData || []);
            setReview(reviewData || null);
            setContract(contractData);

        } catch (e: any) {
            console.error("Error loading project:", e.message);
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

    // Deep link: open approval modal when notification action was "Approve" / "View Proof"
    const openApprovalHandled = useRef(false);
    useEffect(() => {
        if (openApproval === '1' && nextReleasableMilestone && !openApprovalHandled.current) {
            openApprovalHandled.current = true;
            setPaymentAmount(String(nextReleasableMilestone.amount ?? ''));
            setShowPaymentModal(true);
        }
    }, [openApproval, nextReleasableMilestone]);

    // Sequential escrow: step N+1 stays locked until step N is paid
    const nextReleasableMilestone = milestones.find((m: any) => m.status === 'locked');
    const hasReleasableStep = !!nextReleasableMilestone;

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

    if (loading || !project) {
        return <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.text} /></View>;
    }

    // Status Helpers
    const approvedExpenses = expenses.filter((e: any) => e.status === 'approved');
    const totalSpent = approvedExpenses.reduce((sum, item) => sum + (item.amount || 0), 0);
    const materialExpenses = expenses.filter((e: any) => e.type === 'material');
    const pendingMaterial = materialExpenses.filter((e: any) => e.status === 'pending');
    const isPending = project.status === 'pending';
    const isCompleted = project.status === 'completed';
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

                    {/* Invite Observer (owner only) */}
                    {isOwner && !isPending && (
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
    materialBudgetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: theme.colors.surfaceAlt, borderRadius: 12, marginBottom: 8 },
    approveExpenseBtn: { backgroundColor: theme.colors.success, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    approveExpenseText: { color: '#fff', fontWeight: '700', fontSize: 12 },

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
