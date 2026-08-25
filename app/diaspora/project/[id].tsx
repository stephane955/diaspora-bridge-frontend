import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, Image, TouchableOpacity,
    ActivityIndicator, Dimensions, StatusBar, Alert, RefreshControl, TextInput, Modal, Animated, KeyboardAvoidingView, Platform, Linking, ScrollView
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YStack, XStack, Button, Text as TamaguiText } from 'tamagui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { mediumFeedback, successFeedback } from '@/utils/haptics';
import PremiumHeader from '@/components/PremiumHeader';
import { FLOATING_TAB_BAR_HEIGHT, PREMIUM_BG, PREMIUM_GOLD, TEXT_PRIMARY, TEXT_SECONDARY } from '@/constants/layout';
import { theme } from '@/constants/theme';
import { generateAndShareReceipt } from '@/utils/pdfReceipt';
import { getProjectAccessRole, createObserverInvite } from '@/utils/observers';
import { getContractHtml, uploadContractPdfFromUri } from '@/utils/contractPdf';
import ClientApprovalCard from '@/components/ClientApprovalCard';
import ChatRoom from '@/components/ChatRoom';
import EvidenceImage from '@/components/EvidenceImage';
import ProjectChatFab from '@/components/ProjectChatFab';
import ApplicantCard from '@/components/ApplicantCard';
import PremiumEmptyState from '@/components/PremiumEmptyState';
import RequestRevisionSheet from '@/components/RequestRevisionSheet';
import OpenDisputeSheet from '@/components/OpenDisputeSheet';
import FavoriteProviderButton from '@/components/FavoriteProviderButton';
import DownloadReceiptButton from '@/components/DownloadReceiptButton';
import { markProjectChatRead } from '@/lib/chatReadState';

const NAVY = '#0F172A';
const SLATE = '#1E293B';
const GOLD = '#D4AF37';

const { width, height } = Dimensions.get('window');
const HEADER_HEIGHT = 380;
const PHOTO_CARD_WIDTH = width * 0.82;
const PHOTO_CARD_GAP = 14;

export default function ProjectDetailsScreen() {
    const insets = useSafeAreaInsets();
    const { id, openApproval } = useLocalSearchParams<{ id: string; openApproval?: string }>();
    const router = useRouter();
    const { t } = useLanguage();
    const { user } = useAuth();
    const scrollY = useRef(new Animated.Value(0)).current;
    const scrollViewRef = useRef<ScrollView>(null);

    const openProjectChat = useCallback(async () => {
        if (user?.id && id) await markProjectChatRead(user.id, id as string);
        setChatModalVisible(true);
    }, [user?.id, id]);

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
    const [approvingId, setApprovingId] = useState<string | null>(null);
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [revisionTarget, setRevisionTarget] = useState<{ id: string; title: string } | null>(null);
    const [disputeTarget, setDisputeTarget] = useState<{ id: string; title: string } | null>(null);
    const [revisionBusy, setRevisionBusy] = useState(false);
    const [disputeBusy, setDisputeBusy] = useState(false);
    const [chatModalVisible, setChatModalVisible] = useState(false);

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

    // Live milestones: patch local state instantly, then refetch for consistency
    useEffect(() => {
        if (!id) return;
        const channel = supabase
            .channel(`milestones:${id}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'milestones', filter: `project_id=eq.${id}` },
                (payload) => {
                    const updated = payload.new as Record<string, unknown>;
                    if (updated?.id) {
                        setMilestones((prev) =>
                            prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
                        );
                    }
                    fetchData();
                }
            )
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'milestones', filter: `project_id=eq.${id}` },
                () => { fetchData(); }
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [id, fetchData]);

    useEffect(() => {
        if (!id) return;
        const channel = supabase
            .channel(`project_updates:${id}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'project_updates', filter: `project_id=eq.${id}` },
                () => { fetchData(); }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'project_updates', filter: `project_id=eq.${id}` },
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
    const pendingReviewMilestone = milestones.find((m: any) => m.status === 'in_review');
    const hasReleasableStep = !!nextReleasableMilestone;

    // Deep link: scroll to phase approval when notification action was "Approve" / "View Proof"
    const openApprovalHandled = useRef(false);
    useEffect(() => {
        if (openApproval !== '1' || openApprovalHandled.current) return;
        if (pendingReviewMilestone) {
            openApprovalHandled.current = true;
            setTimeout(() => {
                scrollViewRef.current?.scrollTo({ y: 420, animated: true });
            }, 400);
        } else if (nextReleasableMilestone) {
            openApprovalHandled.current = true;
            setPaymentAmount(String(nextReleasableMilestone.amount ?? nextReleasableMilestone.amount_cfa ?? ''));
            setShowPaymentModal(true);
        }
    }, [openApproval, pendingReviewMilestone, nextReleasableMilestone]);

    // Pulsing Live badge — derive flags from project status (avoid TDZ before later consts)
    const liveOpacity = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        const status = project?.status;
        const completed = status === 'completed';
        const commandCenter =
            status === 'in_progress' || status === 'In Progress' || status === 'completed';
        if (!commandCenter || completed) return;
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(liveOpacity, { toValue: 0.5, duration: 800, useNativeDriver: true }),
                Animated.timing(liveOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, [project?.status, liveOpacity]);

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
























































            Alert.alert(t('missingInfo'), t('enterAmountAndDescription'));
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
            Alert.alert(t('success'), t('fundsReleasedToProvider'));
            setShowPaymentModal(false);
            setPaymentAmount('');
            setPaymentDesc('');
            fetchData();
        } catch (err: any) {
            Alert.alert(t('paymentFailed'), err.message);
        } finally {
            setProcessingPayment(false);
        }
    };

    const patchMilestone = useCallback((milestoneId: string, patch: Record<string, unknown>) => {
        setMilestones((prev) =>
            prev.map((m) => (m.id === milestoneId ? { ...m, ...patch } : m))
        );
    }, []);

    const handleApproveMilestone = async (milestoneId: string) => {
        Alert.alert(t('approvePhase'), t('approvePhaseConfirm'), [
            { text: t('cancel'), style: 'cancel' },
            {
                text: t('approvePhase'),
                onPress: async () => {
                    setApprovingId(milestoneId);
                    patchMilestone(milestoneId, { status: 'approved' });
                    try {
                        const { error } = await supabase
                            .from('milestones')
                            .update({ status: 'approved' })
                            .eq('id', milestoneId)
                            .eq('status', 'in_review');
                        if (error) throw error;
                        successFeedback();
                        Alert.alert(t('approvePhase'), t('approvePhaseSuccess'));
                        fetchData();
                    } catch (err: any) {
                        fetchData();
                        Alert.alert(t('error'), err.message || t('couldNotApprovePhase'));
                    } finally {
                        setApprovingId(null);
                    }
                },
            },
        ]);
    };

    const handleRequestRevision = async (reason: string) => {
        if (!revisionTarget || !user?.id || !id) return;
        const milestoneId = revisionTarget.id;
        setRevisionBusy(true);
        setRejectingId(milestoneId);
        patchMilestone(milestoneId, { status: 'in_progress' });
        try {
            const { error } = await supabase
                .from('milestones')
                .update({ status: 'in_progress' })
                .eq('id', milestoneId)
                .eq('status', 'in_review');
            if (error) throw error;

            const chatBody = `${t('revisionChatPrefix', { title: revisionTarget.title })}\n${reason.trim()}`;
            const { error: msgErr } = await supabase.from('messages').insert({
                project_id: id,
                sender_id: user.id,
                content: chatBody,
            } as any);
            if (msgErr) throw msgErr;

            setRevisionTarget(null);
            mediumFeedback();
            Alert.alert(t('revisionSentTitle'), t('revisionSentBody'));
            fetchData();
        } catch (err: any) {
            fetchData();
            Alert.alert(t('errorTitle'), err.message || t('errorTitle'));
        } finally {
            setRevisionBusy(false);
            setRejectingId(null);
        }
    };

    const handleOpenDispute = async (reason: string) => {
        if (!disputeTarget || !user?.id || !id) return;
        setDisputeBusy(true);
        try {
            const { error: dErr } = await supabase.from('disputes').insert({
                project_id: id,
                milestone_id: disputeTarget.id,
                raised_by_id: user.id,
                reason: reason.trim(),
                status: 'open',
            });
            if (dErr) throw dErr;

            const { error: mErr } = await supabase
                .from('milestones')
                .update({
                    status: 'disputed',
                    dispute_status: 'open',
                    disputed_at: new Date().toISOString(),
                })
                .eq('id', disputeTarget.id);
            if (mErr) {
                await supabase
                    .from('milestones')
                    .update({ dispute_status: 'open', disputed_at: new Date().toISOString() })
                    .eq('id', disputeTarget.id);
            }

            await supabase.from('projects').update({ dispute_milestone_id: disputeTarget.id }).eq('id', id);

            await supabase.from('project_disputes').insert({
                project_id: id,
                milestone_id: disputeTarget.id,
                opened_by: user.id,
                status: 'open',
            });

            setDisputeTarget(null);
            Alert.alert(t('disputeOpenedTitle'), t('disputeOpenedBody'));
            fetchData();
        } catch (err: any) {
            Alert.alert(t('errorTitle'), err.message || t('errorTitle'));
        } finally {
            setDisputeBusy(false);
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
            Alert.alert(t('error'), e.message || t('couldNotSaveSignature'));
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
            Alert.alert(t('error'), e.message);
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
        return <View style={styles.center}><ActivityIndicator size="large" color={PREMIUM_GOLD} /></View>;
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
    const isInProgress = !isPending && !isCompleted;
    const isCommandCenter = project.status === 'in_progress' || project.status === 'In Progress' || project.status === 'completed';
    const isObserver = projectAccessRole === 'observer';
    const isOwner = projectAccessRole === 'owner';
    const isProvider = projectAccessRole === 'provider';
    const hasActiveDispute = !!project?.dispute_milestone_id;
    const photoUpdates = updates.filter((u: any) => !!u.image_url);
    const milestoneActivities = milestones
        .filter((m: any) => (m.status === 'in_review' && m.evidence_url) || m.status === 'approved')
        .map((m: any) => ({
            id: `milestone-activity-${m.id}-${m.status}`,
            isMilestoneActivity: true,
            milestoneStatus: m.status,
            title: m.status === 'in_review' ? t('phaseProofForReview') : t('phaseApprovedActivity'),
            description: m.title,
            evidence_path: m.evidence_url,
            created_at: m.updated_at || m.created_at || new Date(0).toISOString(),
        }));
    const reviewGalleryItems = [
        ...photoUpdates,
        ...milestoneActivities.filter((m: any) => m.evidence_path),
    ];
    const combinedActivity = [
        ...updates.map((u: any) => ({ ...u, isMilestoneActivity: false })),
        ...milestoneActivities,
    ].sort(
        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <PremiumHeader
                title={project?.title ?? 'Project'}
                subtitle={project?.city}
                showBack
                fallbackRoute="/diaspora"
                onNotificationsPress={() => router.push('/notifications')}
                menuItems={[
                    { label: 'Settings', icon: 'settings', onPress: () => router.push('/diaspora/settings') },
                    { label: 'Profile', icon: 'profile', onPress: () => router.push('/diaspora/profile') },
                ]}
            />

            {/* --- IMMERSIVE HERO --- */}
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
                ref={scrollViewRef as any}
                contentContainerStyle={{ paddingTop: HEADER_HEIGHT - 48, paddingBottom: FLOATING_TAB_BAR_HEIGHT + 120 }}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#D4AF37" />}
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
                                            <Text style={styles.financialTitle}>{t('budgetOverview')}</Text>
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
                                    <Text style={styles.sectionTitle}>{t('ablaufTimeline')}</Text>
                                    <YStack gap={0}>
                                        {milestones.map((m: any, idx: number) => {
                                            const amount = Number(m.amount ?? m.amount_cfa ?? 0);
                                            const isPaid = m.status === 'paid' || m.status === 'released';
                                            const isApproved = m.status === 'approved';
                                            const isInReview = m.status === 'in_review';
                                            const isDone = isPaid;
                                            const isCurrent = !isDone && (m.status === 'locked' || m.status === 'in_progress' || isInReview || isApproved);
                                            const isFuture = !isDone && !isCurrent;
                                            const hasEvidence = !!(m.evidence_url && m.evidence_url !== 'pending');
                                            const statusLabel = isPaid
                                                ? t('completedStep')
                                                : isApproved
                                                    ? t('phaseCompleted')
                                                    : isInReview
                                                        ? t('reviewProofTitle')
                                                        : isCurrent
                                                            ? t('currentStep')
                                                            : t('upcomingStep');
                                            return (
                                                <View key={m.id} style={[styles.timelineStep, isFuture && styles.timelineStepFaded]}>
                                                    <View style={[
                                                        styles.timelineDot,
                                                        isDone && styles.timelineDotDone,
                                                        (isCurrent || isInReview) && styles.timelineDotCurrent,
                                                        isApproved && styles.timelineDotApproved,
                                                    ]}>
                                                        {isDone && <Ionicons name="checkmark" size={14} color="#fff" />}
                                                        {isApproved && !isPaid && <Ionicons name="checkmark-circle" size={14} color="#fff" />}
                                                        {isInReview && <Ionicons name="eye" size={14} color="#fff" />}
                                                    </View>
                                                    {idx < milestones.length - 1 && <View style={[styles.timelineConnector, isDone && styles.timelineConnectorDone]} />}
                                                    <View style={[
                                                        styles.timelineCard,
                                                        isCurrent && styles.timelineCardGlow,
                                                        isInReview && styles.timelineCardReview,
                                                    ]}>
                                                        <XStack justifyContent="space-between" alignItems="center">
                                                            <Text style={styles.timelineTitle}>{m.title}</Text>
                                                            <Text style={styles.timelineAmount}>{amount.toLocaleString()} CFA</Text>
                                                        </XStack>
                                                        <Text style={[
                                                            styles.timelineStatus,
                                                            isInReview && styles.timelineStatusReview,
                                                            isApproved && styles.timelineStatusApproved,
                                                        ]}>
                                                            {statusLabel}
                                                        </Text>

                                                        {isInReview && (
                                                            <View style={styles.evidenceBlock}>
                                                                <Text style={styles.evidenceLabel}>{t('reviewProofTitle')}</Text>
                                                                {hasEvidence ? (
                                                                    <EvidenceImage
                                                                        path={m.evidence_url}
                                                                        style={styles.evidenceImage}
                                                                        onPress={(url) => { mediumFeedback(); setSelectedImage(url); }}
                                                                    />
                                                                ) : (
                                                                    <View style={[styles.evidenceImage, styles.evidenceMissing]}>
                                                                        <Ionicons name="image-outline" size={28} color="#64748B" />
                                                                        <Text style={styles.evidenceMissingText}>Waiting for proof image…</Text>
                                                                    </View>
                                                                )}

                                                                {isOwner && !isObserver && (
                                                                    <YStack gap={12} marginTop={14} width="100%">
                                                                        <Button
                                                                            size="$4"
                                                                            height={52}
                                                                            borderRadius={14}
                                                                            disabled={!!approvingId || !!rejectingId}
                                                                            opacity={approvingId === m.id || rejectingId === m.id ? 0.7 : 1}
                                                                            backgroundColor="#D4AF37"
                                                                            pressStyle={{ backgroundColor: '#B8860B', scale: 0.98 }}
                                                                            onPress={() => handleApproveMilestone(m.id)}
                                                                        >
                                                                            <XStack alignItems="center" justifyContent="center" gap={8}>
                                                                                {approvingId === m.id ? (
                                                                                    <ActivityIndicator color="#0F172A" />
                                                                                ) : (
                                                                                    <Ionicons name="checkmark-circle" size={20} color="#0F172A" />
                                                                                )}
                                                                                <TamaguiText color="#0F172A" fontWeight="800" fontSize={15}>
                                                                                    {t('approvePhase')}
                                                                                </TamaguiText>
                                                                            </XStack>
                                                                        </Button>

                                                                        <Button
                                                                            size="$4"
                                                                            height={52}
                                                                            borderRadius={14}
                                                                            disabled={!!approvingId || !!rejectingId}
                                                                            opacity={approvingId === m.id || rejectingId === m.id ? 0.7 : 1}
                                                                            backgroundColor="rgba(212,175,55,0.16)"
                                                                            borderWidth={1}
                                                                            borderColor="rgba(212,175,55,0.45)"
                                                                            pressStyle={{ backgroundColor: 'rgba(212,175,55,0.28)', scale: 0.98 }}
                                                                            onPress={() => {
                                                                                mediumFeedback();
                                                                                setRevisionTarget({ id: m.id, title: m.title || 'Milestone' });
                                                                            }}
                                                                        >
                                                                            <XStack alignItems="center" justifyContent="center" gap={8}>
                                                                                {rejectingId === m.id ? (
                                                                                    <ActivityIndicator color={PREMIUM_GOLD} />
                                                                                ) : (
                                                                                    <Ionicons name="refresh-circle-outline" size={20} color={PREMIUM_GOLD} />
                                                                                )}
                                                                                <TamaguiText color={PREMIUM_GOLD} fontWeight="700" fontSize={15}>
                                                                                    {t('requestRevision')}
                                                                                </TamaguiText>
                                                                            </XStack>
                                                                        </Button>

                                                                        <TouchableOpacity
                                                                            onPress={() => {
                                                                                mediumFeedback();
                                                                                setDisputeTarget({ id: m.id, title: m.title || 'Milestone' });
                                                                            }}
                                                                            style={{ alignSelf: 'center', paddingVertical: 8 }}
                                                                            disabled={!!approvingId || !!rejectingId || !!disputeBusy}
                                                                        >
                                                                            <Text style={{ color: '#EF4444', fontWeight: '800', fontSize: 13, textDecorationLine: 'underline' }}>
                                                                                {t('openDispute')}
                                                                            </Text>
                                                                        </TouchableOpacity>
                                                                    </YStack>
                                                                )}
                                                            </View>
                                                        )}

                                                        {isPaid && (
                                                            <DownloadReceiptButton
                                                                data={{
                                                                    projectTitle: project?.title ?? 'Project',
                                                                    milestoneTitle: m.title,
                                                                    amount: `${amount.toLocaleString()} CFA`,
                                                                    currency: 'CFA',
                                                                    date: new Date(m.updated_at || m.created_at || Date.now()).toLocaleDateString(),
                                                                    recipient: project?.profiles?.full_name || undefined,
                                                                    description: `Milestone release · ${m.title}`,
                                                                    projectId: String(id),
                                                                    milestoneId: m.id,
                                                                }}
                                                            />
                                                        )}

                                                        {isApproved && !isPaid && (
                                                            <View style={styles.approvedInlineBadge}>
                                                                <Ionicons name="shield-checkmark" size={16} color="#34D399" />
                                                                <Text style={styles.approvedInlineText}>{t('phaseCompleted')}</Text>
                                                            </View>
                                                        )}

                                                        {isApproved && hasEvidence && (
                                                            <View style={styles.evidenceBlock}>
                                                                <EvidenceImage
                                                                    path={m.evidence_url}
                                                                    style={styles.evidenceImage}
                                                                    onPress={(url) => { mediumFeedback(); setSelectedImage(url); }}
                                                                />
                                                            </View>
                                                        )}
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
                                    Alert.alert(t('error'), e.message || t('couldNotCreateInvite'));
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
                            <PremiumEmptyState
                                icon="people-outline"
                                title={t('waitingForProviders') || 'Waiting for providers...'}
                                subtitle={t('applicantsWillAppear') || 'When providers apply, you can compare bids and hire from here.'}
                            />
                        ) : (
                            applications.slice(0, 3).map((app) => (
                                <ApplicantCard
                                    key={app.id}
                                    application={app}
                                    projectId={String(id)}
                                    compact
                                    onPressView={() => router.push(`/diaspora/project/proposals?id=${id}`)}
                                    onHired={() => fetchData()}
                                />
                            ))
                        )
                    ) : (
                        <View style={styles.activeProviderCard}>
                            <Image source={{ uri: project.profiles?.avatar_url || 'https://i.pravatar.cc/150' }} style={styles.largeAvatar} />
                            <View style={{ flex: 1, paddingHorizontal: 12 }}>
                                <Text style={styles.provName}>{project.profiles?.full_name}</Text>
                                <Text style={styles.provStatus}>Verified Professional</Text>
                            </View>
                            <FavoriteProviderButton providerId={project.assigned_provider_id} />
                            <TouchableOpacity
                                style={styles.callBtn}
                                onPress={() => {
                                    mediumFeedback();
                                    openProjectChat();
                                }}
                            >
                                <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    )}

                    {isInProgress && !isObserver && id && (
                        <ProjectChatFab
                            projectId={id as string}
                            bottomOffset={FLOATING_TAB_BAR_HEIGHT + 72}
                            onPress={openProjectChat}
                        />
                    )}

                    {/* Handoff & Warranty (30-day retainage) */}
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
                                    <Text style={[styles.metricValue, { color: project.warranty_status === 'frozen' ? theme.colors.warning : TEXT_PRIMARY }]}>
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
                                            ? t('signContract')
                                            : 'View contract'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* 5. Live Timeline (Project Updates) */}
                    {!isPending && (
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>{t('siteActivity')}</Text>
                            {pendingReviewMilestone && isOwner && !isObserver && (
                                <View style={styles.reviewBanner}>
                                    <Ionicons name="alert-circle" size={20} color={GOLD} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.reviewBannerTitle}>{t('reviewProofTitle')}</Text>
                                        <Text style={styles.reviewBannerSub}>{pendingReviewMilestone.title}</Text>
                                    </View>
                                </View>
                            )}
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
                            {!updatesError && reviewGalleryItems.length > 0 ? (
                                <View style={styles.photoGallerySection}>
                                    <Text style={styles.photoGalleryTitle}>{t('siteActivity')}</Text>
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        decelerationRate="fast"
                                        snapToInterval={PHOTO_CARD_WIDTH + PHOTO_CARD_GAP}
                                        snapToAlignment="start"
                                        contentContainerStyle={styles.photoGalleryRow}
                                    >
                                        {reviewGalleryItems.map((update: any) => (
                                            <View
                                                key={`photo-${update.id}`}
                                                style={[
                                                    styles.photoCardWrap,
                                                    update.isMilestoneActivity && update.milestoneStatus === 'in_review' && styles.photoCardReview,
                                                ]}
                                            >
                                                {update.isMilestoneActivity ? (
                                                    <EvidenceImage
                                                        path={update.evidence_path}
                                                        style={styles.photoGalleryImage}
                                                        onPress={(url) => { mediumFeedback(); setSelectedImage(url); }}
                                                    />
                                                ) : (
                                                    <TouchableOpacity
                                                        activeOpacity={0.95}
                                                        onPress={() => { mediumFeedback(); setSelectedImage(update.image_url); }}
                                                    >
                                                        <Image source={{ uri: update.image_url }} style={styles.photoGalleryImage} />
                                                    </TouchableOpacity>
                                                )}
                                                <LinearGradient
                                                    colors={['transparent', 'rgba(0,0,0,0.85)']}
                                                    style={styles.photoCardGradient}
                                                    pointerEvents="none"
                                                />
                                                {update.isMilestoneActivity && update.milestoneStatus === 'in_review' && (
                                                    <View style={styles.reviewPill} pointerEvents="none">
                                                        <Text style={styles.reviewPillText}>{t('reviewProofTitle')}</Text>
                                                    </View>
                                                )}
                                                <Text style={styles.photoGalleryCaption} numberOfLines={2} pointerEvents="none">
                                                    {update.isMilestoneActivity
                                                        ? update.title
                                                        : update.update_type === 'material_collection'
                                                            ? 'Materials collected'
                                                            : (update.title || 'Site update')}
                                                </Text>
                                            </View>
                                        ))}
                                    </ScrollView>
                                </View>
                            ) : null}
                            {!updatesError && combinedActivity.length === 0 ? (
                                <View style={styles.emptyTimeline}>
                                    <View style={styles.dashedLine} />
                                    <Text style={styles.emptyText}>Provider has not posted updates yet.</Text>
                                </View>
                            ) : !updatesError ? (
                                combinedActivity.map((update: any, index: number) => (
                                    <View key={update.id} style={styles.timelineItem}>
                                        <View style={styles.timelineLeft}>
                                            <View style={[
                                                styles.timelineDot,
                                                update.isMilestoneActivity && update.milestoneStatus === 'in_review' && styles.timelineDotReview,
                                                update.isMilestoneActivity && update.milestoneStatus === 'approved' && styles.timelineDotApprovedSmall,
                                            ]} />
                                            {index !== combinedActivity.length - 1 && <View style={styles.timelineLine} />}
                                        </View>

                                        <View style={[
                                            styles.timelineContent,
                                            update.isMilestoneActivity && update.milestoneStatus === 'in_review' && styles.timelineContentReview,
                                        ]}>
                                            <View style={styles.timelineHeader}>
                                                <Text style={styles.updateTitle}>
                                                    {update.isMilestoneActivity ? update.title : (update.title || 'Update')}
                                                </Text>
                                                <Text style={styles.updateDate}>
                                                    {new Date(update.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                </Text>
                                            </View>

                                            <Text style={styles.updateDesc}>
                                                {update.isMilestoneActivity ? update.description : update.description}
                                            </Text>

                                            {update.isMilestoneActivity && update.evidence_path ? (
                                                <EvidenceImage
                                                    path={update.evidence_path}
                                                    style={styles.updateImage}
                                                    onPress={(url) => { mediumFeedback(); setSelectedImage(url); }}
                                                />
                                            ) : update.image_url ? (
                                                <TouchableOpacity onPress={() => { mediumFeedback(); setSelectedImage(update.image_url); }}>
                                                    <Image source={{ uri: update.image_url }} style={styles.updateImage} />
                                                </TouchableOpacity>
                                            ) : null}
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
                                Alert.alert(t('resolveDisputeTitle'), t('resolveDisputeBody'), [
                                    { text: t('cancel'), style: 'cancel' },
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
                <BlurView intensity={80} tint="dark" style={[styles.actionBar, { bottom: FLOATING_TAB_BAR_HEIGHT - 8 }]}>
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
                </BlurView>
            )}

            {/* Project Chat Modal */}
            <Modal visible={chatModalVisible} animationType="slide" onRequestClose={() => setChatModalVisible(false)}>
                <View style={[styles.chatModalScreen, { paddingTop: insets.top }]}>
                    <View style={styles.chatModalHeader}>
                        <TouchableOpacity
                            onPress={() => setChatModalVisible(false)}
                            style={styles.chatModalClose}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                            <Ionicons name="chevron-down" size={28} color={TEXT_PRIMARY} />
                        </TouchableOpacity>
                        <Text style={styles.chatModalTitle}>{t('projectChatTitle')}</Text>
                        <View style={{ width: 40 }} />
                    </View>
                    {id ? (
                        <ChatRoom
                            projectId={id as string}
                            maxHeight={height - insets.top - insets.bottom - 80}
                            bottomInset={insets.bottom + 8}
                        />
                    ) : null}
                </View>
            </Modal>

            {/* --- MODALS --- */}

            {/* 1. Payment Modal */}
            <Modal visible={showPaymentModal} transparent animationType="slide">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <TouchableOpacity style={{flex:1}} onPress={() => setShowPaymentModal(false)} />
                    <View style={styles.modalCard}>
                        <View style={styles.modalHandle} />
                        <Text style={styles.modalTitle}>{t('releasePayment')}</Text>
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
                                    Alert.alert(t('disputeMilestoneTitle'), t('disputeMilestoneBody'), [
                                        { text: t('cancel'), style: 'cancel' },
                                        {
                                            text: t('disputeMilestoneTitle'),
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
                                                    Alert.alert(t('disputeOpenedAlert'), t('disputeOpenedFundsFrozen'));
                                                } catch (e: any) {
                                                    Alert.alert(t('error'), e.message);
                                                }
                                            },
                                        },
                                    ]);
                                }}
                            >
                                <Text style={styles.disputeMilestoneText}>{t('disputeMilestoneTitle')}</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[styles.disputeMilestoneBtn, { marginTop: 4 }]}
                            onPress={() => {
                                Alert.alert(t('lockProjectTitle'), t('lockProjectBody'), [
                                    { text: t('cancel'), style: 'cancel' },
                                    {
                                        text: t('lockProjectTitle'),
                                        style: 'destructive',
                                        onPress: async () => {
                                            try {
                                                const { data, error } = await supabase.rpc('trigger_dispute', { p_project_id: id });
                                                if (error) throw error;
                                                successFeedback();
                                                fetchData();
                                                Alert.alert(t('projectLockedTitle'), t('projectLockedAdminsNotified'));
                                            } catch (e: any) {
                                                Alert.alert(t('error'), e.message);
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
                                            Alert.alert(t('copied'), t('linkCopied'));
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
                        <Text style={styles.modalTitle}>{t('signContract')}</Text>
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
                                        Alert.alert(t('error'), e.message);
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

            <RequestRevisionSheet
                visible={!!revisionTarget}
                milestoneTitle={revisionTarget?.title}
                loading={revisionBusy}
                onClose={() => !revisionBusy && setRevisionTarget(null)}
                onSubmit={handleRequestRevision}
            />
            <OpenDisputeSheet
                visible={!!disputeTarget}
                milestoneTitle={disputeTarget?.title}
                loading={disputeBusy}
                onClose={() => !disputeBusy && setDisputeTarget(null)}
                onSubmit={handleOpenDispute}
            />

        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: PREMIUM_BG },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    headerContainer: { position: 'absolute', top: 0, left: 0, right: 0, height: HEADER_HEIGHT, overflow: 'hidden', zIndex: 0 },
    headerImage: { width: width, height: HEADER_HEIGHT, resizeMode: 'cover' },
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

    body: { paddingHorizontal: 16, paddingBottom: 40, minHeight: 800 },

    metricsContainer: { marginTop: -24, marginBottom: 20, paddingHorizontal: 4 },
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
    timelineCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', padding: 16, borderRadius: 16 },
    timelineCardGlow: { backgroundColor: 'rgba(37,99,235,0.12)' },
    timelineCardReview: { backgroundColor: 'rgba(212,175,55,0.08)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)' },
    timelineDotApproved: { backgroundColor: '#059669' },
    timelineStatusReview: { color: GOLD, fontWeight: '700' },
    timelineStatusApproved: { color: '#34D399', fontWeight: '700' },
    evidenceBlock: { marginTop: 14 },
    evidenceLabel: { fontSize: 12, fontWeight: '700', color: GOLD, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
    evidenceImage: { width: '100%', height: 200, borderRadius: 14, backgroundColor: '#1E293B' },
    evidenceMissing: { alignItems: 'center', justifyContent: 'center', gap: 8 },
    evidenceMissingText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
    approvedInlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'rgba(52,211,153,0.12)' },
    approvedInlineText: { color: '#34D399', fontWeight: '700', fontSize: 13 },
    reviewBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, marginBottom: 16, backgroundColor: 'rgba(212,175,55,0.12)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
    reviewBannerTitle: { fontSize: 14, fontWeight: '800', color: GOLD },
    reviewBannerSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
    photoCardReview: { borderWidth: 2, borderColor: GOLD },
    reviewPill: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(212,175,55,0.9)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    reviewPillText: { fontSize: 10, fontWeight: '800', color: '#0F172A' },
    timelineDotReview: { backgroundColor: GOLD, borderColor: GOLD },
    timelineDotApprovedSmall: { backgroundColor: '#34D399', borderColor: '#34D399' },
    timelineContentReview: { borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)' },
    timelineTitle: { fontSize: 15, fontWeight: '700', color: '#F8FAFC' },
    timelineAmount: { fontSize: 14, fontWeight: '700', color: '#94A3B8' },
    timelineStatus: { fontSize: 12, color: '#64748B', marginTop: 4 },
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
    metricLabel: { fontSize: 11, color: TEXT_SECONDARY, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
    metricValue: { fontSize: 16, fontWeight: '800', color: TEXT_PRIMARY },
    metricDivider: { width: 1, height: 24, backgroundColor: theme.colors.border },

    sectionTitle: { fontSize: 20, fontWeight: '800', color: TEXT_PRIMARY, marginBottom: 12, letterSpacing: -0.3 },
    subTitle: { fontSize: 13, fontWeight: '700', color: TEXT_SECONDARY, marginBottom: 10, textTransform: 'uppercase', marginTop: 8, letterSpacing: 0.8 },
    description: { fontSize: 15, color: TEXT_SECONDARY, lineHeight: 24, marginBottom: 20 },
    section: { marginBottom: 28, paddingHorizontal: 4 },

    // Expense Styles
    expenseRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', padding: 14, borderRadius: 16, marginBottom: 8, gap: 12 },
    expenseIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    expenseTitle: { fontSize: 14, fontWeight: '600', color: '#F1F5F9' },
    expenseDate: { fontSize: 12, color: '#94A3B8' },
    expenseAmount: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
    materialBudgetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: theme.colors.surfaceAlt, borderRadius: 12, marginBottom: 8 },
    approveExpenseBtn: { backgroundColor: theme.colors.success, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    approveExpenseText: { color: '#fff', fontWeight: '700', fontSize: 12 },

    glassCard: { padding: theme.spacing.md, borderRadius: theme.radii.lg, borderWidth: 1, borderColor: theme.colors.border, marginBottom: theme.spacing.sm },
    glassCardText: { fontSize: 14, color: TEXT_PRIMARY, marginBottom: 4 },
    approveCartBtn: { backgroundColor: theme.colors.emerald, paddingVertical: 14, borderRadius: theme.radii.md, alignItems: 'center', marginTop: 12 },
    approveCartBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
    defectList: { marginTop: 12 },
    defectRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    defectDesc: { fontSize: 14, color: TEXT_PRIMARY },
    defectStatus: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 4 },

    // Timeline Styles
    timelineItem: { flexDirection: 'row' },
    timelineLeft: { width: 24, alignItems: 'center', marginRight: 12 },
    timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#0F172A', borderWidth: 2, borderColor: '#fff', zIndex: 10 },
    timelineLine: { width: 2, flex: 1, backgroundColor: '#E2E8F0', position: 'absolute', top: 12, bottom: -12 },
    timelineContent: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', padding: 16, borderRadius: 16, marginBottom: 20 },
    timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    updateTitle: { fontSize: 15, fontWeight: '700', color: '#F8FAFC' },
    updateDate: { fontSize: 12, color: '#94A3B8' },
    updateDesc: { color: '#94A3B8', lineHeight: 20 },
    updateImage: { width: '100%', height: 200, borderRadius: 16, marginTop: 12 },
    photoGallerySection: { marginBottom: 24, marginHorizontal: -16 },
    photoGalleryTitle: { fontSize: 20, fontWeight: '800', color: '#F8FAFC', marginBottom: 14, paddingHorizontal: 16, letterSpacing: -0.3 },
    photoGalleryRow: { paddingHorizontal: 16, gap: PHOTO_CARD_GAP },
    photoCardWrap: { width: PHOTO_CARD_WIDTH, height: 300, borderRadius: 24, overflow: 'hidden', backgroundColor: '#1E293B' },
    photoGalleryImage: { width: '100%', height: '100%' },
    photoCardGradient: { ...StyleSheet.absoluteFillObject },
    photoGalleryCaption: { position: 'absolute', left: 16, right: 16, bottom: 16, fontSize: 15, fontWeight: '700', color: '#F8FAFC' },

    inviteObserverBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radii.sm, marginBottom: 24 },
    inviteObserverText: { fontSize: 14, fontWeight: '600', color: theme.colors.active },
    inviteLinkText: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 12, padding: 8, backgroundColor: theme.colors.surfaceAlt, borderRadius: 8 },
    contractSigned: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: theme.colors.surfaceAlt, borderRadius: 12 },
    contractSignedText: { fontSize: 14, fontWeight: '600', color: theme.colors.text },

    emptyTimeline: { alignItems: 'center', padding: 20 },
    dashedLine: { height: 40, width: 1, borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E1', marginBottom: 10 },
    emptyText: { color: TEXT_SECONDARY, fontWeight: '500' },

    chatModalScreen: { flex: 1, backgroundColor: PREMIUM_BG, paddingHorizontal: 12 },
    chatModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        marginBottom: 8,
    },
    chatModalClose: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    chatModalTitle: { fontSize: 17, fontWeight: '800', color: TEXT_PRIMARY },

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
    actionBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', padding: 14, gap: 10, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    actionPayBtn: { flex: 2, backgroundColor: '#2563EB', borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52, gap: 8 },
    actionPayBtnDisabled: { opacity: 0.6 },
    actionPayText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    actionDoneBtn: { flex: 1, backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: 16, alignItems: 'center', justifyContent: 'center', height: 52 },
    actionDoneText: { color: '#34D399', fontWeight: '700', fontSize: 15 },
    disputeBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md, gap: 10, backgroundColor: theme.colors.warning + '18', borderTopWidth: 1, borderTopColor: theme.colors.warning + '50' },
    disputeBarText: { flex: 1, fontSize: 13, fontWeight: '600', color: TEXT_PRIMARY },
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
