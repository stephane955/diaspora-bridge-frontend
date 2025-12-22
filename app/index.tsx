import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
    Dimensions, ImageBackground, Platform, ScrollView, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');

export default function DiasporaDashboard() {
    const router = useRouter();
    const { user } = useAuth();
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProjects = async () => {
            if (!user) return;
            const { data } = await supabase
                .from('projects')
                .select('*')
                .eq('owner_id', user.id)
                .order('created_at', { ascending: false });

            if (data) setProjects(data);
            setLoading(false);
        };

        fetchProjects();

        const channel = supabase.channel('projects_channel')
            .on(
                'postgres_changes' as any, // FIX: Cast to 'any' to solve type error
                { event: '*', schema: 'public', table: 'projects' },
                () => { fetchProjects(); }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user]);

    // --- LOGOUT LOGIC ---
    const handleLogout = () => {
        Alert.alert("Sign Out", "Are you sure you want to log out?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Log Out",
                style: "destructive",
                onPress: async () => {
                    await supabase.auth.signOut();
                    router.replace('/');
                }
            }
        ]);
    };

    const renderHeader = () => (
        <View style={styles.headerContainer}>
            <View style={styles.topRow}>
                <View>
                    <Text style={styles.welcomeLabel}>Welcome back,</Text>
                    <Text style={styles.userName}>{user?.user_metadata?.full_name || 'Client'}</Text>
                </View>

                {/* LOGOUT BUTTON */}
                <TouchableOpacity style={styles.profileBtn} onPress={handleLogout}>
                    <Image
                        source={{ uri: 'https://i.pravatar.cc/150?u=a042581f4e29026704d' }}
                        style={styles.profileImg}
                    />
                </TouchableOpacity>
            </View>

            <LinearGradient
                colors={['#0f172a', '#1e293b']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
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
    );

    return (
        <View style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {renderHeader()}

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
                        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
                        // FIX: Logic is now INLINE (No more type errors)
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                activeOpacity={0.9}
                                style={styles.projectCard}
                                onPress={() => router.push(`/diaspora/project/${item.id}`)}
                            >
                                <ImageBackground
                                    source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=1000&auto=format&fit=crop' }}
                                    style={styles.projectImage}
                                    imageStyle={{ borderRadius: 20 }}
                                >
                                    <LinearGradient
                                        colors={['transparent', 'rgba(0,0,0,0.8)']}
                                        style={styles.cardOverlay}
                                    >
                                        <View style={styles.statusPill}>
                                            <View style={styles.activeDot} />
                                            <Text style={styles.statusText}>{item.status || 'Active'}</Text>
                                        </View>

                                        <View>
                                            <Text style={styles.projectTitle}>{item.title}</Text>
                                            <Text style={styles.projectLoc}>{item.city}</Text>
                                        </View>
                                    </LinearGradient>
                                </ImageBackground>
                            </TouchableOpacity>
                        )}
                    />
                )}

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Recent Activity</Text>
                </View>

                <View style={styles.feedItem}>
                    <View style={styles.feedIcon}>
                        <Ionicons name="notifications" size={16} color="#0EA5E9" />
                    </View>
                    <View>
                        <Text style={styles.feedText}>System connected securely.</Text>
                        <Text style={styles.feedTime}>Just now</Text>
                    </View>
                </View>
            </ScrollView>

            <TouchableOpacity
                style={styles.fab}
                activeOpacity={0.8}
                onPress={() => router.push('/diaspora/new')}
            >
                <LinearGradient
                    colors={['#0EA5E9', '#2563EB']}
                    style={styles.fabGradient}
                >
                    <Ionicons name="add" size={32} color="#fff" />
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        ...(Platform.OS === 'web' ? {
            alignSelf: 'center',
            width: '100%',
            maxWidth: 600,
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderColor: '#E2E8F0',
            minHeight: '100vh',
        } : {})
    },
    headerContainer: { padding: 20, paddingTop: 60, backgroundColor: '#fff', borderBottomLeftRadius: 30, borderBottomRightRadius: 30, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 5 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    welcomeLabel: { fontSize: 14, color: '#64748B', fontWeight: '500' },
    userName: { fontSize: 24, color: '#0F172A', fontWeight: '800' },
    profileBtn: { padding: 2, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 25 },
    profileImg: { width: 44, height: 44, borderRadius: 22 },
    portfolioCard: { width: '100%', height: 180, borderRadius: 24, padding: 24, justifyContent: 'space-between', overflow: 'hidden', position: 'relative' },
    glowBlob: { position: 'absolute', width: 120, height: 120, borderRadius: 60, opacity: 0.4 },
    cardLabel: { color: '#94A3B8', fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
    cardAmount: { color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 4 },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    tag: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(74, 222, 128, 0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
    tagText: { color: '#4ADE80', fontSize: 12, fontWeight: '700' },
    cardDate: { color: '#64748B', fontSize: 12 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 16, paddingHorizontal: 20 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
    seeAll: { color: '#0EA5E9', fontWeight: '600', fontSize: 14 },
    projectCard: { width: 280, height: 180, marginRight: 16, borderRadius: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
    projectImage: { width: '100%', height: '100%', justifyContent: 'flex-end' },
    cardOverlay: { height: '100%', justifyContent: 'space-between', padding: 16, borderRadius: 20 },
    statusPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, backdropFilter: 'blur(10px)' },
    activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ADE80', marginRight: 6 },
    statusText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    projectTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
    projectLoc: { color: '#CBD5E1', fontSize: 13 },
    emptyBox: { padding: 20, alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 16 },
    emptyText: { fontWeight: '700', color: '#94A3B8' },
    emptySub: { fontSize: 12, color: '#94A3B8' },
    feedItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, marginHorizontal: 20, borderRadius: 16, marginBottom: 10 },
    feedIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0F9FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    feedText: { color: '#334155', fontSize: 14, fontWeight: '500' },
    feedTime: { color: '#94A3B8', fontSize: 12 },
    fab: { position: 'absolute', bottom: 30, right: 20, shadowColor: "#0EA5E9", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
    fabGradient: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
});