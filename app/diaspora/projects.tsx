import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ImageBackground,
    FlatList, ActivityIndicator, RefreshControl, StatusBar
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import PremiumHeader from '@/components/PremiumHeader';
import PulseLoader from '@/components/PulseLoader';
import { clientMenuItems } from '@/constants/premiumMenus';
import { theme } from '@/constants/theme';
import { FLOATING_TAB_BAR_HEIGHT, PREMIUM_BG, PREMIUM_MUTED } from '@/constants/layout';

export default function MyProjectsScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { user } = useAuth();
    const { t } = useLanguage();

    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Fetch Real Data
    const fetchProjects = useCallback(async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('projects')
                .select('*, provider:profiles!assigned_provider_id(full_name)')
                .eq('owner_id', user.id)
                .order('created_at', { ascending: false });

            if (!error && data) setProjects(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user]);

    useFocusEffect(
        useCallback(() => {
            fetchProjects();
        }, [fetchProjects])
    );

    // --- RENDER ITEM (The "State of the Art" Card) ---
    const renderProjectCard = ({ item }: { item: any }) => {
        const isActive = item.status === 'in_progress';
        const hasProvider = !!item.provider;

        return (
            <TouchableOpacity
                style={styles.cardContainer}
                activeOpacity={0.9}
                onPress={() => router.push(`/diaspora/project/${item.id}`)}
            >
                <ImageBackground
                    source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&q=80' }}
                    style={styles.cardImage}
                    imageStyle={{ borderRadius: 24 }}
                >
                    <LinearGradient
                        colors={['rgba(0,0,0,0.1)', 'rgba(15, 23, 42, 0.9)']}
                        style={styles.cardOverlay}
                    >
                        {/* Header: Status Badge */}
                        <View style={styles.cardHeader}>
                            <BlurView intensity={20} tint="light" style={styles.statusBadge}>
                                <View style={[styles.statusDot, { backgroundColor: isActive ? theme.colors.success : theme.colors.warning }]} />
                                <Text style={styles.statusText}>
                                    {isActive ? t('activeSiteLabel').toUpperCase() : t('pendingProviderLabel').toUpperCase()}
                                </Text>
                            </BlurView>
                        </View>

                        {/* Footer: Info */}
                        <View style={styles.cardFooter}>
                            <Text style={styles.projectTitle} numberOfLines={1}>{item.title}</Text>

                            <View style={styles.locationRow}>
                                <Ionicons name="location" size={14} color={theme.colors.textSubtle} />
                                <Text style={styles.locationText}>{item.city}</Text>
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.metaRow}>
                                <View>
                                    <Text style={styles.metaLabel}>{t('project.budget')}</Text>
                                    <Text style={styles.metaValue}>{item.budget?.toLocaleString()} CFA</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={styles.metaLabel}>{t('providerLabel')}</Text>
                                    <Text style={styles.metaValue}>
                                        {hasProvider ? item.provider.full_name : t('searchingProvider')}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </LinearGradient>
                </ImageBackground>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.screen}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <PremiumHeader
                title={t('tabProjects')}
                subtitle={t('clientDashboard.activeProjects')}
                showBack
                fallbackRoute="/diaspora"
                menuItems={clientMenuItems(router, t)}
            />

            {loading ? (
                <View style={styles.center}><PulseLoader /></View>
            ) : (
                <FlatList
                    data={projects}
                    keyExtractor={(item) => item.id}
                    renderItem={renderProjectCard}
                    contentContainerStyle={{
                        paddingTop: insets.top + 88,
                        paddingBottom: FLOATING_TAB_BAR_HEIGHT + 32,
                        paddingHorizontal: theme.spacing.lg,
                    }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProjects(); }} tintColor="#D4AF37" />}

                    ListHeaderComponent={
                        <TouchableOpacity
                            style={styles.createBtn}
                            onPress={() => router.push('/diaspora/new')}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={[theme.colors.activeSoft + '40', theme.colors.activeSoft + '30']}
                                style={styles.createGradient}
                            >
                                <View style={styles.createIcon}>
                                    <Ionicons name="add" size={28} color={theme.colors.active} />
                                </View>
                                <View>
                                    <Text style={styles.createTitle}>{t('tabPostJob')}</Text>
                                    <Text style={styles.createSub}>{t('postProjectSub')}</Text>
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="folder-open-outline" size={48} color={theme.colors.textSubtle} />
                            <Text style={styles.emptyText}>{t('clientDashboard.noProjects')}</Text>
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

    createBtn: { marginBottom: theme.spacing.xl, ...theme.shadow.soft },
    createGradient: { flexDirection: 'row', alignItems: 'center', padding: theme.spacing.lg, borderRadius: theme.radii.lg, gap: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.activeSoft + '80' },
    createIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' },
    createTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.text },
    createSub: { fontSize: 13, color: theme.colors.textMuted },

    cardContainer: { height: 260, marginBottom: theme.spacing.lg, borderRadius: theme.radii.xl, ...theme.shadow.soft, backgroundColor: theme.colors.surface },
    cardImage: { width: '100%', height: '100%' },
    cardOverlay: { flex: 1, borderRadius: theme.radii.xl, padding: theme.spacing.lg, justifyContent: 'space-between' },

    cardHeader: { flexDirection: 'row', justifyContent: 'flex-end' },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs, borderRadius: theme.radii.pill, gap: theme.spacing.xs, overflow: 'hidden', backgroundColor: theme.colors.glass },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusText: { fontSize: 11, fontWeight: '800', color: theme.colors.surface },

    cardFooter: { gap: 4 },
    projectTitle: { fontSize: 22, fontWeight: '800', color: theme.colors.surface, letterSpacing: -0.5 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, marginBottom: theme.spacing.sm },
    locationText: { color: theme.colors.textSubtle, fontSize: 14, fontWeight: '600' },

    divider: { height: 1, backgroundColor: theme.colors.glass, marginBottom: theme.spacing.sm },

    metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
    metaLabel: { color: theme.colors.textSubtle, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
    metaValue: { color: theme.colors.surface, fontSize: 15, fontWeight: '700' },

    emptyContainer: { alignItems: 'center', marginTop: theme.spacing.xxl, gap: theme.spacing.sm },
    emptyText: { color: theme.colors.textSubtle, fontSize: 16 }
});