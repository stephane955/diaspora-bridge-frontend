import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import PremiumHeader from '@/components/PremiumHeader';
import { providerMenuItems } from '@/constants/premiumMenus';
import { useLanguage } from '@/context/LanguageContext';
import {
  FLOATING_TAB_BAR_HEIGHT,
  PREMIUM_BG,
  PREMIUM_GOLD,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/constants/layout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { successFeedback, mediumFeedback } from '@/utils/haptics';
import { formatTimePosted } from '@/lib/hireProvider';
import { safeGoBack } from '@/utils/navigation';

export default function JobDetailsScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [isAssigned, setIsAssigned] = useState(false);
  const [showApply, setShowApply] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [coverLetter, setCoverLetter] = useState('');

  useEffect(() => {
    const fetchJobData = async () => {
      if (!id || !user) return;
      try {
        const { data: jobData, error } = await supabase
          .from('projects')
          .select('*')
          .eq('id', id)
          .single();
        if (error) throw error;
        setJob(jobData);
        if (jobData.assigned_provider_id === user.id) setIsAssigned(true);

        const { data: appData } = await supabase
          .from('project_applications')
          .select('*')
          .eq('project_id', id)
          .eq('provider_id', user.id)
          .maybeSingle();
        if (appData) setHasApplied(true);
      } catch (err) {
        console.error('Error loading job details:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchJobData();
  }, [id, user]);

  const submitApplication = async () => {
    if (!bidAmount || !coverLetter.trim()) {
      Alert.alert(t('missingInfo'), t('enterBidAndCoverShort'));
      return;
    }
    setApplying(true);
    try {
      const { error } = await supabase.from('project_applications').insert({
        project_id: id,
        provider_id: user?.id,
        bid_amount: parseFloat(bidAmount),
        cover_letter: coverLetter.trim(),
        status: 'pending',
      });
      if (error) {
        if (error.code === '23505') Alert.alert(t('alreadyApplied'), t('alreadyBidOnJob'));
        else throw error;
      } else {
        successFeedback();
        setHasApplied(true);
        setShowApply(false);
        Alert.alert(
          t('success'),
          t('applicationSentBody') || 'Your proposal was sent. The client will review your bid shortly.',
        );
        router.replace('/provider/active');
      }
    } catch (error: any) {
      Alert.alert(t('error'), error.message || t('couldNotSendApplication'));
    } finally {
      setApplying(false);
    }
  };

  const handlePrimary = () => {
    if (isAssigned) {
      router.push(`/workroom/${id}`);
      return;
    }
    mediumFeedback();
    setShowApply(true);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={PREMIUM_GOLD} size="large" />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.center}>
        <Text style={{ color: TEXT_PRIMARY }}>Job not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <PremiumHeader
        title={job?.title ?? t('marketTitle')}
        subtitle={job?.city ?? t('unknownLocation')}
        showBack
        fallbackRoute="/provider/market"
        menuItems={providerMenuItems(router, t)}
      />

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 72,
          paddingBottom: FLOATING_TAB_BAR_HEIGHT + 40,
          paddingHorizontal: 20,
        }}
        bounces={false}
      >
        <View style={styles.imageContainer}>
          <Image
            source={{
              uri:
                job.image_url ||
                'https://images.unsplash.com/photo-1541888946425-d81bb19240f5',
            }}
            style={styles.image}
          />
          <LinearGradient colors={['transparent', 'rgba(10,15,26,0.92)']} style={styles.imageOverlay} />
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => safeGoBack(router, '/provider/market')}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <View style={[styles.tag, isAssigned && { backgroundColor: '#16A34A' }]}>
              <Text style={styles.tagText}>
                {isAssigned ? 'MY ACTIVE JOB' : 'OPEN OPPORTUNITY'}
              </Text>
            </View>
            <Text style={styles.title}>{job.title}</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={16} color={TEXT_SECONDARY} />
              <Text style={styles.location}>
                {job.city} · {formatTimePosted(job.created_at)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>BUDGET</Text>
            <Text style={styles.statValue}>{job.budget?.toLocaleString()} CFA</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>STATUS</Text>
            <Text style={styles.statValue}>{job.status?.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Scope of Work</Text>
        <Text style={styles.description}>{job.description || 'No description provided.'}</Text>
      </ScrollView>

      <BlurView intensity={70} tint="dark" style={styles.footer}>
        <View>
          <Text style={styles.footerLabel}>Total Payout</Text>
          <Text style={styles.footerPrice}>{job.budget?.toLocaleString()} CFA</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.acceptBtn,
            hasApplied && !isAssigned && { backgroundColor: '#475569' },
            isAssigned && { backgroundColor: PREMIUM_GOLD },
          ]}
          onPress={handlePrimary}
          disabled={(hasApplied && !isAssigned) || applying}
        >
          <Text style={styles.acceptText}>
            {isAssigned
              ? 'Open Workroom'
              : hasApplied
                ? 'Applied'
                : t('submitApplication') || 'Apply'}
          </Text>
        </TouchableOpacity>
      </BlurView>

      <Modal visible={showApply} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowApply(false)} />
          <BlurView intensity={55} tint="dark" style={styles.modal}>
            <Text style={styles.modalTitle}>{t('submitApplication') || 'Submit Application'}</Text>
            <Text style={styles.label}>{t('yourBid') || 'Your Bid Amount'} (CFA)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="e.g. 50000"
              placeholderTextColor={TEXT_SECONDARY}
              value={bidAmount}
              onChangeText={setBidAmount}
            />
            <Text style={styles.label}>{t('coverLetterWhyMe') || 'Cover Letter / Why me'}</Text>
            <TextInput
              style={[styles.input, { height: 110, textAlignVertical: 'top' }]}
              multiline
              placeholder="I have 5 years experience..."
              placeholderTextColor={TEXT_SECONDARY}
              value={coverLetter}
              onChangeText={setCoverLetter}
            />
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={submitApplication}
              disabled={applying}
            >
              {applying ? (
                <ActivityIndicator color="#0A0F1A" />
              ) : (
                <Text style={styles.submitText}>
                  {t('submitApplication') || 'Submit Application'}
                </Text>
              )}
            </TouchableOpacity>
          </BlurView>
        </KeyboardAvoidingView>
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
  imageContainer: { height: 260, borderRadius: 24, overflow: 'hidden', marginBottom: 18 },
  image: { width: '100%', height: '100%' },
  imageOverlay: { ...StyleSheet.absoluteFillObject },
  backBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: { position: 'absolute', left: 16, right: 16, bottom: 16 },
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(212,175,55,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  tagText: { color: PREMIUM_GOLD, fontSize: 11, fontWeight: '800' },
  title: { color: TEXT_PRIMARY, fontSize: 24, fontWeight: '800' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  location: { color: TEXT_SECONDARY, fontWeight: '600' },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(17,24,39,0.75)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 20,
  },
  statItem: { flex: 1, alignItems: 'center' },
  divider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  statLabel: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '800', marginBottom: 4 },
  statValue: { color: PREMIUM_GOLD, fontSize: 16, fontWeight: '800' },
  sectionTitle: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  description: { color: TEXT_SECONDARY, fontSize: 14, lineHeight: 22 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(10,15,26,0.92)',
  },
  footerLabel: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '700' },
  footerPrice: { color: TEXT_PRIMARY, fontSize: 20, fontWeight: '800' },
  acceptBtn: {
    backgroundColor: PREMIUM_GOLD,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 14,
  },
  acceptText: { color: '#0A0F1A', fontWeight: '800', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(10,15,26,0.7)', justifyContent: 'flex-end' },
  modal: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    paddingBottom: 36,
    backgroundColor: 'rgba(17,24,39,0.96)',
    borderTopWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    overflow: 'hidden',
  },
  modalTitle: { color: TEXT_PRIMARY, fontSize: 20, fontWeight: '800', marginBottom: 12 },
  label: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    marginTop: 10,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 14,
    color: TEXT_PRIMARY,
    fontSize: 16,
  },
  submitBtn: {
    marginTop: 20,
    backgroundColor: PREMIUM_GOLD,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { color: '#0A0F1A', fontWeight: '800', fontSize: 15 },
});
