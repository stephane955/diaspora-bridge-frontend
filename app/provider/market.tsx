import React, { useState, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    Modal, Alert, KeyboardAvoidingView, Platform, Share, Animated
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NavigationBar from '@/components/NavigationBar';
import PulseLoader from '@/components/PulseLoader';
import ScreenGradient from '@/components/ScreenGradient';
import { theme } from '@/constants/theme';
import { mediumFeedback, successFeedback, lightFeedback } from '@/utils/haptics';

import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';

const CITIES = ["All", "Douala", "Yaoundé", "Bamenda", "Kribi", "Limbe", "Bafoussam"];
const blurhash = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

export default function MarketScreen() {
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const router = useRouter();
    const { t } = useLanguage();

    // --- STATE ---
    const [jobs, setJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCity, setSelectedCity] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [userProfile, setUserProfile] = useState<any>(null);

    // Modal State
    const [selectedJob, setSelectedJob] = useState<any>(null);
    const [bidAmount, setBidAmount] = useState('');
    const [coverLetter, setCoverLetter] = useState('');
    const [materialEstimate, setMaterialEstimate] = useState('');
    const [timeToCompletionDays, setTimeToCompletionDays] = useState('');
    const [applying, setApplying] = useState(false);

    // --- FETCH DATA ---
    const fetchMarketData = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Get Provider Status & SKILLS
            let userSkills: string[] = [];
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('verification_status, skills')
                    .eq('id', user.id)
                    .single();
                setUserProfile(profile);
                userSkills = profile?.skills || [];
            }

            // 2. Build Query
            let query = supabase
                .from('projects')
                .select(`*, profiles:owner_id (full_name, avatar_url)`)
                .eq('status', 'pending')
                .is('assigned_provider_id', null)
                .order('created_at', { ascending: false });

            // 3. Apply Filters
            if (selectedCity !== 'All') {
                query = query.eq('city', selectedCity);
            }
            if (searchQuery) {
                query = query.ilike('title', `%${searchQuery}%`);
            }

            const { data, error } = await query;
            if (error) throw error;

            // 4. --- SMART SORT ---
            let finalJobs = data || [];

            if (userSkills.length > 0) {
                finalJobs = finalJobs.sort((a, b) => {
                    const aMatch = userSkills.some(skill => a.title.toLowerCase().includes(skill.toLowerCase()));
                    const bMatch = userSkills.some(skill => b.title.toLowerCase().includes(skill.toLowerCase()));

                    if (aMatch && !bMatch) return -1; // A comes first
                    if (!aMatch && bMatch) return 1;  // B comes first
                    return 0; // Maintain date order
                });
            }

            setJobs(finalJobs);

        } catch (err) {
            console.error("Market Error:", err);
        } finally {
            setLoading(false);
        }
    }, [selectedCity, searchQuery, user]);

    useFocusEffect(useCallback(() => { fetchMarketData(); }, [fetchMarketData]));

    const successScale = useRef(new Animated.Value(0)).current;
    const [showSuccess, setShowSuccess] = useState(false);

    const handleShareJob = async (job: any) => {
        lightFeedback();
        try {
            await Share.share({
                message: `${t('brandName') || "Diaspora Bridge"}: Check out this job in ${job.city}!\n\n*${job.title}*\nBudget: ${job.budget?.toLocaleString()} CFA\n\nApply now on the app!`
            });
        } catch (error) {
            console.log(error);
        }
    };

    const handleHideJob = (jobId: string) => {
        mediumFeedback();
        Alert.alert(t('hide') || "Hide Job", "Remove this from your feed?", [
            { text: t('cancel') || "Cancel", style: "cancel" },
            {
                text: t('hide') || "Hide",
                style: 'destructive',
                onPress: async () => {
                    // Optimistic update
                    setJobs(prev => prev.filter(j => j.id !== jobId));

                    // Fire and forget DB update
                    if (user) {
                        await supabase.from('hidden_projects').insert({
                            user_id: user.id,
                            project_id: jobId
                        });
                    }
                }
            }
        ]);
    };

    const handleApply = async () => {
        if (userProfile?.verification_status !== 'verified') {
            Alert.alert(
                "ID Verification Required",
                t('getVerified') || "Get verified to apply for jobs.",
                [
                    { text: "Later", style: "cancel" },
                    { text: t('verified') || "Verify Now", onPress: () => { setSelectedJob(null); router.push('/provider/profile'); } }
                ]
            );
            return;
        }

        if (!bidAmount || !coverLetter) {
            Alert.alert("Missing Info", t('missingFields') || "Please fill all fields.");
            return;
        }

        setApplying(true);
        try {
            const payload: Record<string, unknown> = {
                project_id: selectedJob.id,
                provider_id: user?.id,
                bid_amount: parseFloat(bidAmount),
                cover_letter: coverLetter,
                status: 'pending',
            };
            if (materialEstimate.trim()) payload.material_estimate = parseFloat(materialEstimate) || null;
            if (timeToCompletionDays.trim()) payload.time_to_completion_days = parseInt(timeToCompletionDays, 10) || null;
            const { error } = await supabase.from('project_applications').insert(payload);

            if (error) {
                if (error.code === '23505') Alert.alert("Already Applied", "You have already bid on this job.");
                else throw error;
            } else {
                successFeedback();
                setShowSuccess(true);
                Animated.spring(successScale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
                setTimeout(() => {
                    setShowSuccess(false);
                    successScale.setValue(0);
                    setSelectedJob(null);
                    setBidAmount('');
                    setCoverLetter('');
                    setMaterialEstimate('');
                    setTimeToCompletionDays('');
                }, 1800);
            }
        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setApplying(false);
        }
    };

    // --- RENDER ITEM (IMMERSIVE CARD) ---
    const renderJob = ({ item }: { item: any }) => {
        // Check for Skill Match
        const isRecommended = userProfile?.skills?.some((s: string) =>
            item.title.toLowerCase().includes(s.toLowerCase())
        );

        return (
            <TouchableOpacity
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => { mediumFeedback(); setSelectedJob(item); }}
            >
                {/* 1. Full Bleed Image */}
                <Image
                    source={item.image_url || 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5'}
                    style={styles.cardImage}
                    placeholder={blurhash}
                    contentFit="cover"
                    transition={500}
                />

                {/* 2. Dark Gradient Overlay */}
                <LinearGradient
                    colors={['rgba(0,0,0,0.1)', 'rgba(15,23,42,0.6)', '#0F172A']}
                    style={styles.cardOverlay}
                >
                    {/* Top Row: Badges & Actions */}
                    <View style={styles.topRow}>
                        <View style={styles.badgesLeft}>
                            {isRecommended && (
                                <View style={styles.matchBadge}>
                                    <Ionicons name="sparkles" size={10} color="#FFD700" />
                                    <Text style={styles.matchText}>{t('match') || "MATCH"}</Text>
                                </View>
                            )}
                            <View style={styles.cityBadge}>
                                <Ionicons name="location" size={10} color="#fff" />
                                <Text style={styles.cityText}>{item.city?.toUpperCase()}</Text>
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            {/* SHARE BUTTON (Added) */}
                            <TouchableOpacity onPress={() => handleShareJob(item)} style={styles.iconBtn}>
                                <Ionicons name="share-social" size={16} color="#fff" />
                            </TouchableOpacity>

                            {/* HIDE BUTTON */}
                            <TouchableOpacity onPress={() => handleHideJob(item.id)} style={styles.iconBtn}>
                                <Ionicons name="eye-off" size={16} color="rgba(255,255,255,0.7)" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Bottom Content */}
                    <View style={styles.bottomContent}>
                        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>

                        <View style={styles.priceRow}>
                            <View>
                                <Text style={styles.budgetLabel}>
                                    {t('budget')?.toUpperCase() || "ESTIMATED BUDGET"}
                                </Text>
                                <Text style={styles.cardBudget}>{(item.budget || 0).toLocaleString()} CFA</Text>
                            </View>
                            <View style={styles.arrowBtn}>
                                <Ionicons name="arrow-forward" size={20} color="#0F172A" />
                            </View>
                        </View>
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <NavigationBar title={t('marketTitle') ?? 'Market'} showBack={false} onMenuPress={() => router.replace('/provider')} dynamicColor={theme.colors.emerald} />

            {/* --- PREMIUM HEADER --- */}
            <View style={styles.headerContainer}>
                <LinearGradient
                    colors={['#0F172A', '#1E293B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.headerGradient}
                >
                    {/* Title Row */}
                    <View style={styles.headerTop}>
                        <Text style={styles.headerTitle}>{t('marketTitle') || "Find Work"}</Text>
                        {userProfile?.verification_status === 'verified' && (
                            <View style={styles.verifiedBadge}>
                                <Ionicons name="checkmark-circle" size={14} color="#0EA5E9" />
                                <Text style={styles.verifiedText}>{t('verified') || "Verified"}</Text>
                            </View>
                        )}
                    </View>

                    {/* Search Bar (Glass Effect) */}
                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={20} color="rgba(255,255,255,0.5)" />
                        <TextInput
                            style={styles.input}
                            placeholder={t('searchPlaceholder') || "Search projects (e.g. Plumbing)"}
                            placeholderTextColor="rgba(255,255,255,0.5)"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            onSubmitEditing={fetchMarketData}
                            returnKeyType="search"
                        />
                    </View>

                    {/* Filter Chips */}
                    <View style={{ height: 40, marginTop: 12 }}>
                        <FlashList
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            data={CITIES}
                            estimatedItemSize={80}
                            renderItem={({ item }: any) => (
                                <TouchableOpacity
                                    style={[styles.chip, selectedCity === item && styles.chipActive]}
                                    onPress={() => setSelectedCity(item)}
                                >
                                    <Text style={[styles.chipText, selectedCity === item && styles.chipTextActive]}>
                                        {item}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            contentContainerStyle={{ paddingHorizontal: 0 }}
                        />
                    </View>
                </LinearGradient>
            </View>

            {/* --- LIST --- */}
            {loading ? (
                <View style={styles.center}><PulseLoader /></View>
            ) : (
                <View style={styles.listContainer}>
                    <FlashList
                        data={jobs}
                        renderItem={renderJob}
                        estimatedItemSize={240}
                        contentContainerStyle={{ paddingBottom: 120, paddingTop: theme.spacing.lg, paddingHorizontal: theme.spacing.lg }}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Ionicons name="briefcase-outline" size={48} color="#CBD5E1" />
                                <Text style={styles.emptyText}>{t('noActiveJobs') || "No open jobs found."}</Text>
                                <Text style={styles.emptySub}>Try changing the city filter.</Text>
                            </View>
                        }
                    />
                </View>
            )}

            {/* --- APPLY MODAL --- */}
            <Modal visible={!!selectedJob} transparent animationType="slide">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <TouchableOpacity style={{flex:1}} onPress={() => setSelectedJob(null)} />
                    <View style={styles.modalContent}>
                        <View style={styles.modalHandle} />

                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('common.submit') || "Submit Proposal"}</Text>
                            <TouchableOpacity onPress={() => setSelectedJob(null)}>
                                <Ionicons name="close-circle" size={28} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.jobTitle}>{selectedJob?.title}</Text>
                        <Text style={styles.jobBudget}>
                            {t('clientBudget') || "Client's Budget"}: <Text style={{fontWeight:'800', color:'#0F172A'}}>{selectedJob?.budget?.toLocaleString()} CFA</Text>
                        </Text>

                        <Text style={styles.label}>{t('yourBid') || "Your Bid Amount"} (CFA)</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="e.g. 50000"
                            keyboardType="numeric"
                            value={bidAmount}
                            onChangeText={setBidAmount}
                        />

                        <Text style={styles.label}>Material Estimate (CFA)</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="e.g. 15000"
                            keyboardType="numeric"
                            value={materialEstimate}
                            onChangeText={setMaterialEstimate}
                        />

                        <Text style={styles.label}>Time to Completion (days)</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="e.g. 14"
                            keyboardType="numeric"
                            value={timeToCompletionDays}
                            onChangeText={setTimeToCompletionDays}
                        />

                        <Text style={styles.label}>Cover Letter</Text>
                        <TextInput
                            style={[styles.modalInput, { height: 100, textAlignVertical: 'top' }]}
                            placeholder="I have 5 years experience in..."
                            multiline
                            value={coverLetter}
                            onChangeText={setCoverLetter}
                        />

                        <TouchableOpacity style={styles.submitBtn} onPress={handleApply} disabled={applying} activeOpacity={0.7}>
                            {applying ? <PulseLoader size={24} color="#fff" /> : <Text style={styles.submitText}>{t('common.submit') || "Send Proposal"}</Text>}
                        </TouchableOpacity>

                        {showSuccess && (
                            <Animated.View style={[styles.successOverlay, { transform: [{ scale: successScale }] }]}>
                                <Ionicons name="checkmark-circle" size={64} color={theme.colors.emerald} />
                                <Text style={styles.successText}>Proposal Sent!</Text>
                            </Animated.View>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // --- NEW PREMIUM HEADER ---
    headerContainer: {
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        overflow: 'hidden',
        elevation: 5,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 }
    },
    headerGradient: {
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 24
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: -0.5
    },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        gap: 6
    },
    verifiedText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#fff'
    },

    // Search Bar
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 50,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    input: {
        flex: 1,
        marginLeft: 10,
        fontSize: 16,
        color: '#fff'
    },

    // Chips
    chip: {
        paddingHorizontal: 18,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginRight: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    chipActive: {
        backgroundColor: '#fff'
    },
    chipText: {
        color: 'rgba(255,255,255,0.7)',
        fontWeight: '600',
        fontSize: 13
    },
    chipTextActive: {
        color: '#0F172A'
    },

    // List
    listContainer: { flex: 1, paddingHorizontal: 20 },

    // --- IMMERSIVE CARD STYLES ---
    card: {
        height: 240,
        borderRadius: 24,
        marginBottom: 20,
        backgroundColor: '#1E293B',
        overflow: 'hidden',
        elevation: 5,
        shadowColor: '#0F172A',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 }
    },
    cardImage: { width: '100%', height: '100%', position: 'absolute' },
    cardOverlay: { flex: 1, justifyContent: 'space-between', padding: 16 },

    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    badgesLeft: { flexDirection: 'row', gap: 8 },

    matchBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#FFD700', gap: 4 },
    matchText: { color: '#FFD700', fontSize: 10, fontWeight: '800' },

    cityBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12, overflow: 'hidden', gap: 4 },
    cityText: { color: '#fff', fontSize: 11, fontWeight: '600' },

    iconBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },

    bottomContent: { gap: 4 },
    cardTitle: { fontSize: 22, fontWeight: '800', color: '#fff', lineHeight: 26, marginBottom: 8, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },

    priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    budgetLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
    cardBudget: { color: '#fff', fontSize: 20, fontWeight: '700' },

    arrowBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },

    // --- EMPTY STATE ---
    emptyState: { alignItems: 'center', marginTop: 60, gap: 10 },
    emptyText: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
    emptySub: { color: '#64748B' },

    // --- MODAL ---
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
    modalHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
    jobTitle: { fontSize: 18, fontWeight: '700', color: '#334155' },
    jobBudget: { fontSize: 14, color: '#64748B', marginBottom: 20 },
    label: { fontSize: 13, fontWeight: '700', color: '#64748B', marginBottom: 8, marginTop: 16, textTransform: 'uppercase' },
    modalInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 16, fontSize: 16, color: '#0F172A' },
    submitBtn: { backgroundColor: theme.colors.primary, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 30 },
    submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },

    successOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: theme.radii.xl,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    successText: {
        fontSize: 22,
        ...theme.typography.title,
        color: theme.colors.emerald,
    },
});