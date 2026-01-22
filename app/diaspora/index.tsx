import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
    ImageBackground, Platform, ScrollView, Pressable, ListRenderItem, Modal, Alert, StatusBar
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';

// --- CUSTOM COMPONENTS ---
import ProjectStories from '@/components/ProjectStories';

export default function DiasporaDashboard() {
    const router = useRouter();
    const { session, isAuthenticated, signOut } = useAuth(); // Updated to match your AuthContext
    const { t } = useLanguage();
    const [projects, setProjects] = useState<any[]>([]);
    const [menuOpen, setMenuOpen] = useState(false);
    const [profile, setProfile] = useState<any>(null);

    // --- 1. Data Fetching ---
    const fetchProjects = useCallback(async () => {
        if (!session?.user) return;

        // Fetch Profile Name
        const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', session.user.id)
            .single();
        if (profileData) setProfile(profileData);

        // Fetch Projects
        const { data } = await supabase
            .from('projects')
            .select('id, title, city, status, image_url, created_at')
            .eq('owner_id', session.user.id) // Ensure we only see OUR projects
            .order('created_at', { ascending: false });

        if (data) setProjects(data);
    }, [session]);

    useEffect(() => {
        fetchProjects();

        // Realtime: Updates dashboard instantly if status changes
        const channel = supabase.channel('projects_channel')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'projects' },
                () => { fetchProjects(); }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [session, fetchProjects]);

    // --- 2. Account Actions ---
    const handleDeleteAccount = () => {
        if (!session?.user) return;
        Alert.alert(
            t('deleteAccountTitle'),
            t('deleteAccountConfirm'),
            [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: t('deleteAccountAction'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase.from('profiles').delete().eq('id', session.user.id);
                            if (error) throw error;
                            await signOut();
                            router.replace('/login');
                        } catch (err: any) {
                            Alert.alert("Error", err.message);
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
            onPress={() => router.push(`/diaspora/project/${item.id}`)}
        >
            <ImageBackground
                source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=1000&auto=format&fit=crop' }}
                style={styles.projectImage}
                imageStyle={{ borderRadius: 24 }}
            >
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.cardOverlay}>
                    <View style={styles.statusPill}>
                        <View style={[styles.activeDot, { backgroundColor: item.status === 'in_progress' ? '#4ADE80' : '#F59E0B' }]} />
                        <Text style={styles.statusText}>
                            {item.status === 'in_progress' ? t('inProgressStatus') : "Pending"}
                        </Text>
                    </View>
                    <View>
                        <Text style={styles.projectTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.projectLoc}>
                            <Ionicons name="location" size={12} color="#CBD5E1" /> {item.city}
                        </Text>
                    </View>
                </LinearGradient>
            </ImageBackground>
        </Pressable>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <SafeAreaView style={{backgroundColor: '#fff'}}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.helloText}>{t('welcomeBack')}</Text>
                        <Text style={styles.subText}>
                            {profile?.full_name || session?.user?.email}
                        </Text>
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
            </SafeAreaView>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

                {/* Hero / Escrow Status */}
                <View style={styles.heroWrap}>
                    <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.heroCard}>
                        <View style={styles.heroGlow} />
                        <View>
                            <Text style={styles.heroLabel}>{t('availableBalance')}</Text>
                            <Text style={styles.heroAmount}>0 CFA</Text>
                            <Text style={styles.heroSub}>{t('securedBy')}</Text>
                        </View>
                        <View style={styles.heroActions}>
                            <TouchableOpacity style={styles.heroBtn} onPress={() => router.push('/diaspora/new')}>
                                <Ionicons name="add" size={16} color="#0F172A" />
                                <Text style={styles.heroBtnText}>{t('tabPostJob')}</Text>
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>
                </View>

                {/* Quick Stats */}
                <View style={styles.quickRow}>
                    <BlurView intensity={20} tint="light" style={styles.quickCard}>
                        <Ionicons name="briefcase" size={18} color="#0EA5E9" />
                        <Text style={styles.quickText}>{projects.length} {t('myJobsTab')}</Text>
                    </BlurView>
                    <BlurView intensity={20} tint="light" style={styles.quickCard}>
                        <Ionicons name="shield-checkmark" size={18} color="#16A34A" />
                        <Text style={styles.quickText}>{t('secure')}</Text>
                    </BlurView>
                </View>

                {/* Stories Component */}
                <ProjectStories />

                {/* Projects List */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{t('myJobsTab')}</Text>
                    <TouchableOpacity onPress={() => router.push('/diaspora/new')}>
                        <Text style={styles.seeAll}>{t('tabPostJob')}</Text>
                    </TouchableOpacity>
                </View>

                {projects.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyText}>{t('noActiveJobs')}</Text>
                        <TouchableOpacity onPress={() => router.push('/diaspora/new')}>
                            <Text style={styles.emptyLink}>Create Project</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <FlatList
                        data={projects}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{ paddingHorizontal: 20 }}
                        renderItem={renderProjectCard}
                    />
                )}

                {/* Recent Activity */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{t('inboxSubtitle')}</Text>
                </View>
                <View style={styles.feedItem}>
                    <View style={styles.feedIcon}><Ionicons name="pulse" size={16} color="#0EA5E9" /></View>
                    <View>
                        <Text style={styles.feedText}>{t('notificationDefaultBody')}</Text>
                        <Text style={styles.feedTime}>{t('updatedJustNow')}</Text>
                    </View>
                </View>
            </ScrollView>

            {/* Menu Modal */}
            <Modal visible={menuOpen} transparent animationType="fade">
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMenuOpen(false)}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>{t('accountMenuTitle')}</Text>

                        <TouchableOpacity style={styles.modalItem} onPress={() => { setMenuOpen(false); }}>
                            <Ionicons name="person-circle" size={20} color="#0F172A" />
                            <Text style={styles.modalText}>{t('tabProfile')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.modalItem, styles.modalDanger]}
                            onPress={async () => { setMenuOpen(false); await signOut(); router.replace('/login'); }}
                        >
                            <Ionicons name="log-out" size={20} color="#EF4444" />
                            <Text style={styles.modalDangerText}>{t('signOut')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.modalClose} onPress={() => setMenuOpen(false)}>
                            <Text style={styles.modalCloseText}>{t('cancel')}</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },

    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    helloText: { fontSize: 14, color: '#64748B', fontWeight: '600' },
    subText: { color: '#0F172A', fontSize: 18, fontWeight: '800' },
    headerActions: { flexDirection: 'row', gap: 10 },
    iconBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },

    heroWrap: { paddingHorizontal: 20, marginTop: 16 },
    heroCard: { borderRadius: 26, padding: 22, overflow: 'hidden', gap: 16 },
    heroGlow: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: '#38BDF8', opacity: 0.2, right: -40, top: -50 },
    heroLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
    heroAmount: { color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 4 },
    heroSub: { color: '#CBD5E1', fontSize: 13 },
    heroActions: { flexDirection: 'row', gap: 10 },
    heroBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E2E8F0', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, marginTop: 10 },
    heroBtnText: { color: '#0F172A', fontWeight: '700', fontSize: 14 },

    quickRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 14 },
    quickCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: '#E2E8F0' },
    quickText: { fontSize: 12, fontWeight: '700', color: '#0F172A' },

    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 16, paddingHorizontal: 20 },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
    seeAll: { color: '#0EA5E9', fontWeight: '700', fontSize: 14 },

    projectCard: { width: 280, height: 180, marginRight: 16, borderRadius: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
    projectImage: { width: '100%', height: '100%', justifyContent: 'flex-end' },
    cardOverlay: { height: '100%', justifyContent: 'space-between', padding: 20, borderRadius: 24 },
    statusPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
    activeDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    statusText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    projectTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 4 },
    projectLoc: { color: '#E2E8F0', fontSize: 13, fontWeight: '600' },

    emptyBox: { padding: 30, alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 20, borderStyle: 'dashed', borderWidth: 2, borderColor: '#E2E8F0' },
    emptyText: { fontWeight: '700', color: '#64748B', fontSize: 16 },
    emptyLink: { color: '#38BDF8', marginTop: 5, fontWeight: '700' },

    feedItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, marginHorizontal: 20, borderRadius: 20, marginBottom: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4 },
    feedIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F9FF', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    feedText: { color: '#334155', fontSize: 14, fontWeight: '600' },
    feedTime: { color: '#94A3B8', fontSize: 12, marginTop: 2 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: '#fff', padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 16 },
    modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
    modalItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    modalText: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
    modalDanger: { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 16 },
    modalDangerText: { fontSize: 16, fontWeight: '700', color: '#EF4444' },
    modalClose: { alignItems: 'center', paddingTop: 12 },
    modalCloseText: { color: '#94A3B8', fontWeight: '700' },
});