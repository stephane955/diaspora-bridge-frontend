import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Image, ScrollView,
    ImageBackground, Alert, ActivityIndicator, Modal, Pressable, TextInput, KeyboardAvoidingView, Platform, StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { mediumFeedback, successFeedback } from '@/utils/haptics';
import PremiumHeader from '@/components/PremiumHeader';
import PremiumEmptyState from '@/components/PremiumEmptyState';
import { providerMenuItems } from '@/constants/premiumMenus';
import PulseLoader from '@/components/PulseLoader';
import { theme } from '@/constants/theme';
import { SCROLL_BOTTOM_INSET, PREMIUM_BG, PREMIUM_GOLD, TEXT_PRIMARY, TEXT_SECONDARY } from '@/constants/layout';

type HubItem = {
    key: string;
    href: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    bg: string;
};

const HUB_ITEMS: HubItem[] = [
    { key: 'requests', href: '/provider/requests', label: 'Requests', icon: 'document-text-outline', color: theme.colors.active, bg: theme.colors.active + '18' },
    { key: 'verification', href: '/provider/verification', label: 'Verification', icon: 'shield-checkmark-outline', color: theme.colors.emerald, bg: theme.colors.emerald + '18' },
    { key: 'payout-setup', href: '/provider/payout-setup', label: 'Payouts', icon: 'card-outline', color: '#6366F1', bg: '#6366F118' },
    { key: 'withdraw', href: '/provider/withdraw', label: 'Withdraw', icon: 'cash-outline', color: theme.colors.warning, bg: theme.colors.warning + '18' },
    { key: 'settings', href: '/provider/settings', label: 'Settings', icon: 'settings-outline', color: theme.colors.textMuted, bg: theme.colors.surfaceAlt },
];

// --- CONSTANTS ---
const LANGUAGES = [
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
    { code: 'it', label: 'Italiano', flag: '🇮🇹' },
];

const SKILL_CATEGORIES = [
    "General Construction", "Plumbing", "Electrical", "Painting", "Carpentry",
    "Roofing", "HVAC", "Tiling", "Architecture", "Administrative", "Masonry", "Welding"
];

const CITIES = ["Douala", "Yaoundé", "Bamenda", "Kribi", "Limbe", "Bafoussam"];

export default function ProviderProfileScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user, signOut } = useAuth();
    const { t, setLanguage, language, getFlag } = useLanguage();

    // --- STATE ---
    const [profile, setProfile] = useState<any>(null);
    const [portfolio, setPortfolio] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Modals
    const [skillsModalVisible, setSkillsModalVisible] = useState(false);
    const [langModalVisible, setLangModalVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [cityModalVisible, setCityModalVisible] = useState(false);

    // Forms
    const [formName, setFormName] = useState('');
    const [formCity, setFormCity] = useState('');
    const [formBio, setFormBio] = useState('');
    const [mySkills, setMySkills] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    // --- FETCH ---
    const fetchData = useCallback(async () => {
        if (!user) return;
        try {
            const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (data) {
                setProfile(data);
                setMySkills(data.skills || []);
                setFormName(data.full_name || '');
                setFormCity(data.city || '');
                setFormBio(data.bio || '');
            }
            const { data: portData } = await supabase
                .from('project_updates')
                .select('*')
                .eq('provider_id', user.id)
                .not('image_url', 'is', null)
                .limit(5);
            if (portData) setPortfolio(portData);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }, [user]);

    useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

    // --- HANDLERS ---
    const handleSelectCity = (city: string) => { setFormCity(city); setCityModalVisible(false); };
    const handleVerificationPress = () => {
        if (profile?.verification_status === 'verified') Alert.alert(t('verified'), t('identityConfirmed'));
        else router.push('/provider/verification');
    };
    const handleSignOut = async () => {
        Alert.alert(t('signOut'), t('signOutConfirmBody'), [
            { text: t('cancel'), style: 'cancel' },
            {
                text: t('signOut'),
                style: 'destructive',
                onPress: async () => {
                    successFeedback();
                    await signOut();
                },
            },
        ]);
    };
    const handleLanguageSelect = (code: any) => { setLanguage(code); setLangModalVisible(false); };

    const saveSkills = async () => {
        setSaving(true);
        try {
            await supabase.from('profiles').update({ skills: mySkills }).eq('id', user?.id);
            setSkillsModalVisible(false);
            successFeedback();
            Alert.alert(t('success'), t('profileSaved'));
        } catch (err: any) { Alert.alert("Error", err.message); } finally { setSaving(false); }
    };

    const saveProfileDetails = async () => {
        setSaving(true);
        try {
            const updates = { full_name: formName, city: formCity, bio: formBio, updated_at: new Date() };
            await supabase.from('profiles').update(updates).eq('id', user?.id);
            setProfile({ ...profile, ...updates });
            setEditModalVisible(false);
            successFeedback();
            Alert.alert(t('success'), t('profileUpdated'));
        } catch (err: any) { Alert.alert("Error", err.message); } finally { setSaving(false); }
    };

    const toggleSkill = (skill: string) => {
        setMySkills(prev => prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]);
    };

    if (loading) return (
        <View style={styles.screen}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <PremiumHeader
                title={t('tabProfile')}
                subtitle={t('accountSettings')}
                menuItems={providerMenuItems(router, t)}
            />
            <View style={styles.center}><PulseLoader color={theme.colors.emerald} /></View>
        </View>
    );
    const isVerified = profile?.verification_status === 'verified';

    return (
        <View style={styles.screen}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <PremiumHeader
                title={profile?.full_name || t('tabProfile')}
                subtitle={profile?.city || t('accountSettings')}
                menuItems={providerMenuItems(router, t)}
            />

            {/* ============================================================
                1. FIXED HEADER SECTION (STATIC)
                This section stays pinned to the top.
               ============================================================ */}
            <View style={[styles.staticHeader, { paddingTop: insets.top + 56 }]}>
                <ImageBackground
                    source={{ uri: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=2070&auto=format&fit=crop' }}
                    style={styles.headerImage}
                >
                    <LinearGradient colors={['rgba(0,0,0,0.1)', 'rgba(15, 23, 42, 0.95)']} style={styles.gradient}>

                        {/* Edit Button */}
                        <TouchableOpacity style={styles.glassEditBtn} onPress={() => setEditModalVisible(true)}>
                            <Ionicons name="pencil" size={16} color="#fff" />
                            <Text style={styles.editBtnText}>Edit</Text>
                        </TouchableOpacity>

                        {/* Profile Info */}
                        <View style={styles.headerContent}>
                            <View>
                                <Image source={{ uri: profile?.avatar_url || 'https://i.pravatar.cc/150?u=pro' }} style={styles.avatar} />
                                {isVerified && (
                                    <View style={styles.verifiedTick}>
                                        <Ionicons name="checkmark" size={12} color="#fff" />
                                    </View>
                                )}
                            </View>

                            <View style={{ flex: 1 }}>
                                <Text style={styles.name}>{profile?.full_name || "Provider"}</Text>
                                <Text style={styles.role} numberOfLines={1}>
                                    {mySkills.length > 0 ? mySkills.slice(0, 2).join(' • ') : "General Provider"}
                                </Text>
                                <View style={styles.locationRow}>
                                    <Ionicons name="location" size={12} color="#94A3B8"/>
                                    <Text style={styles.locationText}>{profile?.city || "Cameroon"}</Text>
                                </View>
                            </View>
                        </View>
                    </LinearGradient>
                </ImageBackground>

                {/* Floating Stats Card (Fixed inside Header View) */}
                <View style={styles.floatingCard}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{portfolio.length}</Text>
                        <Text style={styles.statLabel}>{t('projectsCount')}</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <View style={{flexDirection:'row', alignItems:'center', gap: 4}}>
                            <Text style={styles.statValue}>{profile?.rating || 'New'}</Text>
                            <Ionicons name="star" size={14} color="#F59E0B" />
                        </View>
                        <Text style={styles.statLabel}>{t('trustScore')}</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, {color: isVerified ? '#16A34A' : '#F59E0B'}]}>
                            {isVerified ? '100%' : '50%'}
                        </Text>
                        <Text style={styles.statLabel}>{t('verificationStatus')}</Text>
                    </View>
                </View>
            </View>

            {/* ============================================================
                2. SCROLLABLE CONTENT SECTION
                Only this part scrolls underneath the header.
               ============================================================ */}
            <ScrollView
                style={styles.scrollableContent}
                contentContainerStyle={{ paddingBottom: SCROLL_BOTTOM_INSET, paddingTop: theme.spacing.md, paddingHorizontal: theme.spacing.lg }}
                showsVerticalScrollIndicator={false}
            >
                {/* COMMAND CENTER (Icon Grid) */}
                <View style={styles.hubSection}>
                    <Text style={styles.hubTitle}>Command Center</Text>
                    <View style={styles.hubGrid}>
                        {HUB_ITEMS.map((item) => (
                            <TouchableOpacity
                                key={item.key}
                                style={styles.hubCard}
                                onPress={() => { mediumFeedback(); router.push(item.href); }}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.hubIconWrap, { backgroundColor: item.bg }]}>
                                    <Ionicons name={item.icon} size={26} color={item.color} />
                                </View>
                                <Text style={styles.hubLabel}>{item.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* BIO */}
                {profile?.bio ? (
                    <View style={styles.sectionContainer}>
                        <Text style={styles.sectionHeader}>{t('bioLabel')}</Text>
                        <Text style={styles.bioText}>{profile.bio}</Text>
                    </View>
                ) : null}

                {/* MENU */}
                <View style={styles.menuContainer}>
                    <Text style={styles.menuTitle}>{t('accountSettings')}</Text>

                    <TouchableOpacity style={styles.menuItem} onPress={() => { mediumFeedback(); handleVerificationPress(); }} activeOpacity={0.7}>
                        <View style={[styles.iconBox, {backgroundColor: theme.colors.emerald + '18'}]}>
                            <Ionicons name="shield-checkmark" size={20} color={theme.colors.emerald} />
                        </View>
                        <View style={{flex: 1}}>
                            <Text style={styles.menuText}>{t('verificationStatus')}</Text>
                            <Text style={styles.menuSub}>{isVerified ? t('identityConfirmed') : t('getVerified')}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem} onPress={() => { mediumFeedback(); setSkillsModalVisible(true); }} activeOpacity={0.7}>
                        <View style={[styles.iconBox, {backgroundColor: theme.colors.active + '18'}]}>
                            <Ionicons name="hammer" size={20} color={theme.colors.active} />
                        </View>
                        <View style={{flex: 1}}>
                            <Text style={styles.menuText}>{t('mySkills')}</Text>
                            <Text style={styles.menuSub}>{mySkills.length} selected</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem} onPress={() => { mediumFeedback(); setLangModalVisible(true); }} activeOpacity={0.7}>
                        <View style={[styles.iconBox, {backgroundColor: theme.colors.surfaceAlt}]}>
                            <Ionicons name="globe-outline" size={20} color={theme.colors.textMuted} />
                        </View>
                        <View style={{flex: 1}}>
                            <Text style={styles.menuText}>Language</Text>
                            <Text style={styles.menuSub}>{getFlag()} {LANGUAGES.find(l => l.code === language)?.label}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem} onPress={() => { mediumFeedback(); handleSignOut(); }} activeOpacity={0.7}>
                        <View style={[styles.iconBox, {backgroundColor: theme.colors.danger + '15'}]}>
                            <Ionicons name="log-out-outline" size={20} color={theme.colors.danger} />
                        </View>
                        <Text style={[styles.menuText, { color: theme.colors.danger }]}>{t('signOut')}</Text>
                    </TouchableOpacity>
                </View>

                {/* PORTFOLIO */}
                <View style={[styles.sectionContainer, {marginBottom: 20}]}>
                    <Text style={styles.sectionHeader}>{t('recentWork')}</Text>
                    {portfolio.length === 0 ? (
                        <PremiumEmptyState
                            icon="images-outline"
                            title={t('noPortfolioYet') || 'No portfolio photos yet'}
                            subtitle={t('portfolioFromJobsHint') || 'Upload proof photos from Active Sites / Workroom — they appear here automatically.'}
                            actionLabel={t('tabActive') || 'Active Sites'}
                            onAction={() => {
                                successFeedback();
                                router.push('/provider/active');
                            }}
                        />
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 12}}>
                            <TouchableOpacity
                                style={styles.addPortfolioBtn}
                                onPress={() => {
                                    successFeedback();
                                    router.push('/provider/active');
                                }}
                            >
                                <Ionicons name="camera" size={28} color={PREMIUM_GOLD} />
                                <Text style={styles.addText}>{t('fromJobs')}</Text>
                            </TouchableOpacity>
                            {portfolio.map((item, index) => (
                                <Image key={index} source={{ uri: item.image_url }} style={styles.portfolioImg} />
                            ))}
                        </ScrollView>
                    )}
                </View>
            </ScrollView>

            {/* --- MODALS --- */}

            {/* SKILLS MODAL */}
            <Modal animationType="slide" transparent visible={skillsModalVisible} onRequestClose={() => setSkillsModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalHeaderTitle}>{t('selectTrades')}</Text>
                        <View style={styles.skillsWrap}>
                            {SKILL_CATEGORIES.map(s => (
                                <Pressable key={s} style={[styles.skillChip, mySkills.includes(s) && styles.skillActive]} onPress={() => toggleSkill(s)}>
                                    <Text style={[styles.skillLabel, mySkills.includes(s) && {color:'#fff'}]}>{s}</Text>
                                </Pressable>
                            ))}
                        </View>
                        <TouchableOpacity style={styles.mainBtn} onPress={saveSkills} disabled={saving}>
                            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>{t('saveExpertise')}</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.closeBtn} onPress={() => setSkillsModalVisible(false)}><Text style={{color:'#64748B'}}>Close</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* LANG MODAL */}
            <Modal animationType="fade" transparent visible={langModalVisible} onRequestClose={() => setLangModalVisible(false)}>
                <TouchableOpacity style={[styles.modalOverlay, {justifyContent:'center'}]} activeOpacity={1} onPress={() => setLangModalVisible(false)}>
                    <View style={[styles.langModalContent, {marginHorizontal:40}]}>
                        {LANGUAGES.map(l => (
                            <TouchableOpacity key={l.code} style={styles.langRow} onPress={() => handleLanguageSelect(l.code)}>
                                <Text style={{fontSize:24}}>{l.flag}</Text>
                                <Text style={styles.langLabel}>{l.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* CITY MODAL */}
            <Modal animationType="slide" transparent visible={cityModalVisible} onRequestClose={() => setCityModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, { maxHeight: '60%' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('selectCity')}</Text>
                            <TouchableOpacity onPress={() => setCityModalVisible(false)}><Ionicons name="close" size={24} color="#0F172A" /></TouchableOpacity>
                        </View>
                        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                            {CITIES.map((city) => (
                                <TouchableOpacity key={city} style={[styles.cityOption, formCity === city && styles.cityOptionActive]} onPress={() => handleSelectCity(city)}>
                                    <Text style={[styles.cityText, formCity === city && styles.cityTextActive]}>{city}</Text>
                                    {formCity === city && <Ionicons name="checkmark-circle" size={20} color="#0F172A" />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* EDIT PROFILE MODAL */}
            <Modal animationType="slide" transparent visible={editModalVisible} onRequestClose={() => setEditModalVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('editProfile')}</Text>
                            <TouchableOpacity onPress={() => setEditModalVisible(false)}><Ionicons name="close-circle" size={28} color="#94A3B8" /></TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.label}>{t('nameLabel')}</Text>
                            <TextInput style={[styles.textInput, isVerified && styles.disabledInput]} value={formName} onChangeText={setFormName} placeholder="John Doe" editable={!isVerified} />
                            {isVerified && <Text style={styles.helperText}><Ionicons name="lock-closed" size={12} /> Name locked (Verified)</Text>}

                            <Text style={styles.label}>{t('cityLabel')}</Text>
                            <TouchableOpacity style={styles.textInput} onPress={() => setCityModalVisible(true)}>
                                <Text style={{ color: formCity ? '#0F172A' : '#94A3B8', fontSize: 16 }}>{formCity || "Select a city"}</Text>
                                <Ionicons name="chevron-down" size={20} color="#94A3B8" style={{position:'absolute', right:14, top:14}} />
                            </TouchableOpacity>

                            <Text style={styles.label}>{t('bioLabel')}</Text>
                            <TextInput style={[styles.textInput, {height:80}]} multiline value={formBio} onChangeText={setFormBio} placeholder="About me..." />

                            <TouchableOpacity style={styles.saveBtn} onPress={saveProfileDetails} disabled={saving}>
                                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t('saveChanges')}</Text>}
                            </TouchableOpacity>
                            <View style={{height: 40}} />
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: PREMIUM_BG },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // --- STATIC HEADER (FIXED) ---
    staticHeader: { width: '100%', height: 380, backgroundColor: PREMIUM_BG, zIndex: 10 },
    headerImage: { width: '100%', height: 330 }, // Image is slightly shorter than container
    gradient: { flex: 1, justifyContent: 'flex-end', padding: 24, paddingBottom: 60 },

    glassEditBtn: { position: 'absolute', top: 16, right: 24, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', gap: 6 },
    editBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },

    headerContent: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    avatar: { width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: '#fff' },
    verifiedTick: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#3B82F6', width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0F172A' },

    name: { fontSize: 24, ...theme.typography.title, color: '#fff', marginBottom: 2 },
    role: { color: '#CBD5E1', fontSize: 14, fontWeight: '600', marginBottom: 6 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    locationText: { color: '#94A3B8', fontSize: 13, fontWeight: '500' },

    // --- FLOATING CARD (Positioned Absolute inside Fixed Header) ---
    floatingCard: { flexDirection: 'row', backgroundColor: 'rgba(17,24,39,0.92)', marginHorizontal: 24, position: 'absolute', bottom: 10, left: 0, right: 0, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)', justifyContent: 'space-around', alignItems: 'center' },
    statItem: { alignItems: 'center', flex: 1 },
    statValue: { fontSize: 18, fontWeight: '800', color: TEXT_PRIMARY },
    statLabel: { color: TEXT_SECONDARY, fontSize: 11, fontWeight: '600', marginTop: 4, textTransform: 'uppercase' },
    statDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.12)' },

    // --- SCROLLABLE AREA ---
    scrollableContent: { flex: 1, backgroundColor: PREMIUM_BG },

    hubSection: { marginTop: theme.spacing.xl },
    hubTitle: { fontSize: 13, ...theme.typography.label, color: TEXT_SECONDARY, marginBottom: theme.spacing.sm },
    hubGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    hubCard: {
        width: '30%',
        backgroundColor: 'rgba(17,24,39,0.75)',
        borderRadius: theme.radii.md,
        paddingVertical: 18,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    hubIconWrap: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    hubLabel: { fontSize: 12, fontWeight: '700', color: TEXT_PRIMARY },

    // SECTIONS
    sectionContainer: { marginTop: 24 },
    sectionHeader: { fontSize: 16, fontWeight: '800', color: TEXT_PRIMARY, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
    bioText: { fontSize: 14, color: TEXT_SECONDARY, lineHeight: 22 },

    // MENU
    menuContainer: { marginTop: 32 },
    menuTitle: { fontSize: 18, ...theme.typography.title, color: TEXT_PRIMARY, marginBottom: 16 },
    menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(17,24,39,0.75)', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    menuText: { fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY },
    menuSub: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 },

    // PORTFOLIO
    addPortfolioBtn: { width: 100, height: 120, borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.35)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(212,175,55,0.08)' },
    addText: { color: PREMIUM_GOLD, fontWeight: '700', marginTop: 8, fontSize: 11 },
    portfolioImg: { width: 160, height: 120, borderRadius: 16, backgroundColor: '#1E293B' },

    // MODALS
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '85%' },
    modalHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalHeaderTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 16 },
    modalTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },

    // Skills
    skillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    skillChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
    skillActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
    skillLabel: { fontSize: 13, fontWeight: '600', color: '#64748B' },

    // Form
    label: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 8, marginTop: 16, textTransform: 'uppercase' },
    textInput: { backgroundColor: '#F8FAFC', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 16 },
    input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 16, fontSize: 16, color: '#0F172A' },
    disabledInput: { backgroundColor: '#F1F5F9', color: '#94A3B8' },
    helperText: { fontSize: 12, color: '#F59E0B', marginTop: 6 },

    mainBtn: { backgroundColor: theme.colors.primary, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
    saveBtn: { backgroundColor: theme.colors.primary, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 30 },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    btnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
    closeBtn: { alignItems: 'center', marginTop: 16 },

    // City/Lang
    cityOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    cityOptionActive: { backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 12, borderBottomWidth: 0 },
    cityText: { fontSize: 16, color: '#475569', fontWeight: '500' },
    cityTextActive: { color: '#0F172A', fontWeight: '700' },
    langModalContent: { width: '85%', backgroundColor: '#fff', borderRadius: 24, padding: 24, alignSelf: 'center', marginTop: 'auto', marginBottom: 'auto' },
    langRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    langLabel: { fontSize: 16, fontWeight: '600', color: '#334155' },
    langOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    langOptionActive: { backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 12, borderBottomWidth: 0 },
    langText: { fontSize: 16, fontWeight: '600', color: '#475569', flex: 1 },
    langTextActive: { color: '#0F172A', fontWeight: '800' }
});