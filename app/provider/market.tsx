import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Share,
  Animated,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PremiumHeader from '@/components/PremiumHeader';
import PremiumEmptyState from '@/components/PremiumEmptyState';
import PulseLoader from '@/components/PulseLoader';
import { providerMenuItems } from '@/constants/premiumMenus';
import { mediumFeedback, successFeedback, lightFeedback } from '@/utils/haptics';
import { formatTimePosted } from '@/lib/hireProvider';
import {
  SCROLL_BOTTOM_INSET,
  PREMIUM_BG,
  PREMIUM_GOLD,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/constants/layout';

const CITIES = ['All', 'Douala', 'Yaoundé', 'Bamenda', 'Kribi', 'Limbe', 'Bafoussam'];
const blurhash = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

export default function MarketScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();

  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [userProfile, setUserProfile] = useState<any>(null);

  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [materialEstimate, setMaterialEstimate] = useState('');
  const [timeToCompletionDays, setTimeToCompletionDays] = useState('');
  const [applying, setApplying] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const successScale = useRef(new Animated.Value(0)).current;

  const fetchMarketData = useCallback(async () => {
    setLoading(true);
    try {
      let userSkills: string[] = [];
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('verification_status, skills')
          .eq('id', user.id)
          .single();
        setUserProfile(profile);
        userSkills = profile?.skills || [];
      }

      let query = supabase
        .from('projects')
        .select(`*, profiles:owner_id (full_name, avatar_url)`)
        .in('status', ['pending', 'open'])
        .is('assigned_provider_id', null)
        .order('created_at', { ascending: false });

      if (selectedCity !== 'All') query = query.eq('city', selectedCity);
      if (searchQuery) query = query.ilike('title', `%${searchQuery}%`);

      const { data, error } = await query;
      if (error) throw error;

      let finalJobs = data || [];
      if (userSkills.length > 0) {
        finalJobs = [...finalJobs].sort((a, b) => {
          const aMatch = userSkills.some((skill) =>
            a.title?.toLowerCase().includes(skill.toLowerCase()),
          );
          const bMatch = userSkills.some((skill) =>
            b.title?.toLowerCase().includes(skill.toLowerCase()),
          );
          if (aMatch && !bMatch) return -1;
          if (!aMatch && bMatch) return 1;
          return 0;
        });
      }
      setJobs(finalJobs);
    } catch (err) {
      console.error('Market Error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCity, searchQuery, user]);

  useFocusEffect(
    useCallback(() => {
      fetchMarketData();
    }, [fetchMarketData]),
  );

  const resetApplyForm = () => {
    setSelectedJob(null);
    setBidAmount('');
    setCoverLetter('');
    setMaterialEstimate('');
    setTimeToCompletionDays('');
  };

  const handleShareJob = async (job: any) => {
    lightFeedback();
    try {
      await Share.share({
        message: `${t('brandName') || 'Diaspora Bridge'}: Check out this job in ${job.city}!\n\n*${job.title}*\nBudget: ${job.budget?.toLocaleString()} CFA\n\nApply now on the app!`,
      });
    } catch (error) {
      console.log(error);
    }
  };

  const handleHideJob = (jobId: string) => {
    mediumFeedback();
    Alert.alert(t('hide') || 'Hide Job', 'Remove this from your feed?', [
      { text: t('cancel') || 'Cancel', style: 'cancel' },
      {
        text: t('hide') || 'Hide',
        style: 'destructive',
        onPress: async () => {
          setJobs((prev) => prev.filter((j) => j.id !== jobId));
          if (user) {
            await supabase.from('hidden_projects').insert({
              user_id: user.id,
              project_id: jobId,
            });
          }
        },
      },
    ]);
  };

  const handleApply = async () => {
    if (userProfile?.verification_status !== 'verified') {
      Alert.alert(
        'ID Verification Required',
        t('getVerified') || 'Get verified to apply for jobs.',
        [
          { text: 'Later', style: 'cancel' },
          {
            text: t('verified') || 'Verify Now',
            onPress: () => {
              resetApplyForm();
              router.push('/provider/verification');
            },
          },
        ],
      );
      return;
    }

    if (!bidAmount || !coverLetter.trim()) {
      Alert.alert('Missing Info', t('missingFields') || 'Please enter a bid amount and cover letter.');
      return;
    }

    setApplying(true);
    try {
      const payload: Record<string, unknown> = {
        project_id: selectedJob.id,
        provider_id: user?.id,
        bid_amount: parseFloat(bidAmount),
        cover_letter: coverLetter.trim(),
        status: 'pending',
      };
      if (materialEstimate.trim()) payload.material_estimate = parseFloat(materialEstimate) || null;
      if (timeToCompletionDays.trim()) {
        payload.time_to_completion_days = parseInt(timeToCompletionDays, 10) || null;
      }

      const { error } = await supabase.from('project_applications').insert(payload);

      if (error) {
        if (error.code === '23505') {
          Alert.alert('Already Applied', 'You have already bid on this job.');
        } else throw error;
      } else {
        successFeedback();
        setShowSuccess(true);
        Animated.spring(successScale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
        setTimeout(() => {
          setShowSuccess(false);
          successScale.setValue(0);
          resetApplyForm();
          Alert.alert(
            t('success') || 'Successfully Applied',
            t('applicationSentBody') || 'Your proposal was sent. The client will review your bid.',
          );
          router.replace('/provider/active');
        }, 1200);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setApplying(false);
    }
  };

  const renderJob = ({ item }: { item: any }) => {
    const isRecommended = userProfile?.skills?.some((s: string) =>
      item.title?.toLowerCase().includes(s.toLowerCase()),
    );
    const scope = (item.description || item.scope || '').trim();

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => {
          mediumFeedback();
          setSelectedJob(item);
        }}
      >
        <Image
          source={item.image_url || 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5'}
          style={styles.cardImage}
          placeholder={blurhash}
          contentFit="cover"
          transition={400}
        />
        <LinearGradient
          colors={['rgba(10,15,26,0.15)', 'rgba(10,15,26,0.55)', '#0A0F1A']}
          style={styles.cardOverlay}
        >
          <View style={styles.topRow}>
            <View style={styles.badgesLeft}>
              {isRecommended ? (
                <View style={styles.matchBadge}>
                  <Ionicons name="sparkles" size={10} color={PREMIUM_GOLD} />
                  <Text style={styles.matchText}>{t('match') || 'MATCH'}</Text>
                </View>
              ) : null}
              <View style={styles.cityBadge}>
                <Ionicons name="location" size={10} color="#fff" />
                <Text style={styles.cityText}>{item.city?.toUpperCase()}</Text>
              </View>
              <View style={styles.timeBadge}>
                <Ionicons name="time-outline" size={10} color={TEXT_SECONDARY} />
                <Text style={styles.timeText}>{formatTimePosted(item.created_at)}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={() => handleShareJob(item)} style={styles.iconBtn}>
                <Ionicons name="share-social" size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleHideJob(item.id)} style={styles.iconBtn}>
                <Ionicons name="eye-off" size={16} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.bottomContent}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
            {scope ? (
              <Text style={styles.cardScope} numberOfLines={2}>
                {scope}
              </Text>
            ) : null}
            <View style={styles.priceRow}>
              <View>
                <Text style={styles.budgetLabel}>
                  {(t('budget') || 'CLIENT BUDGET').toUpperCase()}
                </Text>
                <Text style={styles.cardBudget}>
                  {(item.budget || 0).toLocaleString()} CFA
                </Text>
              </View>
              <View style={styles.arrowBtn}>
                <Ionicons name="arrow-forward" size={20} color="#0A0F1A" />
              </View>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <PremiumHeader
        title={t('marketTitle')}
        subtitle={t('searchPlaceholder')}
        showBack
        fallbackRoute="/provider/active"
        menuItems={providerMenuItems(router, t)}
      />

      <View style={[styles.headerContainer, { paddingTop: insets.top + 72 }]}>
        <LinearGradient colors={['#0A0F1A', '#111827']} style={styles.headerGradient}>
          <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>{t('marketTitle') || 'Find Work'}</Text>
            {userProfile?.verification_status === 'verified' ? (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={14} color={PREMIUM_GOLD} />
                <Text style={styles.verifiedText}>{t('verified') || 'Verified'}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={TEXT_SECONDARY} />
            <TextInput
              style={styles.input}
              placeholder={t('searchPlaceholder') || 'Search projects (e.g. Plumbing)'}
              placeholderTextColor={TEXT_SECONDARY}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={fetchMarketData}
              returnKeyType="search"
            />
          </View>

          <View style={{ height: 40, marginTop: 12 }}>
            <FlashList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={CITIES}
              estimatedItemSize={80}
              renderItem={({ item }: any) => (
                <TouchableOpacity
                  style={[styles.chip, selectedCity === item && styles.chipActive]}
                  onPress={() => setSelectedCity(item)}
                >
                  <Text style={[styles.chipText, selectedCity === item && styles.chipTextActive]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </LinearGradient>
      </View>

      {loading ? (
        <View style={styles.center}>
          <PulseLoader color={PREMIUM_GOLD} />
        </View>
      ) : (
        <View style={styles.listContainer}>
          <FlashList
            data={jobs}
            renderItem={renderJob}
            estimatedItemSize={260}
            contentContainerStyle={{
              paddingBottom: SCROLL_BOTTOM_INSET,
              paddingTop: 16,
              paddingHorizontal: 20,
            }}
            ListEmptyComponent={
              <PremiumEmptyState
                icon="briefcase-outline"
                title={t('noOpenProjectsArea') || 'No open projects in your area yet.'}
                subtitle={
                  t('tryAnotherCity') ||
                  'Try another city filter, or check back soon — new client jobs appear here first.'
                }
                actionLabel={t('tabActive') || 'Active Sites'}
                onAction={() => router.push('/provider/active')}
              />
            }
          />
        </View>
      )}

      <Modal visible={!!selectedJob} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity style={{ flex: 1 }} onPress={resetApplyForm} />
          <BlurView intensity={50} tint="dark" style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('submitProposal') || 'Submit Application'}</Text>
              <TouchableOpacity onPress={resetApplyForm}>
                <Ionicons name="close-circle" size={28} color={TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.jobTitle}>{selectedJob?.title}</Text>
              <Text style={styles.jobBudget}>
                {t('clientBudget') || "Client's Budget"}:{' '}
                <Text style={{ fontWeight: '800', color: PREMIUM_GOLD }}>
                  {selectedJob?.budget?.toLocaleString()} CFA
                </Text>
              </Text>

              <Text style={styles.label}>{t('yourBid') || 'Your Bid Amount'} (CFA)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. 50000"
                placeholderTextColor={TEXT_SECONDARY}
                keyboardType="numeric"
                value={bidAmount}
                onChangeText={setBidAmount}
              />

              <Text style={styles.label}>{t('coverLetter') || 'Cover Letter / Why me'}</Text>
              <TextInput
                style={[styles.modalInput, { height: 110, textAlignVertical: 'top' }]}
                placeholder="I have 5 years experience in..."
                placeholderTextColor={TEXT_SECONDARY}
                multiline
                value={coverLetter}
                onChangeText={setCoverLetter}
              />

              <Text style={styles.label}>{t('materialEstimate') || 'Material Estimate'} (CFA)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Optional"
                placeholderTextColor={TEXT_SECONDARY}
                keyboardType="numeric"
                value={materialEstimate}
                onChangeText={setMaterialEstimate}
              />

              <Text style={styles.label}>{t('timeToCompletion') || 'Time to Completion'} (days)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Optional"
                placeholderTextColor={TEXT_SECONDARY}
                keyboardType="numeric"
                value={timeToCompletionDays}
                onChangeText={setTimeToCompletionDays}
              />

              <TouchableOpacity
                style={[styles.submitBtn, applying && { opacity: 0.7 }]}
                onPress={handleApply}
                disabled={applying}
                activeOpacity={0.85}
              >
                {applying ? (
                  <ActivityIndicator color="#0A0F1A" />
                ) : (
                  <Text style={styles.submitText}>
                    {t('submitApplication') || 'Submit Application'}
                  </Text>
                )}
              </TouchableOpacity>
              <View style={{ height: 24 }} />
            </ScrollView>

            {showSuccess ? (
              <Animated.View style={[styles.successOverlay, { transform: [{ scale: successScale }] }]}>
                <Ionicons name="checkmark-circle" size={64} color={PREMIUM_GOLD} />
                <Text style={styles.successText}>Successfully Applied</Text>
              </Animated.View>
            ) : null}
          </BlurView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PREMIUM_BG },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerContainer: { overflow: 'hidden' },
  headerGradient: { paddingHorizontal: 20, paddingBottom: 20 },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -0.5,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212,175,55,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
  },
  verifiedText: { fontSize: 12, fontWeight: '700', color: PREMIUM_GOLD },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 50,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  input: { flex: 1, marginLeft: 10, fontSize: 16, color: TEXT_PRIMARY },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: { backgroundColor: PREMIUM_GOLD, borderColor: PREMIUM_GOLD },
  chipText: { color: TEXT_SECONDARY, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: '#0A0F1A', fontWeight: '800' },
  listContainer: { flex: 1 },

  card: {
    height: 270,
    borderRadius: 24,
    marginBottom: 18,
    backgroundColor: '#111827',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
  },
  cardImage: { width: '100%', height: '100%', position: 'absolute' },
  cardOverlay: { flex: 1, justifyContent: 'space-between', padding: 16 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  badgesLeft: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, flex: 1, paddingRight: 8 },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10,15,26,0.85)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PREMIUM_GOLD,
    gap: 4,
  },
  matchText: { color: PREMIUM_GOLD, fontSize: 10, fontWeight: '800' },
  cityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  cityText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10,15,26,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  timeText: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '600' },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomContent: { gap: 6 },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    lineHeight: 26,
  },
  cardScope: { color: TEXT_SECONDARY, fontSize: 13, lineHeight: 18 },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 4,
  },
  budgetLabel: {
    color: TEXT_SECONDARY,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  cardBudget: { color: PREMIUM_GOLD, fontSize: 22, fontWeight: '800' },
  arrowBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PREMIUM_GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(10,15,26,0.72)', justifyContent: 'flex-end' },
  modalContent: {
    maxHeight: '88%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(17,24,39,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 22, fontWeight: '800', color: TEXT_PRIMARY },
  jobTitle: { fontSize: 17, fontWeight: '700', color: TEXT_PRIMARY },
  jobBudget: { fontSize: 14, color: TEXT_SECONDARY, marginBottom: 12, marginTop: 4 },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: TEXT_SECONDARY,
    marginBottom: 8,
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 14,
    fontSize: 16,
    color: TEXT_PRIMARY,
  },
  submitBtn: {
    backgroundColor: PREMIUM_GOLD,
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  submitText: { color: '#0A0F1A', fontWeight: '800', fontSize: 16 },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,15,26,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  successText: { fontSize: 22, fontWeight: '800', color: PREMIUM_GOLD },
});
