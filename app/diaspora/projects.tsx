import React, { useCallback, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ImageBackground,
    FlatList, ActivityIndicator, RefreshControl, StatusBar
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

export default function MyProjectsScreen() {
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
                                <View style={[styles.statusDot, { backgroundColor: isActive ? '#4ADE80' : '#F59E0B' }]} />
                                <Text style={styles.statusText}>
                                    {isActive ? "ACTIVE SITE" : "PENDING PROVIDER"}
                                </Text>
                            </BlurView>
                        </View>

                        {/* Footer: Info */}
                        <View style={styles.cardFooter}>
                            <Text style={styles.projectTitle} numberOfLines={1}>{item.title}</Text>

                            <View style={styles.locationRow}>
                                <Ionicons name="location" size={14} color="#CBD5E1" />
                                <Text style={styles.locationText}>{item.city}</Text>
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.metaRow}>
                                <View>
                                    <Text style={styles.metaLabel}>{t('project.budget')}</Text>
                                    <Text style={styles.metaValue}>{item.budget?.toLocaleString()} CFA</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={styles.metaLabel}>Provider</Text>
                                    <Text style={styles.metaValue}>
                                        {hasProvider ? item.provider.full_name : "Searching..."}
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
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('tabHome') || "My Projects"}</Text>
                <View style={{ width: 44 }} />
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>
            ) : (
                <FlatList
                    data={projects}
                    keyExtractor={(item) => item.id}
                    renderItem={renderProjectCard}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProjects(); }} />}

                    ListHeaderComponent={
                        <TouchableOpacity
                            style={styles.createBtn}
                            onPress={() => router.push('/diaspora/new')}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={['#F0F9FF', '#E0F2FE']}
                                style={styles.createGradient}
                            >
                                <View style={styles.createIcon}>
                                    <Ionicons name="add" size={28} color="#0284C7" />
                                </View>
                                <View>
                                    <Text style={styles.createTitle}>{t('tabPostJob')}</Text>
                                    <Text style={styles.createSub}>Find a new provider for your next job</Text>
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="folder-open-outline" size={48} color="#CBD5E1" />
                            <Text style={styles.emptyText}>{t('clientDashboard.noProjects')}</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Header
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: '#fff' },
    backBtn: { width: 44, height: 44, backgroundColor: '#F1F5F9', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },

    listContent: { padding: 20, paddingBottom: 100 },

    // Create Button (Modern Dashed Look replaced with Soft Gradient Card)
    createBtn: { marginBottom: 24, shadowColor: "#0EA5E9", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 2 },
    createGradient: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 20, gap: 16, borderWidth: 1, borderColor: '#BAE6FD' },
    createIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
    createTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
    createSub: { fontSize: 13, color: '#64748B' },

    // Project Card
    cardContainer: { height: 260, marginBottom: 20, borderRadius: 24, shadowColor: "#0F172A", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 8, backgroundColor: '#fff' },
    cardImage: { width: '100%', height: '100%' },
    cardOverlay: { flex: 1, borderRadius: 24, padding: 20, justifyContent: 'space-between' },

    cardHeader: { flexDirection: 'row', justifyContent: 'flex-end' },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.2)' },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusText: { fontSize: 11, fontWeight: '800', color: '#fff' },

    cardFooter: { gap: 4 },
    projectTitle: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
    locationText: { color: '#E2E8F0', fontSize: 14, fontWeight: '600' },

    divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: 12 },

    metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
    metaLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
    metaValue: { color: '#fff', fontSize: 15, fontWeight: '700' },

    emptyContainer: { alignItems: 'center', marginTop: 40, gap: 10 },
    emptyText: { color: '#94A3B8', fontSize: 16 }
});