import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
    ImageBackground, Platform, ScrollView, Pressable, ListRenderItem
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

// --- NEW IMPORTS ---
import ProfileDrawer from '@/components/ProfileDrawer';
import NavigationBar from '@/components/NavigationBar';
import ProjectStories from '@/components/ProjectStories';
import GlassNavigation from '@/components/GlassNavigation';

export default function DiasporaDashboard() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuth();
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [photoUri, setPhotoUri] = useState<string | null>(null);

    // --- 1. Data Fetching ---
    const fetchProjects = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        const { data } = await supabase
            .from('projects')
            .select('*')
            .eq('owner_id', user.id)
            .order('created_at', { ascending: false });

        if (data) setProjects(data);
        setLoading(false);
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

    useEffect(() => {
        const loadPhoto = async () => {
            const stored = await AsyncStorage.getItem('profilePhoto_client');
            if (stored) setPhotoUri(stored);
        };
        loadPhoto();
    }, []);

    // --- 2. Handlers ---
    const handlePhotoChange = async (uri: string | null) => {
        setPhotoUri(uri);
        if (uri) {
            await AsyncStorage.setItem('profilePhoto_client', uri);
        } else {
            await AsyncStorage.removeItem('profilePhoto_client');
        }
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        await AsyncStorage.removeItem('loggedIn');
        setDrawerOpen(false);
        router.replace('/login');
    };

    // --- 3. Render Items ---
    const renderProjectCard: ListRenderItem<any> = ({ item }) => (
        <Pressable
            style={({ pressed }) => [
                styles.projectCard,
                { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }
            ]}
            onPress={() => {
                router.push('/diaspora/timeline');
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
                            <Text style={styles.statusText}>{item.status || 'Active'}</Text>
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
            {/* A. Sticky Navigation Bar */}
            <NavigationBar
                title="Diaspora Dashboard"
                subtitle="Finance-grade control"
                onMenuPress={() => setDrawerOpen(true)}
                onRefresh={fetchProjects}
                showBack={false} // Hide back arrow
            />

            {/* B. Scrollable Content */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 130 }} // Extra padding for Glass Navigation
            >
                {/* 1. Header & Greeting */}
                <View style={styles.headerSection}>
                    <View>
                        <Text style={styles.welcomeLabel}>Welcome back,</Text>
                        <Text style={styles.userName}>{user?.user_metadata?.full_name || 'Client'}</Text>
                    </View>
                    <TouchableOpacity style={styles.profileBtn} onPress={() => setDrawerOpen(true)}>
                        <Image
                            source={{ uri: photoUri || 'https://i.pravatar.cc/150?u=a042581f4e29026704d' }}
                            style={styles.profileImg}
                        />
                    </TouchableOpacity>
                </View>

                {/* 2. NEW: Project Stories (Instagram Style) */}
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
                            <Text style={styles.cardLabel}>Total Escrow Balance</Text>
                            <Text style={styles.cardAmount}>2,500,000 CFA</Text>
                        </View>

                        <View style={styles.cardFooter}>
                            <View style={styles.tag}>
                                <Ionicons name="shield-checkmark" size={12} color="#4ADE80" />
                                <Text style={styles.tagText}>Secured</Text>
                            </View>
                            <Text style={styles.cardDate}>Updated just now</Text>
                        </View>
                    </LinearGradient>
                </View>

                {/* 4. Projects List */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>My Projects</Text>
                    <TouchableOpacity onPress={() => router.push('/diaspora/new')}>
                        <Text style={styles.seeAll}>+ New</Text>
                    </TouchableOpacity>
                </View>

                {projects.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyText}>No projects yet.</Text>
                        <Text style={styles.emptySub}>Tap "+ New" to start building.</Text>
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
                    <Text style={styles.sectionTitle}>Recent Activity</Text>
                </View>
                <View style={styles.feedItem}>
                    <View style={styles.feedIcon}><Ionicons name="notifications" size={16} color="#0EA5E9" /></View>
                    <View>
                        <Text style={styles.feedText}>System connected securely.</Text>
                        <Text style={styles.feedTime}>Just now</Text>
                    </View>
                </View>
            </ScrollView>

            {/* C. NEW: Glass Navigation (Floating) */}
            <GlassNavigation />

            {/* D. Drawer Overlay */}
            <ProfileDrawer
                visible={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                onSignOut={handleSignOut}
                name={user?.user_metadata?.full_name || 'Client'}
                email={user?.email}
                roleLabel="Diaspora Client"
                photoUri={photoUri}
                onChangePhoto={handlePhotoChange}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC', ...(Platform.OS === 'web' ? { alignSelf: 'center', width: '100%', maxWidth: 600, borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#E2E8F0', minHeight: '100vh' } : {}) },

    // Header
    headerSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, marginBottom: 5 },
    welcomeLabel: { fontSize: 14, color: '#64748B', fontWeight: '500' },
    userName: { fontSize: 24, color: '#0F172A', fontWeight: '800' },
    profileBtn: { padding: 2, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 25 },
    profileImg: { width: 44, height: 44, borderRadius: 22 },

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
});