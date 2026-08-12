import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import EvidenceImage from '@/components/EvidenceImage';
import {
  PREMIUM_GOLD,
  PREMIUM_BLUE,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/constants/layout';
import { successFeedback } from '@/utils/haptics';
import { useLanguage } from '@/context/LanguageContext';

export type MilestoneStatus =
  | 'locked'
  | 'in_progress'
  | 'in_review'
  | 'approved'
  | 'paid'
  | string;

export type MilestoneTimelineItemProps = {
  index: number;
  title: string;
  amountCfa: number;
  status: MilestoneStatus;
  /** Sequential lock when prior milestone is incomplete */
  isSequentiallyLocked?: boolean;
  evidenceUrl?: string | null;
  isUploading?: boolean;
  localPreviewUri?: string | null;
  isLast?: boolean;
  onUploadProof?: () => void;
  onPressEvidence?: (url: string) => void;
  /** Offline Low-Data: photo captured, waiting for upload */
  pendingSync?: boolean;
};

function resolveVisualStatus(
  status: MilestoneStatus,
  isSequentiallyLocked?: boolean,
): 'locked' | 'in_progress' | 'in_review' | 'completed' {
  if (isSequentiallyLocked || status === 'locked') return 'locked';
  if (status === 'in_review') return 'in_review';
  if (status === 'approved' || status === 'paid') return 'completed';
  return 'in_progress';
}

export default function MilestoneTimelineItem({
  index,
  title,
  amountCfa,
  status,
  isSequentiallyLocked,
  evidenceUrl,
  isUploading,
  localPreviewUri,
  isLast,
  onUploadProof,
  onPressEvidence,
  pendingSync,
}: MilestoneTimelineItemProps) {
  const { t } = useLanguage();
  const visual = resolveVisualStatus(status, isSequentiallyLocked);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (visual === 'in_progress') {
      pulse.value = withRepeat(
        withTiming(1.08, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [visual, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 0.35 + (pulse.value - 1) * 4,
  }));

  const hasEvidence = !!(evidenceUrl && evidenceUrl !== 'pending');
  const borderColor =
    visual === 'locked'
      ? 'rgba(148,163,184,0.18)'
      : visual === 'in_progress'
        ? 'rgba(212,175,55,0.55)'
        : visual === 'in_review'
          ? 'rgba(212,175,55,0.7)'
          : 'rgba(52,211,153,0.55)';

  const railColor =
    visual === 'completed'
      ? '#34D399'
      : visual === 'in_review' || visual === 'in_progress'
        ? PREMIUM_GOLD
        : 'rgba(148,163,184,0.35)';

  const iconName: keyof typeof Ionicons.glyphMap =
    visual === 'locked'
      ? 'lock-closed'
      : visual === 'in_review'
        ? 'hourglass'
        : visual === 'completed'
          ? 'checkmark-circle'
          : 'cloud-upload';

  const iconColor =
    visual === 'locked'
      ? TEXT_SECONDARY
      : visual === 'completed'
        ? '#34D399'
        : PREMIUM_GOLD;

  return (
    <View style={styles.row}>
      <View style={styles.railCol}>
        <View style={[styles.node, { borderColor: railColor, backgroundColor: 'rgba(10,15,26,0.95)' }]}>
          {visual === 'in_progress' ? (
            <Animated.View style={[styles.pulseRing, pulseStyle, { borderColor: PREMIUM_GOLD }]} />
          ) : null}
          <Ionicons name={iconName} size={16} color={iconColor} />
        </View>
        {!isLast ? <View style={[styles.rail, { backgroundColor: railColor }]} /> : null}
      </View>

      <View
        style={[
          styles.card,
          { borderColor },
          visual === 'locked' && styles.cardLocked,
          visual === 'in_progress' && styles.cardActive,
          visual === 'in_review' && styles.cardReview,
          visual === 'completed' && styles.cardDone,
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.step, visual === 'locked' && styles.mutedText]}>
            Step {index + 1}
          </Text>
          <Text
            style={[
              styles.statusLabel,
              visual === 'locked' && { color: TEXT_SECONDARY },
              visual === 'in_progress' && { color: PREMIUM_GOLD },
              visual === 'in_review' && { color: PREMIUM_GOLD },
              visual === 'completed' && { color: '#34D399' },
            ]}
          >
            {visual === 'locked'
              ? 'LOCKED'
              : visual === 'in_progress'
                ? 'IN PROGRESS'
                : visual === 'in_review'
                  ? 'IN REVIEW'
                  : 'COMPLETED'}
          </Text>
        </View>

        <Text style={[styles.title, visual === 'locked' && styles.mutedText]}>{title}</Text>
        <Text style={[styles.amount, visual === 'locked' && styles.mutedText]}>
          {Number(amountCfa || 0).toLocaleString()} CFA
        </Text>

        {pendingSync ? (
          <View style={styles.pendingBadge}>
            <Ionicons name="cloud-offline-outline" size={14} color="#FBBF24" />
            <Text style={styles.pendingText}>{t('pendingSync')}</Text>
          </View>
        ) : null}

        {(pendingSync || isUploading) && localPreviewUri ? (
          <View style={styles.evidenceBlock}>
            <Text style={styles.evidenceLabel}>
              {pendingSync ? 'Cached offline proof' : 'Uploading proof…'}
            </Text>
            <View style={styles.previewWrap}>
              <Image source={{ uri: localPreviewUri }} style={styles.evidenceImage} />
              {isUploading ? (
                <View style={styles.uploadOverlay}>
                  <ActivityIndicator size="large" color={PREMIUM_GOLD} />
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {!isUploading && !pendingSync && hasEvidence && (visual === 'in_review' || visual === 'completed') ? (
          <View style={styles.evidenceBlock}>
            <Text style={styles.evidenceLabel}>Evidence</Text>
            <EvidenceImage
              path={evidenceUrl}
              style={styles.evidenceImage}
              onPress={onPressEvidence}
            />
          </View>
        ) : null}

        {visual === 'in_review' ? (
          <View style={styles.awaiting}>
            <Ionicons name="hourglass-outline" size={16} color={PREMIUM_GOLD} />
            <Text style={styles.awaitingText}>Awaiting Client Approval</Text>
          </View>
        ) : null}

        {visual === 'completed' ? (
          <View style={styles.completed}>
            <Ionicons name="checkmark-circle" size={16} color="#34D399" />
            <Text style={styles.completedText}>Completed</Text>
          </View>
        ) : null}

        {visual === 'in_progress' && onUploadProof ? (
          <TouchableOpacity
            style={styles.uploadBtn}
            activeOpacity={0.9}
            disabled={isUploading}
            onPress={() => {
              successFeedback();
              onUploadProof();
            }}
          >
            {isUploading ? (
              <ActivityIndicator color="#0A0F1A" />
            ) : (
              <>
                <Ionicons name="camera" size={18} color="#0A0F1A" />
                <Text style={styles.uploadBtnText}>Upload Proof</Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}

        {visual === 'locked' ? (
          <Text style={styles.lockHint}>Complete previous step to unlock</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 4,
  },
  railCol: {
    width: 28,
    alignItems: 'center',
  },
  node: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  pulseRing: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
  },
  rail: {
    width: 2,
    flex: 1,
    marginTop: 4,
    marginBottom: 4,
    minHeight: 28,
    opacity: 0.55,
  },
  card: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 14,
    backgroundColor: 'rgba(17,24,39,0.72)',
  },
  cardLocked: {
    opacity: 0.55,
    backgroundColor: 'rgba(17,24,39,0.4)',
  },
  cardActive: {
    shadowColor: PREMIUM_GOLD,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    backgroundColor: 'rgba(212,175,55,0.08)',
  },
  cardReview: {
    shadowColor: PREMIUM_GOLD,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    backgroundColor: 'rgba(212,175,55,0.1)',
  },
  cardDone: {
    backgroundColor: 'rgba(52,211,153,0.08)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  step: {
    fontSize: 11,
    fontWeight: '800',
    color: PREMIUM_GOLD,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  amount: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  pendingBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -4,
    marginBottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
  },
  pendingText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  mutedText: {
    color: TEXT_SECONDARY,
  },
  evidenceBlock: {
    marginBottom: 12,
  },
  evidenceLabel: {
    color: PREMIUM_GOLD,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  evidenceImage: {
    width: '100%',
    height: 160,
    borderRadius: 14,
    backgroundColor: '#1E293B',
  },
  previewWrap: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,15,26,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  awaiting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    paddingVertical: 12,
    borderRadius: 14,
  },
  awaitingText: {
    color: PREMIUM_GOLD,
    fontWeight: '800',
    fontSize: 13,
  },
  completed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.3)',
    paddingVertical: 12,
    borderRadius: 14,
  },
  completedText: {
    color: '#34D399',
    fontWeight: '800',
    fontSize: 13,
  },
  uploadBtn: {
    marginTop: 2,
    backgroundColor: PREMIUM_GOLD,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.35)',
    shadowColor: PREMIUM_BLUE,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  uploadBtnText: {
    color: '#0A0F1A',
    fontWeight: '800',
    fontSize: 14,
  },
  lockHint: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: '600',
  },
});
