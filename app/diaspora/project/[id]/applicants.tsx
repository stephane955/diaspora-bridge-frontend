import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';
import PremiumHeader from '@/components/PremiumHeader';
import PremiumEmptyState from '@/components/PremiumEmptyState';
import ApplicantCard from '@/components/ApplicantCard';
import ScreenLoader from '@/components/ScreenLoader';
import { clientMenuItems } from '@/constants/premiumMenus';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import { useScreenOffsets } from '@/hooks/useScreenOffsets';

export default function ApplicantsScreen() {
  const c = usePremiumColors();
  const offsets = useScreenOffsets();
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
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <PremiumHeader
        title={t('applicantsTitle')}
        subtitle={t('proposalsTitle')}
        showBack
        fallbackRoute={`/diaspora/project/${projectId}`}
        menuItems={clientMenuItems(router, t)}
      />
      {loading ? (
        <ScreenLoader />
      ) : (
        <FlatList
          data={applicants}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={offsets.content}
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
  screen: { flex: 1 },
});
