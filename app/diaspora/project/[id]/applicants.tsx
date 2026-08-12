import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';
import PremiumHeader from '@/components/PremiumHeader';
import PremiumEmptyState from '@/components/PremiumEmptyState';
import ApplicantCard from '@/components/ApplicantCard';
import PulseLoader from '@/components/PulseLoader';
import { clientMenuItems } from '@/constants/premiumMenus';
import {
  FLOATING_TAB_BAR_HEIGHT,
  PREMIUM_BG,
  PREMIUM_GOLD,
} from '@/constants/layout';

export default function ApplicantsScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const projectId = typeof id === 'string' ? id : id?.[0];
  const router = useRouter();
  const { t } = useLanguage();
  const [applicants, setApplicants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApplicants = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const { data } = await supabase
      .from('project_applications')
      .select(
        'id, provider_id, bid_amount, cover_letter, created_at, status, profiles:provider_id(full_name, avatar_url, rating, city)',
      )
      .eq('project_id', projectId)
      .eq('status', 'pending')
      .order('bid_amount', { ascending: true });

    if (data) setApplicants(data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchApplicants();
  }, [fetchApplicants]);

  return (
    <View style={styles.screen}>
      <PremiumHeader
        title={t('applicantsTitle')}
        subtitle={t('proposalsTitle')}
        showBack
        fallbackRoute={`/diaspora/project/${projectId}`}
        menuItems={clientMenuItems(router, t)}
      />
      {loading ? (
        <View style={styles.center}>
          <PulseLoader color={PREMIUM_GOLD} />
        </View>
      ) : (
        <FlatList
          data={applicants}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{
            paddingTop: insets.top + 88,
            paddingBottom: FLOATING_TAB_BAR_HEIGHT + 40,
            paddingHorizontal: 20,
          }}
          ListEmptyComponent={
            <PremiumEmptyState
              icon="people-outline"
              title={t('noApplicants') || 'No applicants yet'}
              subtitle={
                t('checkBackSoon') || 'Providers will appear here once they apply.'
              }
            />
          }
          renderItem={({ item }) => (
            <ApplicantCard
              application={item}
              projectId={projectId!}
              onHired={() => router.replace(`/diaspora/project/${projectId}`)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PREMIUM_BG },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
