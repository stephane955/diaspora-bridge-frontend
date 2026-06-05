import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';
import PremiumHeader from '@/components/PremiumHeader';
import PulseLoader from '@/components/PulseLoader';
import { clientMenuItems } from '@/constants/premiumMenus';
import { theme } from '@/constants/theme';
import { FLOATING_TAB_BAR_HEIGHT, PREMIUM_BG, PREMIUM_MUTED } from '@/constants/layout';

export default function ApplicantsScreen() {
    const insets = useSafeAreaInsets();
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { t } = useLanguage();
    const [applicants, setApplicants] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [hiringId, setHiringId] = useState<number | null>(null);

    const fetchApplicants = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        // Fetching applicants along with their profile details
        const { data } = await supabase
            .from('project_applications')
            .select('id, provider_id, created_at, status, provider:provider_id(full_name, avatar_url, rating)')
            .eq('project_id', id)
            .eq('status', 'pending') // Only show active requests
            .order('created_at', { ascending: false });

        if (data) setApplicants(data);
        setLoading(false);
    }, [id]);

    useEffect(() => {
        fetchApplicants();
    }, [fetchApplicants]);

    const renderStars = (current: number) => (
        <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map(num => (
                <Ionicons
                    key={num}
                    name={num <= current ? 'star' : 'star-outline'}
                    size={14}
                    color={theme.colors.warning}
                />
            ))}
        </View>
    );

    const handleHire = async (application: any) => {
        if (!id) return;
        setHiringId(application.id);

        try {
            // 1. Assign provider to project and set status to 'in_progress'
            const { error: projectError } = await supabase
                .from('projects')
                .update({ status: 'in_progress', provider_id: application.provider_id })
                .eq('id', id);

            if (projectError) throw projectError;

            // 2. Accept this specific application
            const { error: acceptError } = await supabase
                .from('project_applications')
                .update({ status: 'accepted' })
                .eq('id', application.id);

            if (acceptError) throw acceptError;

            // 3. Reject other applicants for this project to clean up the queue
            await supabase
                .from('project_applications')
                .update({ status: 'rejected' })
                .eq('project_id', id)
                .neq('id', application.id);

            Alert.alert(t('successTitle') || "Success", t('providerHiredEscrow') || "Provider has been hired!");
            router.replace(`/diaspora/project/${id}`); // Return to project hub to see updated state
        } catch (error: any) {
            Alert.alert(t('errorTitle') || "Error", error.message || t('hireFailed'));
        } finally {
            setHiringId(null);
        }
    };

    return (
        <View style={styles.screen}>
            <PremiumHeader
                title={t('applicantsTitle')}
                subtitle={t('proposalsTitle')}
                showBack
                fallbackRoute={`/diaspora/project/${id}`}
                menuItems={clientMenuItems(router, t)}
            />
            {loading ? (
                <View style={styles.center}>
                    <PulseLoader />
                </View>
            ) : (
                <FlatList
                    data={applicants}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={{
                        paddingTop: insets.top + 88,
                        paddingBottom: FLOATING_TAB_BAR_HEIGHT + 32,
                        paddingHorizontal: theme.spacing.lg,
                    }}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyTitle}>{t('noApplicants') || "No applicants yet"}</Text>
                            <Text style={styles.emptySub}>{t('checkBackSoon') || "Providers will appear here once they apply."}</Text>
                        </View>
                    }
                    renderItem={({ item }) => {
                        const profile = item.provider || {};
                        const rating = Math.round(profile.rating || 0);
                        return (
                            <View style={styles.card}>
                                <Image
                                    source={{ uri: profile.avatar_url || 'https://i.pravatar.cc/150?u=provider' }}
                                    style={styles.avatar}
                                />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.name}>{profile.full_name || t('providerFallback') || "Service Provider"}</Text>
                                    <View style={styles.ratingRow}>
                                        {renderStars(rating)}
                                        <Text style={styles.ratingText}>{rating ? rating.toFixed(1) : t('noRating') || "New"}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={styles.hireBtn}
                                    onPress={() => handleHire(item)}
                                    disabled={hiringId !== null}
                                >
                                    {hiringId === item.id ? (
                                        <ActivityIndicator color={theme.colors.surface} />
                                    ) : (
                                        <Text style={styles.hireText}>{t('hireAction') || "Hire"}</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        );
                    }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: PREMIUM_BG },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { paddingHorizontal: theme.spacing.lg },
    emptyState: { padding: theme.spacing.xxl, alignItems: 'center' },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.textMuted },
    emptySub: { fontSize: 13, color: theme.colors.textSubtle, marginTop: theme.spacing.xs, textAlign: 'center' },
    card: { flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md, backgroundColor: theme.colors.surface, borderRadius: theme.radii.md, borderWidth: 1, borderColor: theme.colors.border, marginBottom: theme.spacing.sm, gap: theme.spacing.sm },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.border },
    name: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, marginTop: 4 },
    ratingText: { fontSize: 12, color: theme.colors.textMuted, fontWeight: '600' },
    starRow: { flexDirection: 'row', gap: 2 },
    hireBtn: { backgroundColor: theme.colors.success, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderRadius: theme.radii.pill },
    hireText: { color: theme.colors.surface, fontWeight: '700', fontSize: 12 }
});