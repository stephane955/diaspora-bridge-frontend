import React, { useState, useEffect } from 'react';

import {

    View, Text, StyleSheet, TouchableOpacity,

    Alert, ActivityIndicator, Image, ScrollView, Modal, Dimensions,

} from 'react-native';

import { useLocalSearchParams, useRouter } from 'expo-router';

import { useQueryClient } from '@tanstack/react-query';

import { BlurView } from 'expo-blur';

import { LinearGradient } from 'expo-linear-gradient';

import { ShoppingCart, ScanLine, Camera, CheckCircle2 } from 'lucide-react-native';

import { theme } from '@/constants/theme';

import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

import { useWorkroomQuery, useMilestoneUploadEvidence, useMilestoneRealtimeSync } from '@/hooks/useWorkroomData';

import EvidenceImage from '@/components/EvidenceImage';
import ProjectChatFab from '@/components/ProjectChatFab';
import { markProjectChatRead } from '@/lib/chatReadState';
import { uploadMilestoneEvidence } from '@/lib/storage';

import ChatRoom from '@/components/ChatRoom';

import PremiumHeader from '@/components/PremiumHeader';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FLOATING_TAB_BAR_HEIGHT, PREMIUM_BG, PREMIUM_GOLD, TEXT_PRIMARY } from '@/constants/layout';

import { mediumFeedback } from '@/utils/haptics';



const WORKROOM_KEY = (projectId: string) => ['workroom', projectId] as const;
const DOCK_HEIGHT = 88;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');



export default function WorkroomScreen() {

    const { id } = useLocalSearchParams();

    const projectId = typeof id === 'string' ? id : id?.[0];

    const { user } = useAuth();
    const { t } = useLanguage();

    const router = useRouter();

    const queryClient = useQueryClient();

    const insets = useSafeAreaInsets();



    const { data, isLoading: loading, refetch: fetchWorkroomData } = useWorkroomQuery(projectId);

    const project = data?.project ?? null;

    const milestones = data?.milestones ?? [];



    const [uploading, setUploading] = useState(false);
    const [uploadingMilestoneId, setUploadingMilestoneId] = useState<string | null>(null);
    const [localPreview, setLocalPreview] = useState<{ milestoneId: string; uri: string } | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [chatModalVisible, setChatModalVisible] = useState(false);

    const [advanceEligibility, setAdvanceEligibility] = useState<{ eligible: boolean; max_advance_pct?: number } | null>(null);

    const [existingAdvance, setExistingAdvance] = useState<any>(null);

    const [requestingAdvance, setRequestingAdvance] = useState(false);



    const uploadEvidence = useMilestoneUploadEvidence(projectId);

    useMilestoneRealtimeSync(projectId);

    const openProjectChat = async () => {
        if (user?.id && projectId) await markProjectChatRead(user.id, projectId);
        setChatModalVisible(true);
    };



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

            const localUri = result.assets[0].uri;
            setLocalPreview({ milestoneId, uri: localUri });
            setUploadingMilestoneId(milestoneId);
            setUploading(true);

            const filePath = await uploadMilestoneEvidence(localUri, milestoneId);

            await uploadEvidence.mutateAsync({ milestoneId, evidenceUrl: filePath });

            Alert.alert("Success", "Evidence uploaded! Client notified.");

        } catch (e: any) {

            if (prev) queryClient.setQueryData(WORKROOM_KEY(projectId), prev);

            console.log('Evidence upload error:', e?.message ?? e);

            Alert.alert("Upload Failed", e?.message ?? "Check your internet connection.");

        } finally {

            setUploading(false);
            setUploadingMilestoneId(null);
            setLocalPreview(null);

        }

    };



    const handleTakePhoto = async () => {

        const firstOpen = milestones.find((m: any, index: number) => {

            const isLocked = index > 0 && milestones[index - 1].status !== 'paid';

            return !isLocked && m.status !== 'paid' && m.status !== 'in_review' && m.status !== 'approved';

        });

        if (firstOpen) {

            await handleUploadEvidence(firstOpen.id);

        } else {

            Alert.alert('No open milestone', 'All milestones are locked or awaiting approval.');

        }

    };



    const renderMilestone = (item: any, index: number) => {

        const isLocked = index > 0 && milestones[index - 1].status !== 'paid';

        const isPaid = item.status === 'paid';

        const isReview = item.status === 'in_review';

        const isApproved = item.status === 'approved';

        const hasEvidence = !!(item.evidence_url && item.evidence_url !== 'pending');

        const isUploadingThis = uploading && uploadingMilestoneId === item.id && !!localPreview?.uri;



        return (

            <View key={item.id} style={[styles.milestoneCard, isLocked && styles.lockedCard]}>

                <View style={styles.milestoneHeader}>

                    <Text style={styles.stepText}>Step {index + 1}</Text>

                    <Text style={[

                        styles.statusText,

                        isPaid || isApproved ? styles.textGreen : isReview ? styles.textAmber : styles.textOrange,

                    ]}>

                        {item.status.toUpperCase().replace('_', ' ')}

                    </Text>

                </View>



                <Text style={styles.milestoneTitle}>{item.title}</Text>

                <Text style={styles.milestoneAmount}>{Number(item.amount ?? item.amount_cfa).toLocaleString()} CFA</Text>



                {isUploadingThis && (

                    <View style={styles.evidencePreview}>

                        <Text style={styles.evidencePreviewLabel}>Uploading proof…</Text>

                        <View style={styles.localPreviewWrap}>

                            <Image source={{ uri: localPreview!.uri }} style={styles.evidencePreviewImage} resizeMode="cover" />

                            <View style={styles.uploadOverlay}>

                                <ActivityIndicator size="large" color={PREMIUM_GOLD} />

                            </View>

                        </View>

                    </View>

                )}



                {!isUploadingThis && hasEvidence && (isReview || isApproved) && (

                    <View style={styles.evidencePreview}>

                        <Text style={styles.evidencePreviewLabel}>{t('reviewProofTitle')}</Text>

                        <EvidenceImage

                            path={item.evidence_url}

                            style={styles.evidencePreviewImage}

                            onPress={(url) => setSelectedImage(url)}

                        />

                    </View>

                )}



                {isApproved && (

                    <View style={styles.approvedState}>

                        <CheckCircle2 size={18} color="#34D399" />

                        <Text style={styles.approvedStateText}>{t('phaseCompleted')}</Text>

                    </View>

                )}



                {isReview && (

                    <View style={styles.awaitingState}>

                        <ActivityIndicator size="small" color={PREMIUM_GOLD} />

                        <Text style={styles.awaitingStateText}>{t('awaitingClientApproval')}</Text>

                    </View>

                )}



                {!isLocked && !isPaid && !isReview && !isApproved && (

                    <TouchableOpacity

                        style={styles.actionBtn}

                        onPress={() => handleUploadEvidence(item.id)}

                        disabled={uploading}

                    >

                        {uploading ? (

                            <ActivityIndicator color="#fff" />

                        ) : (

                            <Text style={styles.btnText}>Upload Proof</Text>

                        )}

                    </TouchableOpacity>

                )}



                {isLocked && (

                    <Text style={styles.lockText}>Complete previous step to unlock</Text>

                )}

            </View>

        );

    };



    if (loading) {

        return (

            <View style={styles.center}>

                <ActivityIndicator size="large" color={PREMIUM_GOLD} />

            </View>

        );

    }



    return (

        <View style={styles.container}>

            <PremiumHeader

                title="Workroom"

                subtitle={project?.title}

                showBack

                fallbackRoute="/provider/active"

                menuItems={[

                    { label: 'Settings', icon: 'settings', onPress: () => router.push('/provider/settings') },

                    { label: 'Profile', icon: 'profile', onPress: () => router.push('/provider/profile') },

                ]}

            />



            <ScrollView

                showsVerticalScrollIndicator={false}

                contentContainerStyle={{

                    paddingTop: insets.top + 88,

                    paddingHorizontal: 16,

                    paddingBottom: DOCK_HEIGHT + insets.bottom + 48,

                }}

            >

                <View style={styles.heroRow}>

                    <Image source={{ uri: project?.profiles?.avatar_url }} style={styles.avatar} />

                    <View style={{ flex: 1 }}>

                        <Text style={styles.clientName}>{project?.profiles?.full_name}</Text>

                        <Text style={styles.clientCity}>{project?.profiles?.city}</Text>

                    </View>

                    <View style={styles.livePill}>

                        <Text style={styles.livePillText}>LIVE</Text>

                    </View>

                </View>



                {existingAdvance && (

                    <Text style={styles.advanceStatusText}>

                        Advance: {Number(existingAdvance.amount_cfa).toLocaleString()} CFA ({existingAdvance.status})

                    </Text>

                )}



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

                        {requestingAdvance ? (

                            <ActivityIndicator size="small" color="#fff" />

                        ) : (

                            <Text style={styles.advanceBtnText}>Request Advance</Text>

                        )}

                    </TouchableOpacity>

                )}



                <Text style={styles.sectionTitle}>Milestones</Text>

                {milestones.map((item, index) => renderMilestone(item, index))}

            </ScrollView>



            {projectId && project?.owner_id && (
                <ProjectChatFab
                    projectId={projectId}
                    bottomOffset={DOCK_HEIGHT + insets.bottom + 24}
                    onPress={openProjectChat}
                />
            )}



            <BlurView intensity={85} tint="dark" style={[styles.floatingDock, { bottom: insets.bottom + 16 }]}>

                <TouchableOpacity

                    style={styles.dockBtn}

                    onPress={() => {

                        mediumFeedback();

                        router.push({ pathname: '/provider/material-cart', params: { projectId: id } });

                    }}

                >

                    <LinearGradient colors={['#10B981', '#059669']} style={styles.dockIcon}>

                        <ShoppingCart size={22} color="#fff" />

                    </LinearGradient>

                    <Text style={styles.dockLabel}>Create Cart</Text>

                </TouchableOpacity>



                <TouchableOpacity

                    style={styles.dockBtn}

                    onPress={() => {

                        mediumFeedback();

                        router.push('/provider/verification-scan');

                    }}

                >

                    <LinearGradient colors={['#2563EB', '#1D4ED8']} style={styles.dockIcon}>

                        <ScanLine size={22} color="#fff" />

                    </LinearGradient>

                    <Text style={styles.dockLabel}>Scan QR</Text>

                </TouchableOpacity>



                <TouchableOpacity style={styles.dockBtn} onPress={() => { mediumFeedback(); handleTakePhoto(); }}>

                    <LinearGradient colors={['#D4AF37', '#B8860B']} style={styles.dockIcon}>

                        <Camera size={22} color="#0F172A" />

                    </LinearGradient>

                    <Text style={styles.dockLabel}>Take Photo</Text>

                </TouchableOpacity>

            </BlurView>



            <Modal visible={!!selectedImage} transparent animationType="fade">

                <View style={styles.zoomOverlay}>

                    <TouchableOpacity style={styles.closeZoom} onPress={() => setSelectedImage(null)}>

                        <Text style={styles.closeZoomText}>✕</Text>

                    </TouchableOpacity>

                    {selectedImage ? (

                        <Image source={{ uri: selectedImage }} style={styles.zoomedImage} resizeMode="contain" />

                    ) : null}

                </View>

            </Modal>



            <Modal visible={chatModalVisible} animationType="slide" onRequestClose={() => setChatModalVisible(false)}>

                <View style={[styles.chatModalScreen, { paddingTop: insets.top }]}>

                    <View style={styles.chatModalHeader}>

                        <TouchableOpacity onPress={() => setChatModalVisible(false)} style={styles.chatModalClose}>

                            <Text style={{ color: TEXT_PRIMARY, fontSize: 24 }}>⌄</Text>

                        </TouchableOpacity>

                        <Text style={styles.chatModalTitle}>{t('projectChatTitle')}</Text>

                        <View style={{ width: 40 }} />

                    </View>

                    {projectId ? (

                        <ChatRoom

                            projectId={projectId}

                            maxHeight={SCREEN_HEIGHT - insets.top - insets.bottom - 80}

                            bottomInset={insets.bottom + 8}

                        />

                    ) : null}

                </View>

            </Modal>

        </View>

    );

}



const styles = StyleSheet.create({

    container: { flex: 1, backgroundColor: PREMIUM_BG },

    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: PREMIUM_BG },



    heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },

    avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#1E293B' },

    clientName: { fontSize: 18, fontWeight: '800', color: '#F8FAFC' },

    clientCity: { fontSize: 13, color: '#64748B', marginTop: 2 },

    livePill: { backgroundColor: 'rgba(239,68,68,0.2)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },

    livePillText: { color: '#FCA5A5', fontSize: 11, fontWeight: '800', letterSpacing: 1 },



    advanceBtn: {

        alignSelf: 'flex-start',

        backgroundColor: 'rgba(37,99,235,0.25)',

        paddingVertical: 12,

        paddingHorizontal: 18,

        borderRadius: 16,

        marginBottom: 16,

    },

    advanceBtnText: { color: '#93C5FD', fontWeight: '800', fontSize: 14 },

    advanceStatusText: { color: '#94A3B8', fontSize: 13, marginBottom: 16, fontWeight: '600' },



    chatSection: { marginBottom: 24 },

    sectionTitle: { fontSize: 22, fontWeight: '800', color: '#F8FAFC', marginBottom: 14, letterSpacing: -0.4 },



    milestoneCard: {

        backgroundColor: 'rgba(255,255,255,0.04)',

        padding: 18,

        borderRadius: 20,

        marginBottom: 12,

    },

    lockedCard: { opacity: 0.45 },



    milestoneHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },

    stepText: { fontSize: 11, fontWeight: '800', color: PREMIUM_GOLD, textTransform: 'uppercase', letterSpacing: 0.8 },

    statusText: { fontSize: 11, fontWeight: '800' },

    textGreen: { color: '#34D399' },

    textOrange: { color: '#FBBF24' },

    textAmber: { color: '#FCD34D' },



    awaitingState: {

        flexDirection: 'row',

        alignItems: 'center',

        justifyContent: 'center',

        gap: 8,

        backgroundColor: 'rgba(212,175,55,0.12)',

        borderWidth: 1,

        borderColor: 'rgba(212,175,55,0.25)',

        paddingVertical: 14,

        borderRadius: 14,

    },

    awaitingStateText: { color: PREMIUM_GOLD, fontWeight: '800', fontSize: 13 },



    approvedState: {

        flexDirection: 'row',

        alignItems: 'center',

        justifyContent: 'center',

        gap: 8,

        backgroundColor: 'rgba(52,211,153,0.12)',

        borderWidth: 1,

        borderColor: 'rgba(52,211,153,0.3)',

        paddingVertical: 14,

        borderRadius: 14,

    },

    approvedStateText: { color: '#34D399', fontWeight: '800', fontSize: 13 },



    milestoneTitle: { fontSize: 17, fontWeight: '800', color: '#F8FAFC', marginBottom: 4 },

    milestoneAmount: { fontSize: 14, color: '#94A3B8', marginBottom: 14 },



    evidencePreview: { marginBottom: 14 },

    evidencePreviewLabel: { fontSize: 11, fontWeight: '800', color: PREMIUM_GOLD, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },

    evidencePreviewImage: { width: '100%', height: 180, borderRadius: 14, backgroundColor: '#334155' },

    localPreviewWrap: { position: 'relative', borderRadius: 14, overflow: 'hidden' },

    uploadOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(10,15,26,0.45)',
        alignItems: 'center',
        justifyContent: 'center',
    },



    actionBtn: { backgroundColor: '#2563EB', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },

    disabledBtn: { backgroundColor: '#475569' },

    btnText: { color: '#fff', fontWeight: '800', fontSize: 14 },



    lockText: { color: '#64748B', fontSize: 12, fontWeight: '600', marginTop: 4 },



    floatingDock: {
        position: 'absolute',
        left: 16,
        right: 16,
        flexDirection: 'row',

        justifyContent: 'space-between',

        padding: 12,

        borderRadius: 24,

        overflow: 'hidden',

        borderWidth: 1,

        borderColor: 'rgba(255,255,255,0.1)',

    },

    dockBtn: { flex: 1, alignItems: 'center', gap: 6 },

    dockIcon: {

        width: 52,

        height: 52,

        borderRadius: 18,

        alignItems: 'center',

        justifyContent: 'center',

    },

    dockLabel: { color: '#E2E8F0', fontSize: 11, fontWeight: '700' },



    zoomOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },

    zoomedImage: { width: '100%', height: '70%' },

    closeZoom: { position: 'absolute', top: 52, right: 24, zIndex: 10, padding: 8 },

    closeZoomText: { color: '#fff', fontSize: 28, fontWeight: '300' },

    chatModalScreen: { flex: 1, backgroundColor: PREMIUM_BG, paddingHorizontal: 12 },

    chatModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, marginBottom: 8 },

    chatModalClose: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },

    chatModalTitle: { fontSize: 17, fontWeight: '800', color: TEXT_PRIMARY },

});


