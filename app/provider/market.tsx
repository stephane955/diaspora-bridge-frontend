import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity,
    Image, ActivityIndicator, Modal, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import ProviderNavigation from '@/components/ProviderNavigation';

const CITIES = ["All", "Douala", "Yaoundé", "Bamenda", "Kribi", "Limbe", "Bafoussam"];

export default function MarketScreen() {
    const { user } = useAuth();
    const router = useRouter();

    const [jobs, setJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCity, setSelectedCity] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [userProfile, setUserProfile] = useState<any>(null);

    // Application Modal State
    const [selectedJob, setSelectedJob] = useState<any>(null);
    const [bidAmount, setBidAmount] = useState('');
    const [coverLetter, setCoverLetter] = useState('');
    const [applying, setApplying] = useState(false);

    // --- FETCH JOBS & USER STATUS ---
    const fetchMarketData = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Fetch Provider Profile status
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('verification_status')
                    .eq('id', user.id)
                    .single();
                setUserProfile(profile);
            }

            // 2. Fetch Jobs with Owner details (The Proposed Fix)
            let query = supabase
                .from('projects')
                .select(`
                    *,
                    profiles:owner_id (full_name, avatar_url)
                `)
                .eq('status', 'pending') // Only show open jobs
                .order('created_at', { ascending: false });

            if (selectedCity !== 'All') {
                query = query.eq('city', selectedCity);
            }

            if (searchQuery) {
                query = query.ilike('title', `%${searchQuery}%`);
            }

            const { data, error } = await query;
            if (error) throw error;

            setJobs(data || []);
        } catch (err) {
            console.error("Market Data Error:", err);
        } finally {
            setLoading(false);
        }
    }, [selectedCity, searchQuery, user]);

    useFocusEffect(
        useCallback(() => { fetchMarketData(); }, [fetchMarketData])
    );

    // --- APPLY LOGIC ---
    const handleApply = async () => {
        if (userProfile?.verification_status !== 'verified') {
            Alert.alert(
                "Verification Required",
                "You must verify your identity before you can submit proposals.",
                [
                    { text: "Later", style: "cancel" },
                    { text: "Verify Now", onPress: () => { setSelectedJob(null); router.push('/provider/verification'); } }
                ]
            );
            return;
        }

        if (!bidAmount || !coverLetter) {
            Alert.alert("Missing Fields", "Please enter a bid amount and a short note.");
            return;
        }

        setApplying(true);
        try {
            const { error } = await supabase.from('project_applications').insert({
                project_id: selectedJob.id,
                provider_id: user?.id,
                bid_amount: parseFloat(bidAmount),
                cover_letter: coverLetter,
                status: 'pending'
            });

            if (error) {
                if (error.code === '23505') {
                    Alert.alert("Already Applied", "You have already sent a proposal for this job.");
                } else {
                    throw error;
                }
            } else {
                Alert.alert("Success", "Proposal sent successfully!");
                setSelectedJob(null);
                setBidAmount('');
                setCoverLetter('');
            }
        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setApplying(false);
        }
    };

    const renderJob = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={styles.card}
            activeOpacity={0.9}
            onPress={() => setSelectedJob(item)}
        >
            <Image
                source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5' }}
                style={styles.cardImage}
            />
            <LinearGradient colors={['transparent', 'rgba(15,23,42,0.9)']} style={styles.cardOverlay}>
                <View style={styles.cardContent}>
                    <View style={styles.badgeRow}>
                        <View style={styles.cityBadge}>
                            <Text style={styles.cityBadgeText}>{item.city?.toUpperCase() || "CAMEROON"}</Text>
                        </View>
                        {/* Displaying Client Name from the Joined Profile */}
                        {item.profiles?.full_name && (
                            <View style={styles.clientBadge}>
                                <Ionicons name="person-outline" size={10} color="#fff" />
                                <Text style={styles.clientText}>{item.profiles.full_name}</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.cardBudget}>Budget: {item.budget?.toLocaleString()} CFA</Text>
                </View>
                <View style={styles.applyBtnIcon}>
                    <Ionicons name="chevron-forward" size={20} color="#fff" />
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {/* --- HEADER --- */}
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <Text style={styles.title}>Find Work</Text>
                    {userProfile?.verification_status === 'verified' && (
                        <View style={styles.verifiedBadge}>
                            <Ionicons name="checkmark-circle" size={18} color="#0EA5E9" />
                            <Text style={styles.verifiedText}>Verified</Text>
                        </View>
                    )}
                </View>

                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#94A3B8" />
                    <TextInput
                        style={styles.input}
                        placeholder="Search projects..."
                        placeholderTextColor="#94A3B8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={fetchMarketData}
                        returnKeyType="search"
                    />
                </View>

                <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={CITIES}
                    keyExtractor={item => item}
                    contentContainerStyle={{ gap: 8, paddingBottom: 10 }}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[styles.chip, selectedCity === item && styles.chipActive]}
                            onPress={() => setSelectedCity(item)}
                        >
                            <Text style={[styles.chipText, selectedCity === item && styles.textActive]}>{item}</Text>
                        </TouchableOpacity>
                    )}
                />
            </View>

            {/* --- JOB LIST --- */}
            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#0F172A" /></View>
            ) : (
                <FlatList
                    data={jobs}
                    keyExtractor={item => item.id.toString()}
                    renderItem={renderJob}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="briefcase-outline" size={48} color="#CBD5E1" />
                            <Text style={styles.emptyText}>No open jobs found.</Text>
                            <Text style={styles.emptySub}>Try changing filters or check back later.</Text>
                        </View>
                    }
                />
            )}

            {/* --- APPLY MODAL --- */}
            <Modal visible={!!selectedJob} transparent animationType="slide">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Submit Proposal</Text>
                            <TouchableOpacity onPress={() => setSelectedJob(null)}>
                                <Ionicons name="close-circle" size={28} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.jobTitle}>{selectedJob?.title}</Text>
                        <Text style={styles.jobBudget}>Client's Budget: {selectedJob?.budget?.toLocaleString()} CFA</Text>

                        <Text style={styles.label}>Your Bid (CFA)</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="e.g. 50000"
                            keyboardType="numeric"
                            value={bidAmount}
                            onChangeText={setBidAmount}
                        />

                        <Text style={styles.label}>Cover Letter</Text>
                        <TextInput
                            style={[styles.modalInput, { height: 100, textAlignVertical: 'top' }]}
                            placeholder="Explain why you are the best fit for this project..."
                            multiline
                            value={coverLetter}
                            onChangeText={setCoverLetter}
                        />

                        <TouchableOpacity style={styles.submitBtn} onPress={handleApply} disabled={applying}>
                            {applying ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.submitText}>Send Proposal</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <ProviderNavigation />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { paddingTop: 60, paddingHorizontal: 20, backgroundColor: '#fff', paddingBottom: 10 },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    title: { fontSize: 28, fontWeight: '800', color: '#0F172A' },
    verifiedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F9FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4 },
    verifiedText: { fontSize: 12, fontWeight: '700', color: '#0EA5E9' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 12, height: 48, marginBottom: 16 },
    input: { flex: 1, marginLeft: 10, fontSize: 16, color: '#0F172A' },
    chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9' },
    chipActive: { backgroundColor: '#0F172A' },
    chipText: { color: '#64748B', fontWeight: '600' },
    textActive: { color: '#fff' },
    listContent: { padding: 20, paddingBottom: 100 },
    card: { height: 210, borderRadius: 24, marginBottom: 20, overflow: 'hidden', backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
    cardImage: { width: '100%', height: '100%' },
    cardOverlay: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', padding: 20 },
    cardContent: { flex: 1 },
    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    cityBadge: { backgroundColor: '#0EA5E9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    cityBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    clientBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
    clientText: { color: '#fff', fontSize: 10, fontWeight: '600' },
    cardTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 4 },
    cardBudget: { color: '#CBD5E1', fontSize: 14, fontWeight: '600' },
    applyBtnIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
    emptyState: { alignItems: 'center', marginTop: 60, gap: 10 },
    emptyText: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
    emptySub: { color: '#64748B' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
    jobTitle: { fontSize: 17, fontWeight: '700', color: '#334155' },
    jobBudget: { fontSize: 14, color: '#64748B', marginBottom: 20 },
    label: { fontSize: 13, fontWeight: '700', color: '#64748B', marginBottom: 8, marginTop: 16, textTransform: 'uppercase' },
    modalInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 16, fontSize: 16, color: '#0F172A' },
    submitBtn: { backgroundColor: '#0F172A', padding: 18, borderRadius: 18, alignItems: 'center', marginTop: 30, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
    submitText: { color: '#fff', fontWeight: '800', fontSize: 16 }
});