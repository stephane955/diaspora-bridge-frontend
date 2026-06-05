import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, RefreshControl, StatusBar } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';
import PremiumHeader from '@/components/PremiumHeader';
import PulseLoader from '@/components/PulseLoader';
import { clientMenuItems } from '@/constants/premiumMenus';
import { useRouter } from 'expo-router';
import { theme } from '@/constants/theme';
import { FLOATING_TAB_BAR_HEIGHT, PREMIUM_BG, PREMIUM_MUTED } from '@/constants/layout';

export default function ProjectTimeline() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const { t } = useLanguage();

    const [updates, setUpdates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchUpdates = useCallback(async () => {
        if (!id) {
            setLoading(false);
            setRefreshing(false);
            return;
        }
        try {
            const { data, error } = await supabase
                .from('project_updates')
                .select('*')
                .eq('project_id', id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            if (data) setUpdates(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [id]);

    useEffect(() => { fetchUpdates(); }, [fetchUpdates]);
    const onRefresh = () => { setRefreshing(true); fetchUpdates(); };

    return (
        <View style={styles.screen}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <PremiumHeader
                title={t('timelineTitle')}
                subtitle={t('portfolioTitle')}
                showBack
                fallbackRoute={`/diaspora/project/${id}`}
                menuItems={clientMenuItems(router, t)}
            />
            <ScrollView
                contentContainerStyle={{
                    paddingTop: insets.top + 88,
                    paddingBottom: FLOATING_TAB_BAR_HEIGHT + 32,
                    paddingHorizontal: theme.spacing.lg,
                }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D4AF37" />}
            >
                {loading ? (
                    <View style={styles.center}><PulseLoader /></View>
                ) : updates.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="construct-outline" size={48} color="#334155" />
                        <Text style={styles.emptyText}>{t('noUpdatesYet')}</Text>
                        <Text style={styles.emptySub}>{t('noUpdatesSub')}</Text>
                    </View>
                ) : (
                    <View style={styles.timelineContainer}>
                        {updates.map((item, index) => {
                            const isLast = index === updates.length - 1;
                            return (
                                <View key={item.id} style={styles.itemWrapper}>
                                    <View style={styles.leftColumn}>
                                        <View style={styles.dot} />
                                        {!isLast && <View style={styles.line} />}
                                    </View>
                                    <View style={styles.rightContent}>
                                        <Text style={styles.date}>
                                            {new Date(item.created_at).toLocaleDateString(undefined, {
                                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                                            })}
                                        </Text>
                                        <View style={styles.card}>
                                            {item.image_url && (
                                                <Image source={{ uri: item.image_url }} style={styles.updateImage} />
                                            )}
                                            <Text style={styles.title}>{item.title}</Text>
                                            <Text style={styles.desc}>{item.description}</Text>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: PREMIUM_BG },
    center: { paddingTop: 40, alignItems: 'center' },
    timelineContainer: { marginTop: theme.spacing.sm },
    itemWrapper: { flexDirection: 'row' },
    leftColumn: { alignItems: 'center', width: 30, marginRight: 12 },
    dot: {
        width: 12, height: 12, borderRadius: 6, backgroundColor: '#D4AF37',
        zIndex: 2, marginTop: 6, borderWidth: 2, borderColor: PREMIUM_BG,
    },
    line: { width: 2, flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: -2 },
    rightContent: { flex: 1, paddingBottom: 30 },
    date: { fontSize: 12, color: PREMIUM_MUTED, marginBottom: 6, fontWeight: '600' },
    card: {
        backgroundColor: 'rgba(17,24,39,0.85)',
        padding: theme.spacing.sm,
        borderRadius: theme.radii.md,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    title: { fontSize: 16, fontWeight: '700', color: '#F8FAFC', marginBottom: 4 },
    desc: { fontSize: 14, color: PREMIUM_MUTED, lineHeight: 22 },
    updateImage: {
        width: '100%', height: 180, borderRadius: theme.radii.sm,
        marginBottom: theme.spacing.sm, backgroundColor: PREMIUM_BG,
    },
    emptyState: { alignItems: 'center', marginTop: 80, gap: 10 },
    emptyText: { fontSize: 18, fontWeight: '700', color: '#F8FAFC' },
    emptySub: { color: PREMIUM_MUTED, textAlign: 'center', paddingHorizontal: 40 },
});
