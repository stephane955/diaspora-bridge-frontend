import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import {
  PREMIUM_GOLD,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/constants/layout';
import { successFeedback, mediumFeedback } from '@/utils/haptics';
import { hireProvider } from '@/lib/hireProvider';
import FavoriteProviderButton from '@/components/FavoriteProviderButton';
import { useLanguage } from '@/context/LanguageContext';

export type ApplicantCardData = {
  id: string;
  provider_id: string;
  bid_amount?: number | null;
  cover_letter?: string | null;
  profiles?: {
    full_name?: string | null;
    avatar_url?: string | null;
    rating?: number | null;
    city?: string | null;
  } | null;
};

type Props = {
  application: ApplicantCardData;
  projectId: string;
  /** Compact row for project detail preview */
  compact?: boolean;
  onHired?: () => void;
  onPressView?: () => void;
};

export default function ApplicantCard({
  application,
  projectId,
  compact,
  onHired,
  onPressView,
}: Props) {
  const { t } = useLanguage();
  const [hiring, setHiring] = useState(false);
  const profile = application.profiles ?? {};
  const name = profile.full_name || 'Service Provider';
  const rating = profile.rating;
  const bid = Number(application.bid_amount || 0);
  const cover = (application.cover_letter || '').trim();
  const snippet =
    cover.length > 110 ? `${cover.slice(0, 110).trim()}…` : cover || 'No cover letter provided.';

  const confirmHire = () => {
    mediumFeedback();
    Alert.alert(
      'Confirm Hire',
      `Are you sure you want to hire ${name} for ${bid.toLocaleString()} CFA? This will initialize the Escrow contract.`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: 'Hire & Start Escrow',
          style: 'default',
          onPress: async () => {
            setHiring(true);
            try {
              await hireProvider({
                projectId,
                applicationId: application.id,
                providerId: application.provider_id,
                bidAmount: bid,
              });
              successFeedback();
              Alert.alert(t('success'), t('hiredEscrowReady', { name }));
              onHired?.();
            } catch (e: any) {
              Alert.alert(t('hireFailed'), e?.message || t('couldNotHireProvider'));
            } finally {
              setHiring(false);
            }
          },
        },
      ],
    );
  };

  return (
    <BlurView intensity={36} tint="dark" style={[styles.card, compact && styles.cardCompact]}>
      <View style={styles.header}>
        <Image
          source={{ uri: profile.avatar_url || 'https://i.pravatar.cc/150?u=provider' }}
          style={styles.avatar}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name="star" size={13} color={PREMIUM_GOLD} />
            <Text style={styles.metaText}>
              {rating ? Number(rating).toFixed(1) : 'New'}
              {profile.city ? ` · ${profile.city}` : ''}
            </Text>
          </View>
        </View>
        <View style={styles.bidPill}>
          <Text style={styles.bidLabel}>Bid</Text>
          <Text style={styles.bidValue}>{bid.toLocaleString()} CFA</Text>
        </View>
        <FavoriteProviderButton providerId={application.provider_id} size={18} />
      </View>

      {!compact ? (
        <Text style={styles.cover} numberOfLines={3}>
          {snippet}
        </Text>
      ) : cover ? (
        <Text style={styles.coverCompact} numberOfLines={2}>
          {snippet}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {onPressView ? (
          <TouchableOpacity style={styles.viewBtn} onPress={onPressView} activeOpacity={0.85}>
            <Text style={styles.viewText}>View</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.hireBtn, hiring && { opacity: 0.7 }]}
          onPress={confirmHire}
          disabled={hiring}
          activeOpacity={0.88}
        >
          {hiring ? (
            <ActivityIndicator color="#0A0F1A" />
          ) : (
            <>
              <Ionicons name="handshake" size={16} color="#0A0F1A" />
              <Text style={styles.hireText}>Hire</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.22)',
    backgroundColor: 'rgba(17,24,39,0.72)',
  },
  cardCompact: { padding: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.35)',
  },
  name: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  metaText: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600' },
  bidPill: {
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'flex-end',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
  },
  bidLabel: {
    color: TEXT_SECONDARY,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bidValue: { color: PREMIUM_GOLD, fontSize: 13, fontWeight: '800', marginTop: 2 },
  cover: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
    marginBottom: 4,
  },
  coverCompact: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  viewBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  viewText: { color: TEXT_PRIMARY, fontWeight: '700', fontSize: 13 },
  hireBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PREMIUM_GOLD,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
    minWidth: 96,
    justifyContent: 'center',
  },
  hireText: { color: '#0A0F1A', fontWeight: '800', fontSize: 14 },
});
