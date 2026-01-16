import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
    ImageBackground, Platform, ScrollView, Pressable, ListRenderItem, Modal, Alert
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';

// --- NEW IMPORTS ---
import ProjectStories from '@/components/ProjectStories';

export default function DiasporaDashboard() {
    const router = useRouter();
    const { user, isAuthenticated, signOut } = useAuth();
    const { t } = useLanguage();
    const [projects, setProjects] = useState<any[]>([]);
    const [menuOpen, setMenuOpen] = useState(false);

    // --- 1. Data Fetching ---
    const fetchProjects = useCallback(async () => {
        if (!user) return;
        const { data } = await supabase
            .from('projects')
            .select('*')
            .eq('owner_id', user.id)
            .order('created_at', { ascending: false });

        if (data) setProjects(data);
    }, [user]);

    useEffect(() => {
        fetchProjects();

        // Realtime subscription
        const channel = supabase.channel('projects_channel')
            .on(
                'postgres_changes' as any,
                { event: '*', schema: 'public', table: 'projects' },
                () => { fetchProjects(); }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user, fetchProjects]);

    useFocusEffect(
        useCallback(() => {
            fetchProjects();
        }, [fetchProjects])
    );

    useEffect(() => {
        if (!isAuthenticated) {
            router.replace('/login');
        }
    }, [isAuthenticated, router]);

    const handleDeleteAccount = () => {
        if (!user) return;
        Alert.alert(
            t('deleteAccountTitle') || "Delete Account",
            t('deleteAccountConfirm') || "This action is permanent. Your profile and related data will be deleted. Are you sure?",
            [
                { text: t('cancel') || "Cancel", style: 'cancel' },
                {
                    text: t('delete') || t('deleteAction') || "Delete",
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase.from('profiles').delete().eq('id', user.id);
                            if (error) throw error;
                            await signOut();
                            router.replace('/login');
                        } catch (err: any) {
                            Alert.alert(t('errorTitle') || "Error", err.message || "Failed to delete account");
                        }
                    }
                }
            ]
        );
    };

    // --- 3. Render Items ---
    const renderProjectCard: ListRenderItem<any> = ({ item }) => (
        <Pressable
            style={({ pressed }) => [
                styles.projectCard,
                { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }
            ]}
            onPress={() => {
                router.push(`/diaspora/project/${item.id}`);
            }}
        >
            <View pointerEvents="none" style={{ flex: 1 }}>
                <ImageBackground
                    source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=1000&auto=format&fit=crop' }}
                    style={styles.projectImage}
                    imageStyle={{ borderRadius: 24 }}
                >
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.8)']}
                        style={styles.cardOverlay}
                    >
                        <View style={styles.statusPill}>
                            <View style={[styles.activeDot, { backgroundColor: item.status === 'Active' ? '#4ADE80' : '#F59E0B' }]} />
                            <Text style={styles.statusText}>{item.status || t('statusActive')}</Text>
                        </View>

                        <View>
                            <Text style={styles.projectTitle} numberOfLines={1}>{item.title}</Text>
                            <Text style={styles.projectLoc}>{item.city}</Text>
                        </View>
                    </LinearGradient>
                </ImageBackground>
            </View>
        </Pressable>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.helloText}>{t('helloClient')}</Text>
                    <Text style={styles.subText}>{t('dashboardSub')}</Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/notifications')}>
                        <Ionicons name="notifications" size={20} color="#0F172A" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => setMenuOpen(true)}>
                        <Ionicons name="menu" size={22} color="#0F172A" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* B. Scrollable Content */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 130 }} // Extra padding for Glass Navigation
            >
                {/* Hero */}
                <View style={styles.heroWrap}>
                    <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.heroCard}>
                        <View style={styles.heroGlow} />
                        <View>
                            <Text style={styles.heroLabel}>{t('escrowStatus')}</Text>
                            <Text style={styles.heroAmount}>2,500,000 CFA</Text>
                            <Text style={styles.heroSub}>{t('escrowSub')}</Text>
                        </View>
                        <View style={styles.heroActions}>
                            <TouchableOpacity style={styles.heroBtn} onPress={() => router.push('/diaspora/new')}>
                                <Ionicons name="add" size={16} color="#0F172A" />
                                <Text style={styles.heroBtnText}>{t('postNewProject')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.heroGhost} onPress={() => router.push('/diaspora/wallet')}>
                                <Ionicons name="wallet" size={16} color="#E2E8F0" />
                                <Text style={styles.heroGhostText}>{t('openWallet')}</Text>
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>
                </View>

                <View style={styles.quickRow}>
                    <BlurView intensity={40} tint="light" style={styles.quickCard}>
                        <Ionicons name="sparkles" size={18} color="#0EA5E9" />
                        <Text style={styles.quickText}>{t('curatedPros')}</Text>
                    </BlurView>
                    <BlurView intensity={40} tint="light" style={styles.quickCard}>
                        <Ionicons name="shield-checkmark" size={18} color="#16A34A" />
                        <Text style={styles.quickText}>{t('insuredEscrow')}</Text>
                    </BlurView>
                    <BlurView intensity={40} tint="light" style={styles.quickCard}>
                        <Ionicons name="pulse" size={18} color="#F97316" />
                        <Text style={styles.quickText}>{t('liveUpdates')}</Text>
                    </BlurView>
                </View>

                {/* 2. Project Stories */}
                <ProjectStories />

                {/* 3. Portfolio Card */}
                <View style={styles.cardContainer}>
                    <LinearGradient
                        colors={['#0f172a', '#1e293b']}
                        style={styles.portfolioCard}
                    >
                        <View style={[styles.glowBlob, { backgroundColor: '#0EA5E9', top: -50, right: -50 }]} />
                        <View style={[styles.glowBlob, { backgroundColor: '#F97316', bottom: -50, left: -50 }]} />

                        <View>
                            <Text style={styles.cardLabel}>{t('totalEscrowBalance')}</Text>
                            <Text style={styles.cardAmount}>2,500,000 CFA</Text>
                        </View>

                        <View style={styles.cardFooter}>
                            <View style={styles.tag}>
                                <Ionicons name="shield-checkmark" size={12} color="#4ADE80" />
                                <Text style={styles.tagText}>{t('secured')}</Text>
                            </View>
                            <Text style={styles.cardDate}>{t('updatedJustNow')}</Text>
                        </View>
                    </LinearGradient>
                </View>

                {/* 4. Projects List */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{t('myProjectsTitle')}</Text>
                    <TouchableOpacity onPress={() => router.push('/diaspora/new')}>
                        <Text style={styles.seeAll}>{t('newProjectCta')}</Text>
                    </TouchableOpacity>
                </View>

                {projects.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyText}>{t('noProjectsYet')}</Text>
                        <Text style={styles.emptySub}>{t('tapNewToStart')}</Text>
                    </View>
                ) : (
                    <FlatList
                        data={projects}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={item => item.id.toString()}
                        contentContainerStyle={{ paddingHorizontal: 20 }}
                        renderItem={renderProjectCard}
                    />
                )}

                {/* 5. Recent Activity */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{t('recentActivity')}</Text>
                </View>
                <View style={styles.feedItem}>
                    <View style={styles.feedIcon}><Ionicons name="notifications" size={16} color="#0EA5E9" /></View>
                    <View>
                        <Text style={styles.feedText}>{t('systemConnected')}</Text>
                        <Text style={styles.feedTime}>{t('justNow')}</Text>
                    </View>
                </View>
            </ScrollView>

            <Modal visible={menuOpen} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>{t('menuTitle')}</Text>
                        <TouchableOpacity style={styles.modalItem} onPress={() => { setMenuOpen(false); router.push('/diaspora/profile'); }}>
                            <Ionicons name="person-circle" size={18} color="#0F172A" />
                            <Text style={styles.modalText}>{t('profile')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalItem} onPress={() => { setMenuOpen(false); router.push('/notifications'); }}>
                            <Ionicons name="notifications" size={18} color="#0F172A" />
                            <Text style={styles.modalText}>{t('notificationsTitle')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalItem} onPress={() => { setMenuOpen(false); router.push('/modal'); }}>
                            <Ionicons name="help-circle" size={18} color="#0F172A" />
                            <Text style={styles.modalText}>{t('support')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modalItem, styles.modalDanger]}
                            onPress={async () => {
                                setMenuOpen(false);
                                await signOut();
                                router.replace('/login');
                            }}
                        >
                            <Ionicons name="log-out" size={18} color="#EF4444" />
                            <Text style={styles.modalDangerText}>{t('signOut')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modalItem, styles.modalDanger]}
                            onPress={() => {
                                setMenuOpen(false);
                                handleDeleteAccount();
                            }}
                        >
                            <Ionicons name="trash" size={18} color="#EF4444" />
                            <Text style={styles.modalDangerText}>{t('deleteAccountAction') || "Delete Account"}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalClose} onPress={() => setMenuOpen(false)}>
                            <Text style={styles.modalCloseText}>{t('close')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC', ...(Platform.OS === 'web' ? { alignSelf: 'center', width: '100%', maxWidth: 600, borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#E2E8F0', minHeight: '100vh' } : {}) },

    // Header
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    helloText: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
    subText: { color: '#64748B', marginTop: 4, fontSize: 12, fontWeight: '600' },
    headerActions: { flexDirection: 'row', gap: 10 },
    iconBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },

    heroWrap: { paddingHorizontal: 20, marginTop: 16 },
    heroCard: { borderRadius: 26, padding: 22, overflow: 'hidden', gap: 16 },
    heroGlow: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: '#38BDF8', opacity: 0.2, right: -40, top: -50 },
    heroLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
    heroAmount: { color: '#fff', fontSize: 30, fontWeight: '800', marginTop: 8 },
    heroSub: { color: '#CBD5E1', fontSize: 13, marginTop: 4 },
    heroActions: { flexDirection: 'row', gap: 10 },
    heroBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 },
    heroBtnText: { color: '#0F172A', fontWeight: '700', fontSize: 12 },
    heroGhost: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 },
    heroGhostText: { color: '#E2E8F0', fontWeight: '700', fontSize: 12 },

    quickRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 14 },
    quickCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: '#E2E8F0' },
    quickText: { fontSize: 12, fontWeight: '700', color: '#0F172A', flex: 1 },

    // Portfolio Card
    cardContainer: { paddingHorizontal: 20, marginTop: 10 },
    portfolioCard: { width: '100%', height: 180, borderRadius: 28, padding: 24, justifyContent: 'space-between', overflow: 'hidden', position: 'relative', shadowColor: "#0F172A", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 },
    glowBlob: { position: 'absolute', width: 120, height: 120, borderRadius: 60, opacity: 0.4 },
    cardLabel: { color: '#94A3B8', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
    cardAmount: { color: '#fff', fontSize: 34, fontWeight: '800', marginTop: 4 },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    tag: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(74, 222, 128, 0.2)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, gap: 6 },
    tagText: { color: '#4ADE80', fontSize: 12, fontWeight: '700' },
    cardDate: { color: '#64748B', fontSize: 12, fontWeight: '500' },

    // Sections
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 16, paddingHorizontal: 20 },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
    seeAll: { color: '#0EA5E9', fontWeight: '700', fontSize: 14 },

    // Project Cards
    projectCard: { width: 280, height: 200, marginRight: 16, borderRadius: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
    projectImage: { width: '100%', height: '100%', justifyContent: 'flex-end' },
    cardOverlay: { height: '100%', justifyContent: 'space-between', padding: 20, borderRadius: 24 },
    statusPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backdropFilter: 'blur(10px)' },
    activeDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    statusText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    projectTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 4 },
    projectLoc: { color: '#E2E8F0', fontSize: 14, fontWeight: '500' },

    // Empty State
    emptyBox: { padding: 30, alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 20, borderStyle: 'dashed', borderWidth: 2, borderColor: '#E2E8F0' },
    emptyText: { fontWeight: '700', color: '#64748B', fontSize: 16 },
    emptySub: { fontSize: 14, color: '#94A3B8', marginTop: 4 },

    // Feed
    feedItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, marginHorizontal: 20, borderRadius: 20, marginBottom: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4 },
    feedIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F9FF', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    feedText: { color: '#334155', fontSize: 14, fontWeight: '600' },
    feedTime: { color: '#94A3B8', fontSize: 12, marginTop: 2 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, gap: 12 },
    modalTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
    modalItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
    modalText: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
    modalDanger: { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 16 },
    modalDangerText: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
    modalClose: { alignItems: 'center', paddingTop: 4 },
    modalCloseText: { color: '#64748B', fontWeight: '700' },
});
