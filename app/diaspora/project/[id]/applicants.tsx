import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';
import NavigationBar from '@/components/NavigationBar';

export default function ApplicantsScreen() {
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
                    color="#FBBF24"
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
        <View style={styles.container}>
            <NavigationBar title={t('applicantsTitle') || "Applicants"} showBack />
            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#0EA5E9" />
                </View>
            ) : (
                <FlatList
                    data={applicants}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
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
                                        <ActivityIndicator color="#fff" />
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
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { padding: 20, paddingBottom: 40 },
    emptyState: { padding: 40, alignItems: 'center' },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: '#64748B' },
    emptySub: { fontSize: 13, color: '#94A3B8', marginTop: 6, textAlign: 'center' },
    card: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12, gap: 12 },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E2E8F0' },
    name: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    ratingText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
    starRow: { flexDirection: 'row', gap: 2 },
    hireBtn: { backgroundColor: '#16A34A', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18 },
    hireText: { color: '#fff', fontWeight: '700', fontSize: 12 }
});