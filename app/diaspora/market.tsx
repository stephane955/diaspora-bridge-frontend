import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, RefreshControl
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import PremiumHeader from '@/components/PremiumHeader';
import PulseLoader from '@/components/PulseLoader';
import { clientMenuItems } from '@/constants/premiumMenus';
import { theme } from '@/constants/theme';
import { mediumFeedback } from '@/utils/haptics';
import { FLOATING_TAB_BAR_HEIGHT, PREMIUM_BG, PREMIUM_MUTED } from '@/constants/layout';

const blurhash = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

export default function MarketScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { user } = useAuth();
    const { t } = useLanguage();

    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchProjects = useCallback(async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('projects')
                .select('*, profiles:owner_id(full_name, avatar_url)')
                .eq('owner_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setProjects(data || []);
        } catch (err) {
            console.error("Market Error:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user]);

    useFocusEffect(useCallback(() => { fetchProjects(); }, [fetchProjects]));

    const renderProject = ({ item }: { item: any }) => {
        const statusColors: Record<string, string> = {
            pending: theme.colors.warning,
            active: theme.colors.active,
            completed: theme.colors.success,
        };
        const statusColor = statusColors[item.status] || theme.colors.textMuted;

        return (
            <TouchableOpacity
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => { mediumFeedback(); router.push(`/diaspora/project/${item.id}`); }}
            >
                <Image
                    source={item.image_url || 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5'}
                    style={styles.cardImage}
                    placeholder={blurhash}
                    contentFit="cover"
                    transition={400}
                />
                <LinearGradient
                    colors={['transparent', 'rgba(15,23,42,0.7)', '#0F172A']}
                    style={styles.cardOverlay}
                >
                    <View style={styles.topRow}>
                        <View style={[styles.statusBadge, { backgroundColor: statusColor + '25' }]}>
                            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                            <Text style={[styles.statusText, { color: statusColor }]}>{item.status?.toUpperCase()}</Text>
                        </View>
                        {item.city && (
                            <View style={styles.cityBadge}>
                                <Ionicons name="location" size={10} color="#fff" />
                                <Text style={styles.cityText}>{item.city}</Text>
                            </View>
                        )}
                    </View>
                    <View>
                        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                        <View style={styles.priceRow}>
                            <Text style={styles.cardBudget}>{(item.budget || 0).toLocaleString()} CFA</Text>
                            <View style={styles.arrowBtn}>
                                <Ionicons name="arrow-forward" size={18} color={theme.colors.primary} />
                            </View>
                        </View>
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.screen}>
            <PremiumHeader
                title={t('myProjectsTitle')}
                subtitle={t('clientDashboard.activeProjects')}
                showBack
                fallbackRoute="/diaspora"
                menuItems={clientMenuItems(router, t)}
            />

            {loading ? (
                <View style={styles.center}>
                    <PulseLoader />
                </View>
            ) : (
                <FlashList
                    data={projects}
                    renderItem={renderProject}
                    estimatedItemSize={220}
                    contentContainerStyle={{
                        paddingTop: insets.top + 88,
                        paddingBottom: FLOATING_TAB_BAR_HEIGHT + 40,
                        paddingHorizontal: theme.spacing.lg,
                    }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProjects(); }} tintColor="#D4AF37" />}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="briefcase-outline" size={56} color="#334155" />
                            <Text style={styles.emptyTitle}>{t('clientDashboard.noProjects')}</Text>
                            <Text style={styles.emptySub}>{t('postProjectSub')}</Text>
                            <TouchableOpacity
                                style={styles.emptyBtn}
                                onPress={() => { mediumFeedback(); router.push('/diaspora/new'); }}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="add-circle-outline" size={18} color="#0A0F1A" />
                                <Text style={styles.emptyBtnText}>{t('tabPostJob')}</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: PREMIUM_BG },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    card: {
        height: 220,
        borderRadius: theme.radii.xl,
        marginBottom: 18,
        backgroundColor: theme.colors.primarySoft,
        overflow: 'hidden',
        ...theme.shadow.soft,
    },
    cardImage: { width: '100%', height: '100%', position: 'absolute' },
    cardOverlay: { flex: 1, justifyContent: 'space-between', padding: 16 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },

    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: theme.radii.pill,
        gap: 5,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 10, fontWeight: '800' },

    cityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: theme.radii.sm,
        gap: 4,
    },
    cityText: { color: '#fff', fontSize: 11, fontWeight: '600' },

    cardTitle: { fontSize: 20, ...theme.typography.title, color: '#fff', lineHeight: 24, marginBottom: 8 },
    priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardBudget: { color: '#fff', fontSize: 18, fontWeight: '700' },
    arrowBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },

    emptyState: { alignItems: 'center', paddingTop: 80, gap: 8 },
    emptyTitle: { fontSize: 18, ...theme.typography.title, color: theme.colors.text },
    emptySub: { color: theme.colors.textMuted, fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },
    emptyBtn: {
        marginTop: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: theme.colors.active,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: theme.radii.pill,
        ...theme.shadow.glow,
    },
    emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
