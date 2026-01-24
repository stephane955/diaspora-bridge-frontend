import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, ImageBackground, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

export default function ProviderProfileScreen() {
    const router = useRouter();
    const { user, signOut } = useAuth();
    const { t } = useLanguage();

    const [profile, setProfile] = useState<any>(null);
    const [portfolio, setPortfolio] = useState<any[]>([]);

    useEffect(() => {
        if (user) {
            fetchProfile();
            fetchPortfolio();
        }
    }, [user]);

    const fetchProfile = async () => {
        const { data } = await supabase.from('profiles').select('*').eq('id', user?.id).single();
        if (data) setProfile(data);
    };

    const fetchPortfolio = async () => {
        // Assuming you have a 'portfolios' table or similar logic
        // If not, this gracefully handles empty data
        const { data } = await supabase.from('project_updates').select('*').eq('provider_id', user?.id).limit(5);
        if (data) setPortfolio(data);
    };

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={{ paddingBottom: 150 }} showsVerticalScrollIndicator={false}>

                {/* --- HERO --- */}
                <ImageBackground
                    source={{ uri: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=2070&auto=format&fit=crop' }}
                    style={styles.headerImage}
                >
                    <LinearGradient colors={['transparent', '#0F172A']} style={styles.gradient}>
                        <View style={styles.headerContent}>
                            <Image
                                source={{ uri: profile?.avatar_url || 'https://i.pravatar.cc/150?u=pro' }}
                                style={styles.avatar}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.name}>{profile?.full_name || "Provider Name"}</Text>
                                <Text style={styles.role}>Professional Contractor</Text>
                                <View style={styles.ratingRow}>
                                    <Ionicons name="star" size={14} color="#F59E0B" />
                                    <Text style={styles.ratingText}>4.9 (12 Jobs)</Text>
                                </View>
                            </View>
                        </View>
                    </LinearGradient>
                </ImageBackground>

                {/* --- STATS GRID --- */}
                <View style={styles.statsContainer}>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>12</Text>
                        <Text style={styles.statLabel}>Completed</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>98%</Text>
                        <Text style={styles.statLabel}>On Time</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>3</Text>
                        <Text style={styles.statLabel}>Years Exp</Text>
                    </View>
                </View>

                {/* --- PORTFOLIO --- */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>{t('portfolioTitle') || "Portfolio"}</Text>
                        <TouchableOpacity><Text style={styles.link}>{t('common.seeAll')}</Text></TouchableOpacity>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.portfolioScroll}>
                        <TouchableOpacity style={styles.addPortfolioBtn}>
                            <Ionicons name="add" size={32} color="#CBD5E1" />
                            <Text style={styles.addText}>Add Work</Text>
                        </TouchableOpacity>

                        {portfolio.map((item, index) => (
                            <Image
                                key={index}
                                source={{ uri: item.image_url || 'https://via.placeholder.com/150' }}
                                style={styles.portfolioImg}
                            />
                        ))}
                    </ScrollView>
                </View>

                {/* --- MENU --- */}
                <View style={styles.menuContainer}>
                    <TouchableOpacity style={styles.menuItem} onPress={() => {}}>
                        <Text style={styles.menuText}>Skill Tags</Text>
                        <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.menuItem} onPress={() => {}}>
                        <Text style={styles.menuText}>Verification Status</Text>
                        <View style={styles.verifiedBadge}><Text style={styles.verifiedText}>Verified</Text></View>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.menuItem} onPress={async () => { await signOut(); router.replace('/login'); }}>
                        <Text style={[styles.menuText, { color: '#EF4444' }]}>{t('signOut')}</Text>
                        <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F1F5F9' },

    headerImage: { width: '100%', height: 280 },
    gradient: { flex: 1, justifyContent: 'flex-end', padding: 20 },
    headerContent: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 10 },
    avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#fff' },
    name: { fontSize: 22, fontWeight: '800', color: '#fff' },
    role: { color: '#CBD5E1', fontSize: 14, marginBottom: 4 },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
    ratingText: { color: '#F59E0B', fontWeight: '700', fontSize: 12 },

    statsContainer: { flexDirection: 'row', backgroundColor: '#fff', margin: 20, marginTop: -20, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 5 },
    statCard: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
    statLabel: { color: '#64748B', fontSize: 12, fontWeight: '600' },
    statDivider: { width: 1, backgroundColor: '#E2E8F0' },

    section: { marginBottom: 20 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
    link: { color: '#0EA5E9', fontWeight: '600' },

    portfolioScroll: { paddingHorizontal: 20, gap: 12 },
    addPortfolioBtn: { width: 120, height: 160, borderRadius: 16, borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
    addText: { color: '#94A3B8', fontWeight: '700', marginTop: 8 },
    portfolioImg: { width: 200, height: 160, borderRadius: 16, backgroundColor: '#CBD5E1' },

    menuContainer: { paddingHorizontal: 20 },
    menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 18, borderRadius: 16, marginBottom: 10 },
    menuText: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
    verifiedBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    verifiedText: { color: '#16A34A', fontSize: 12, fontWeight: '700' },
});