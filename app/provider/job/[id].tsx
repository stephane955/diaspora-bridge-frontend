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
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import PremiumHeader from '@/components/PremiumHeader';
import ScreenLoader from '@/components/ScreenLoader';
import PremiumEmptyState from '@/components/PremiumEmptyState';
import { providerMenuItems } from '@/constants/premiumMenus';
import { useLanguage } from '@/context/LanguageContext';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import { useScreenOffsets } from '@/hooks/useScreenOffsets';
import {
  ALPHA,
  GOLD,
  GOLD_BORDER,
  GOLD_TINT,
  SUCCESS,
  font,
  glow,
  icon as iconSize,
  radius,
  shadow,
  space,
  text,
  weight,
  withAlpha,
} from '@/constants/design';
import { supabase } from '@/lib/supabase';
import { resolveProjectBudgetMinor, formatBudgetDisplay } from '@/lib/money';
import { useAuth } from '@/context/AuthContext';
import { successFeedback, mediumFeedback } from '@/utils/haptics';
import { formatTimePosted } from '@/lib/hireProvider';
import { requiredRouteParam } from '@/utils/routeParams';

export default function JobDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = requiredRouteParam(params.id);
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const c = usePremiumColors();
  const offsets = useScreenOffsets();

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
    if (!id || !user?.id) return;
    if (!bidAmount || !coverLetter.trim()) {
      Alert.alert(t('missingInfo'), t('enterBidAndCoverShort'));
      return;
    }
    setApplying(true);
    try {
      const { error } = await supabase.from('project_applications').insert({
        project_id: id,
        provider_id: user.id,
        bid_amount: parseFloat(bidAmount),
        message: coverLetter.trim(),
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
    } catch (error: unknown) {
      Alert.alert(t('error'), error instanceof Error ? error.message : t('couldNotSendApplication'));
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
    return <ScreenLoader />;
  }

  if (!job) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <PremiumEmptyState
          icon="briefcase-outline"
          title="Job not found"
          subtitle={t('somethingWentWrong')}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <StatusBar
        barStyle={c.isDark ? 'light-content' : 'dark-content'}
        translucent
        backgroundColor="transparent"
      />
      <PremiumHeader
        title={job?.title ?? t('marketTitle')}
        subtitle={job?.city ?? t('unknownLocation')}
        showBack
        fallbackRoute="/provider/market"
        menuItems={providerMenuItems(router, t)}
      />

      <ScrollView contentContainerStyle={offsets.content} bounces={false}>
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
          <View style={styles.titleContainer}>
            <View style={[styles.tag, isAssigned && { backgroundColor: SUCCESS }]}>
              <Text style={styles.tagText}>
                {isAssigned ? 'MY ACTIVE JOB' : 'OPEN OPPORTUNITY'}
              </Text>
            </View>
            <Text style={styles.title}>{job.title}</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={iconSize.xs} color="#FFFFFF" />
              <Text style={styles.location}>
                {job.city} · {formatTimePosted(job.created_at)}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.statsRow,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: c.textSecondary }]}>BUDGET</Text>
            <Text style={styles.statValue}>{formatBudgetDisplay(resolveProjectBudgetMinor(job ?? {}))}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: c.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: c.textSecondary }]}>STATUS</Text>
            <Text style={styles.statValue}>{job.status?.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>Scope of Work</Text>
        <Text style={[styles.description, { color: c.textSecondary }]}>
          {job.description || 'No description provided.'}
        </Text>
      </ScrollView>

      <BlurView
        intensity={70}
        tint={c.blurTint}
        style={[styles.footer, { backgroundColor: c.glass, borderTopColor: c.border }]}
      >
        <View>
          <Text style={[styles.footerLabel, { color: c.textSecondary }]}>Total Payout</Text>
          <Text style={[styles.footerPrice, { color: c.textPrimary }]}>
            {formatBudgetDisplay(resolveProjectBudgetMinor(job ?? {}))}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.acceptBtn,
            hasApplied && !isAssigned && { backgroundColor: c.muted, ...shadow.card },
            isAssigned && { backgroundColor: GOLD },
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
          <BlurView
            intensity={55}
            tint={c.blurTint}
            style={[styles.modal, { backgroundColor: c.glassStrong }]}
          >
            <Text style={[styles.modalTitle, { color: c.textPrimary }]}>
              {t('submitApplication') || 'Submit Application'}
            </Text>
            <Text style={[styles.label, { color: c.textSecondary }]}>
              {t('yourBid') || 'Your Bid Amount'} (CFA)
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: c.surface, borderColor: c.border, color: c.textPrimary },
              ]}
              keyboardType="numeric"
              placeholder="e.g. 50000"
              placeholderTextColor={c.muted}
              value={bidAmount}
              onChangeText={setBidAmount}
            />
            <Text style={[styles.label, { color: c.textSecondary }]}>
              {t('coverLetterWhyMe') || 'Cover Letter / Why me'}
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: c.surface, borderColor: c.border, color: c.textPrimary },
                { height: 110, paddingTop: space.md, textAlignVertical: 'top' },
              ]}
              multiline
              placeholder="I have 5 years experience..."
              placeholderTextColor={c.muted}
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
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  imageContainer: {
    height: 260,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: space.lg,
  },
  image: { width: '100%', height: '100%' },
  imageOverlay: { ...StyleSheet.absoluteFillObject },
  titleContainer: { position: 'absolute', left: space.md, right: space.md, bottom: space.md },
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: GOLD_TINT,
    paddingHorizontal: space.sm,
    paddingVertical: space.xxs,
    borderRadius: radius.sm,
    marginBottom: space.xs,
  },
  tagText: { ...text.micro, fontWeight: weight.heavy, color: GOLD },
  title: { ...text.display, color: '#FFFFFF' },
  location: { ...text.footnote, color: '#FFFFFF' },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginTop: space.xs,
  },
  statsRow: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    padding: space.md,
    borderWidth: 1,
    marginBottom: space.lg,
    ...shadow.card,
  },
  statItem: { flex: 1, alignItems: 'center' },
  divider: { width: 1 },
  statLabel: { ...text.label, marginBottom: space.xxs },
  statValue: { ...text.body, fontWeight: weight.heavy, color: GOLD },
  sectionTitle: { ...text.subtitle, marginBottom: space.xs },
  description: { ...text.footnote, lineHeight: 22 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.lg,
    borderTopWidth: 1,
    ...shadow.floating,
  },
  footerLabel: text.caption,
  footerPrice: text.title,
  acceptBtn: {
    backgroundColor: GOLD,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    ...glow(GOLD),
  },
  acceptText: { ...text.footnote, fontWeight: weight.heavy, color: '#0A0F1A' },
  modalOverlay: {
    flex: 1,
    backgroundColor: withAlpha('#000000', ALPHA.scrim),
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: space.lg,
    paddingBottom: space.xxl,
    borderTopWidth: 1,
    borderColor: GOLD_BORDER,
    overflow: 'hidden',
  },
  modalTitle: { ...text.title, marginBottom: space.sm },
  label: {
    ...text.label,
    marginBottom: space.xs,
    marginTop: space.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.lg,
    height: 56,
    paddingHorizontal: space.md,
    fontSize: font.body,
    fontWeight: weight.semibold,
  },
  submitBtn: {
    marginTop: space.lg,
    backgroundColor: GOLD,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...glow(GOLD),
  },
  submitText: { ...text.footnote, fontWeight: weight.heavy, color: '#0A0F1A' },
});
