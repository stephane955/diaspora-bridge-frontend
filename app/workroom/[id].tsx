import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  Modal,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ShoppingCart, ScanLine, Camera, CloudOff, RefreshCw } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import {
  useMilestoneUploadEvidence,
} from '@/hooks/useWorkroomData';
import { useOfflineWorkroom } from '@/hooks/useOfflineWorkroom';
import ProjectChatFab from '@/components/ProjectChatFab';
import ChatRoom from '@/components/ChatRoom';
import PremiumHeader from '@/components/PremiumHeader';
import { providerMenuItems } from '@/constants/premiumMenus';
import { useScreenOffsets } from '@/hooks/useScreenOffsets';
import { resolveAmountMinor, SETTLEMENT_CURRENCY } from '@/lib/money';
import MilestoneTimelineItem from '@/components/MilestoneTimelineItem';
import PremiumEmptyState from '@/components/PremiumEmptyState';
import { markProjectChatRead } from '@/lib/chatReadState';
import { uploadMilestoneEvidence } from '@/lib/storage';
import {
  PREMIUM_BG,
  PREMIUM_GOLD,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/constants/layout';
import { successFeedback } from '@/utils/haptics';
import { requiredRouteParam } from '@/utils/routeParams';

const WORKROOM_KEY = (projectId: string) => ['workroom', projectId] as const;
const DOCK_HEIGHT = 88;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function WorkroomScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const projectId = requiredRouteParam(params.id);
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const offsets = useScreenOffsets({ tabBar: false });

  const {
    data,
    isLoading: loading,
    refetch: fetchWorkroomData,
    isOffline,
    fromCache,
    pending,
    pendingMilestoneIds,
    queueEvidenceOffline,
    syncPending,
  } = useOfflineWorkroom(projectId);
  const project = data?.project ?? null;
  const milestones = data?.milestones ?? [];

  const [uploading, setUploading] = useState(false);
  const [uploadingMilestoneId, setUploadingMilestoneId] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<{ milestoneId: string; uri: string } | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [advanceEligibility, setAdvanceEligibility] = useState<{
    eligible: boolean;
    max_advance_pct?: number;
  } | null>(null);
  const [existingAdvance, setExistingAdvance] = useState<any>(null);
  const [requestingAdvance, setRequestingAdvance] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const uploadEvidence = useMilestoneUploadEvidence(projectId);

  const progress = useMemo(() => {
    const total = milestones.length;
    const completed = milestones.filter(
      (m: any) => m.status === 'approved' || m.status === 'paid',
    ).length;
    return { completed, total, ratio: total > 0 ? completed / total : 0 };
  }, [milestones]);

  const openProjectChat = async () => {
    successFeedback();
    if (user?.id && projectId) await markProjectChatRead(user.id, projectId);
    setChatModalVisible(true);
  };

  useEffect(() => {
    if (!user?.id || !projectId || isOffline) return;
    (async () => {
      const { data: elig } = await supabase.rpc('get_provider_advance_eligibility', {
        p_provider_id: user.id,
      });
      setAdvanceEligibility(
        elig
          ? { eligible: (elig as any).eligible, max_advance_pct: (elig as any).max_advance_pct }
          : null,
      );
      const { data: adv } = await supabase
        .from('provider_advances')
        .select('*')
        .eq('project_id', projectId)
        .eq('provider_id', user.id)
        .in('status', ['pending', 'disbursed'])
        .maybeSingle();
      setExistingAdvance(adv || null);
    })();
  }, [user?.id, projectId, isOffline]);

  const handleUploadEvidence = async (milestoneId: string) => {
    if (!projectId) return;
    const prev = queryClient.getQueryData<{ project: unknown; milestones: any[] }>(
      WORKROOM_KEY(projectId),
    );
    let capturedUri: string | null = null;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.5,
      });
      if (result.canceled) return;

      const localUri = result.assets[0].uri;
      capturedUri = localUri;
      setLocalPreview({ milestoneId, uri: localUri });

      // Offline-first: cache locally and show Pending Sync
      if (isOffline) {
        await queueEvidenceOffline(milestoneId, localUri);
        successFeedback();
        Alert.alert(t('savedOfflineTitle'), t('savedOfflineBody'));
        return;
      }

      queryClient.setQueryData(WORKROOM_KEY(projectId), (old: typeof prev) => {
        if (!old?.milestones) return old;
        return {
          ...old,
          milestones: old.milestones.map((m) =>
            m.id === milestoneId ? { ...m, status: 'in_review' as const } : m,
          ),
        };
      });

      setUploadingMilestoneId(milestoneId);
      setUploading(true);
      const filePath = await uploadMilestoneEvidence(localUri, milestoneId);
      await uploadEvidence.mutateAsync({ milestoneId, evidenceUrl: filePath });
      successFeedback();
      Alert.alert(t('success'), t('evidenceUploaded'));
      setLocalPreview(null);
    } catch (e: any) {
      if (prev) queryClient.setQueryData(WORKROOM_KEY(projectId), prev);
      if (capturedUri) {
        try {
          await queueEvidenceOffline(milestoneId, capturedUri);
          Alert.alert(t('queuedForSync'), t('queuedForSync'));
          return;
        } catch {
          /* fall through */
        }
      }
      console.log('Evidence upload error:', e?.message ?? e);
      Alert.alert(t('uploadFailed'), e?.message ?? t('uploadFailed'));
      setLocalPreview(null);
    } finally {
      setUploading(false);
      setUploadingMilestoneId(null);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const result = await syncPending();
      if (result.processed > 0) {
        successFeedback();
        Alert.alert(t('syncedTitle'), t('syncedBody', { count: result.processed }));
      } else if (result.failed > 0) {
        Alert.alert(t('syncIncomplete'), t('syncIncomplete'));
      } else {
        Alert.alert(t('upToDate'), t('nothingPendingSync'));
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleTakePhoto = async () => {
    const firstOpen = milestones.find((m: any, index: number) => {
      const isLocked = index > 0 && milestones[index - 1].status !== 'paid';
      return (
        !isLocked &&
        m.status !== 'paid' &&
        m.status !== 'in_review' &&
        m.status !== 'approved' &&
        !pendingMilestoneIds.has(m.id)
      );
    });
    if (firstOpen) {
      await handleUploadEvidence(firstOpen.id);
    } else {
      Alert.alert(t('noOpenMilestone'), t('allMilestonesLocked'));
    }
  };

  // Instant cache: only block on first load with no cache
  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PREMIUM_GOLD} />
      </View>
    );
  }

  const fabBottom = DOCK_HEIGHT + Math.max(insets.bottom, 12) + 20;
  const pendingPreview = (milestoneId: string) => {
    const queued = pending.find((p) => p.milestoneId === milestoneId);
    if (queued) return queued.localUri;
    if (localPreview?.milestoneId === milestoneId) return localPreview.uri;
    return null;
  };

  return (
    <View style={styles.container}>
      <PremiumHeader
        title={t('workroomTitle')}
        subtitle={project?.title}
        showBack
        fallbackRoute="/provider/active"
        menuItems={providerMenuItems(router, t)}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: offsets.top,
          paddingHorizontal: offsets.horizontal,
          paddingBottom: offsets.bottom + DOCK_HEIGHT,
        }}
      >
        {/* Top dashboard: title, client, progress */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <Image
              source={{ uri: project?.profiles?.avatar_url }}
              style={styles.avatar}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.projectTitle} numberOfLines={2}>
                {project?.title ?? 'Project'}
              </Text>
              <Text style={styles.clientName}>
                {project?.profiles?.full_name ?? 'Client'}
                {project?.profiles?.city ? ` · ${project.profiles.city}` : ''}
              </Text>
            </View>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.livePillText}>LIVE</Text>
            </View>
          </View>

          {(isOffline || fromCache || pending.length > 0) && (
            <View style={styles.offlineBar}>
              <CloudOff size={16} color="#FBBF24" />
              <Text style={styles.offlineText}>
                {isOffline
                  ? t('lowDataMode')
                  : pending.length > 0
                    ? t('proofsPendingSync', { count: pending.length })
                    : t('loadedFromCache')}
              </Text>
              {pending.length > 0 ? (
                <TouchableOpacity style={styles.syncBtn} onPress={handleManualSync} disabled={syncing}>
                  {syncing ? (
                    <ActivityIndicator size="small" color={PREMIUM_GOLD} />
                  ) : (
                    <RefreshCw size={14} color={PREMIUM_GOLD} />
                  )}
                  <Text style={styles.syncBtnText}>{t('syncNow')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>{t('milestoneProgress')}</Text>
            <Text style={styles.progressCount}>
              {progress.completed}/{progress.total}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <LinearGradient
              colors={[PREMIUM_GOLD, '#F5D76E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${Math.max(progress.ratio * 100, 2)}%` as any }]}
            />
          </View>
        </View>

        {existingAdvance ? (
          <Text style={styles.advanceStatusText}>
            Advance: {Number(resolveAmountMinor(existingAdvance)).toLocaleString()} CFA (
            {existingAdvance.status})
          </Text>
        ) : null}

        {advanceEligibility?.eligible &&
        !existingAdvance &&
        milestones.length > 0 &&
        milestones.some((m: any) => m.status === 'locked') ? (
          <TouchableOpacity
            style={styles.advanceBtn}
            onPress={async () => {
              successFeedback();
              const firstLocked = milestones.find((m: any) => m.status === 'locked');
              const pct = Math.min(20, advanceEligibility.max_advance_pct ?? 15);
              const amount = Number(
                (resolveAmountMinor(firstLocked ?? {}) * BigInt(pct)) / 100n,
              );
              if (amount <= 0) return;
              Alert.alert(
                'Bridge Credit',
                `Request ${amount.toLocaleString()} CFA (${pct}% of Milestone 1)? Repaid automatically from your final payout.`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Request',
                    onPress: async () => {
                      if (!projectId || !user?.id) return;
                      setRequestingAdvance(true);
                      try {
                        const { error } = await supabase.from('provider_advances').insert({
                          project_id: projectId,
                          provider_id: user.id,
                          currency: SETTLEMENT_CURRENCY,
                          amount_minor: amount,
                          status: 'pending',
                        });
                        if (error) throw error;
                        successFeedback();
                        Alert.alert(
                          'Submitted',
                          'Your advance request has been recorded. Funds will be disbursed per platform policy.',
                        );
                        fetchWorkroomData();
                      } catch (e: unknown) {
                        Alert.alert(t('error'), e instanceof Error ? e.message : t('somethingWentWrong'));
                      } finally {
                        setRequestingAdvance(false);
                      }
                    },
                  },
                ],
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
        ) : null}

        <Text style={styles.sectionTitle}>{t('ablaufTimeline')}</Text>

        {milestones.length === 0 ? (
          <PremiumEmptyState
            icon="flag-outline"
            title={t('noMilestonesYet')}
            subtitle={t('noMilestonesSub')}
          />
        ) : (
          milestones.map((item: any, index: number) => {
            const isSequentiallyLocked =
              index > 0 &&
              milestones[index - 1].status !== 'paid' &&
              milestones[index - 1].status !== 'approved';
            return (
              <MilestoneTimelineItem
                key={item.id}
                index={index}
                title={item.title}
                amountCfa={Number(resolveAmountMinor(item))}
                status={item.status}
                isSequentiallyLocked={isSequentiallyLocked}
                evidenceUrl={item.evidence_url}
                isUploading={uploading && uploadingMilestoneId === item.id}
                localPreviewUri={pendingPreview(item.id)}
                pendingSync={pendingMilestoneIds.has(item.id)}
                isLast={index === milestones.length - 1}
                onUploadProof={() => handleUploadEvidence(item.id)}
                onPressEvidence={(url) => setSelectedImage(url)}
              />
            );
          })
        )}
      </ScrollView>

      {projectId && project?.owner_id ? (
        <ProjectChatFab
          projectId={projectId}
          bottomOffset={fabBottom}
          onPress={openProjectChat}
        />
      ) : null}

      <BlurView
        intensity={85}
        tint="dark"
        style={[styles.floatingDock, { bottom: Math.max(insets.bottom, 12) + 8 }]}
      >
        <View style={styles.dockTint} pointerEvents="none" />
        <TouchableOpacity
          style={styles.dockBtn}
          onPress={() => {
            successFeedback();
            router.push({ pathname: '/provider/material-cart', params: { projectId } });
          }}
        >
          <LinearGradient colors={['#10B981', '#059669']} style={styles.dockIcon}>
            <ShoppingCart size={22} color="#fff" />
          </LinearGradient>
          <Text style={styles.dockLabel}>{t('createCart')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dockBtn}
          onPress={() => {
            successFeedback();
            router.push('/provider/verification-scan');
          }}
        >
          <LinearGradient colors={['#2563EB', '#1D4ED8']} style={styles.dockIcon}>
            <ScanLine size={22} color="#fff" />
          </LinearGradient>
          <Text style={styles.dockLabel}>{t('scanQr')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dockBtn}
          onPress={() => {
            successFeedback();
            handleTakePhoto();
          }}
        >
          <LinearGradient colors={['#D4AF37', '#B8860B']} style={styles.dockIcon}>
            <Camera size={22} color="#0F172A" />
          </LinearGradient>
          <Text style={styles.dockLabel}>{t('takePhoto')}</Text>
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

      <Modal
        visible={chatModalVisible}
        animationType="slide"
        onRequestClose={() => setChatModalVisible(false)}
      >
        <View style={[styles.chatModalScreen, { paddingTop: insets.top }]}>
          <View style={styles.chatModalHeader}>
            <TouchableOpacity
              onPress={() => setChatModalVisible(false)}
              style={styles.chatModalClose}
            >
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: PREMIUM_BG,
  },

  heroCard: {
    backgroundColor: 'rgba(17,24,39,0.75)',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#1E293B' },
  projectTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -0.3,
  },
  clientName: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 4, fontWeight: '600' },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239,68,68,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#F87171' },
  livePillText: { color: '#FCA5A5', fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  offlineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(251,191,36,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.28)',
  },
  offlineText: { flex: 1, color: '#FBBF24', fontSize: 12, fontWeight: '700' },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(212,175,55,0.15)',
  },
  syncBtnText: { color: PREMIUM_GOLD, fontSize: 12, fontWeight: '800' },

  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  progressCount: { color: PREMIUM_GOLD, fontSize: 14, fontWeight: '800' },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999 },

  advanceBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(37,99,235,0.25)',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 16,
    marginBottom: 16,
  },
  advanceBtnText: { color: '#93C5FD', fontWeight: '800', fontSize: 14 },
  advanceStatusText: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    marginBottom: 16,
    fontWeight: '600',
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 16,
    letterSpacing: -0.4,
  },

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
  dockTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 15, 26, 0.85)',
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

  zoomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomedImage: { width: '100%', height: '70%' },
  closeZoom: { position: 'absolute', top: 52, right: 24, zIndex: 10, padding: 8 },
  closeZoomText: { color: '#fff', fontSize: 28, fontWeight: '300' },
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
});
