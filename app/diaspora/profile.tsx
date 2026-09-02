import React, { useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Image, ScrollView,
    Switch, Alert, ImageBackground, Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { mediumFeedback } from '@/utils/haptics';
import PremiumHeader from '@/components/PremiumHeader';
import ScreenLoader from '@/components/ScreenLoader';
import { clientMenuItems } from '@/constants/premiumMenus';
import { usePremiumColors, type PremiumColors } from '@/hooks/usePremiumColors';
import { useScreenOffsets } from '@/hooks/useScreenOffsets';
import {
    ALPHA,
    DANGER,
    GOLD,
    GOLD_BORDER,
    GOLD_TINT,
    INFO,
    INFO_TINT,
    NAVY,
    SUCCESS,
    SUCCESS_BORDER,
    SUCCESS_TINT,
    WARNING,
    WARNING_TINT,
    icon as iconSize,
    radius,
    shadow,
    space,
    text,
    weight,
    withAlpha,
} from '@/constants/design';

type HubItem = {
    key: string;
    href: Href;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    bg: string;
};

const HUB_ITEMS: HubItem[] = [
    { key: 'projects', href: '/diaspora/projects' as const, label: 'My Projects', icon: 'folder-open-outline', color: GOLD, bg: GOLD_TINT },
    { key: 'new', href: '/diaspora/new' as const, label: 'Post New', icon: 'add-circle-outline', color: SUCCESS, bg: SUCCESS_TINT },
    { key: 'timeline', href: '/diaspora/timeline' as const, label: 'Timeline', icon: 'time-outline', color: WARNING, bg: WARNING_TINT },
    { key: 'settings', href: '/diaspora/settings' as const, label: 'Settings', icon: 'settings-outline', color: INFO, bg: INFO_TINT },
];

export default function ClientProfileScreen() {
    const router = useRouter();
    const { user, signOut } = useAuth();
    const { t } = useLanguage();
    const c = usePremiumColors();
    const offsets = useScreenOffsets();
    const styles = useMemo(() => createStyles(c), [c]);

    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);

    // --- MODAL STATES ---
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [paymentModalVisible, setPaymentModalVisible] = useState(false);

    // --- EDIT FORM STATES ---
    const [newName, setNewName] = useState('');
    const [newCity, setNewCity] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, [user]);

    const fetchProfile = async () => {
        if (!user) return;
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (data) {
            setProfile(data);
            setNewName(data.full_name || '');
            setNewCity(data.city || '');
        }
        setLoading(false);
    };

    // --- ACTIONS ---

    const handleUpdateProfile = async () => {
        if (!user) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ full_name: newName, city: newCity })
                .eq('id', user.id);

            if (error) throw error;

            // Update local state immediately
            setProfile({ ...profile, full_name: newName, city: newCity });
            setEditModalVisible(false);
            Alert.alert(t('success'), t('profileUpdatedSuccess'));
        } catch (error: any) {
            Alert.alert(t('error'), error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSignOut = async () => {
        Alert.alert(t('signOut'), t('signOutConfirmBody'), [
            { text: t('cancel'), style: 'cancel' },
            { text: t('signOut'), style: 'destructive', onPress: async () => {
                    await signOut();
                    router.replace('/login');
                }}
        ]);
    };

    const changeAvatar = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'] as any,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled && result.assets[0].base64) {
            // Here you would upload the base64 to Supabase Storage
            Alert.alert(t('info'), t('photoSelectionWorking'));
        }
    };

    if (loading) {
        return (
            <View style={[styles.screen, { backgroundColor: c.bg }]}>
                <StatusBar barStyle={c.isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
                <PremiumHeader
                    title={t('tabProfile') ?? 'Profile'}
                    subtitle="Your account"
                    menuItems={clientMenuItems(router, t)}
                onNotificationsPress={() => router.push('/notifications')}
                />
                <ScreenLoader />
            </View>
        );
    }

    return (
        <View style={[styles.screen, { backgroundColor: c.bg }]}>
            <StatusBar barStyle={c.isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
            <PremiumHeader
                title={profile?.full_name || t('tabProfile') || 'Profile'}
                subtitle={profile?.city || user?.email || 'Your account'}
                menuItems={clientMenuItems(router, t)}
                onNotificationsPress={() => router.push('/notifications')}
            />
            <ScrollView
                contentContainerStyle={offsets.content}
                showsVerticalScrollIndicator={false}
            >

                {/* --- HERO HEADER --- */}
                <ImageBackground
                    source={{ uri: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop' }}
                    style={styles.headerImage}
                >
                    <LinearGradient colors={[withAlpha(NAVY, 0.7), 'transparent']} style={styles.heroGrad} />
                </ImageBackground>

                {/* --- PROFILE CARD --- */}
                <View style={styles.profileSection}>
                    <TouchableOpacity onPress={changeAvatar} style={styles.avatarContainer} activeOpacity={0.7}>
                        <Image
                            source={{ uri: profile?.avatar_url || 'https://i.pravatar.cc/150?u=fake' }}
                            style={styles.avatar}
                        />
                        <View style={styles.editBadge}>
                            <Ionicons name="camera" size={iconSize.xs} color="#0A0F1A" />
                        </View>
                    </TouchableOpacity>

                    <Text style={styles.name}>{profile?.full_name || "Client Name"}</Text>
                    <Text style={styles.email}>{user?.email}</Text>

                    <View style={styles.badgeRow}>
                        <View style={styles.verBadge}>
                            <Ionicons name="checkmark-circle" size={iconSize.xs} color={SUCCESS} />
                            <Text style={styles.verText}>Verified Client</Text>
                        </View>
                        <View style={[styles.verBadge, { backgroundColor: GOLD_TINT, borderColor: GOLD_BORDER }]}>
                            <Ionicons name="location" size={iconSize.xs} color={GOLD} />
                            <Text style={[styles.verText, { color: GOLD }]}>{profile?.city || "Diaspora"}</Text>
                        </View>
                    </View>
                </View>

                {/* --- COMMAND CENTER (2x2 Grid) --- */}
                <View style={styles.hubSection}>
                    <Text style={styles.sectionTitle}>Command Center</Text>
                    <View style={styles.hubGrid}>
                        {HUB_ITEMS.map((item) => (
                            <TouchableOpacity
                                key={item.key}
                                style={styles.hubCard}
                                onPress={() => { mediumFeedback(); router.push(item.href); }}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.hubIconWrap, { backgroundColor: item.bg }]}>
                                    <Ionicons name={item.icon} size={iconSize.md} color={item.color} />
                                </View>
                                <Text style={styles.hubLabel}>{item.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* --- MENU OPTIONS --- */}
                <View style={styles.menuContainer}>
                    <Text style={styles.sectionTitle}>{t('accountSettings')}</Text>

                    <TouchableOpacity style={styles.menuItem} onPress={() => { mediumFeedback(); setEditModalVisible(true); }} activeOpacity={0.7}>
                        <View style={[styles.iconBox, { backgroundColor: GOLD_TINT }]}>
                            <Ionicons name="person" size={iconSize.sm} color={GOLD} />
                        </View>
                        <Text style={styles.menuText}>{t('editProfileTitle') || "Edit Profile"}</Text>
                        <Ionicons name="chevron-forward" size={iconSize.sm} color={c.muted} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem} onPress={() => { mediumFeedback(); setPaymentModalVisible(true); }} activeOpacity={0.7}>
                        <View style={[styles.iconBox, { backgroundColor: SUCCESS_TINT }]}>
                            <Ionicons name="card" size={iconSize.sm} color={SUCCESS} />
                        </View>
                        <Text style={styles.menuText}>Payment Methods</Text>
                        <Ionicons name="chevron-forward" size={iconSize.sm} color={c.muted} />
                    </TouchableOpacity>

                    <View style={styles.menuItem}>
                        <View style={[styles.iconBox, { backgroundColor: WARNING_TINT }]}>
                            <Ionicons name="notifications" size={iconSize.sm} color={WARNING} />
                        </View>
                        <Text style={styles.menuText}>{t('notificationsTitle')}</Text>
                        <Switch
                            value={notificationsEnabled}
                            onValueChange={setNotificationsEnabled}
                            trackColor={{ false: c.border, true: GOLD }}
                        />
                    </View>

                    <Text style={[styles.sectionTitle, { marginTop: space.xl }]}>{t('support')}</Text>

                    <TouchableOpacity style={styles.menuItem} onPress={() => { mediumFeedback(); router.push('/modal'); }} activeOpacity={0.7}>
                        <View style={[styles.iconBox, { backgroundColor: c.surfaceAlt }]}>
                            <Ionicons name="help-circle" size={iconSize.sm} color={c.textSecondary} />
                        </View>
                        <Text style={styles.menuText}>Help Center</Text>
                        <Ionicons name="chevron-forward" size={iconSize.sm} color={c.muted} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem} onPress={handleSignOut} activeOpacity={0.7}>
                        <View style={[styles.iconBox, { backgroundColor: withAlpha(DANGER, ALPHA.medium) }]}>
                            <Ionicons name="log-out" size={iconSize.sm} color={DANGER} />
                        </View>
                        <Text style={[styles.menuText, { color: DANGER }]}>{t('signOut')}</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.version}>Version 1.0.0 • Diaspora Bridge</Text>
            </ScrollView>

            {/* --- MODAL 1: EDIT PROFILE --- */}
            <Modal visible={editModalVisible} transparent animationType="slide">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Edit Profile</Text>
                            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                                <Ionicons name="close-circle" size={iconSize.md} color={c.muted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.label}>Full Name</Text>
                        <TextInput
                            style={styles.input}
                            value={newName}
                            onChangeText={setNewName}
                            placeholder="John Doe"
                            placeholderTextColor={c.muted}
                        />

                        <Text style={styles.label}>Current City</Text>
                        <TextInput
                            style={styles.input}
                            value={newCity}
                            onChangeText={setNewCity}
                            placeholder="e.g. Paris, France"
                            placeholderTextColor={c.muted}
                        />

                        <TouchableOpacity
                            style={styles.saveBtn}
                            onPress={handleUpdateProfile}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color="#0A0F1A" />
                            ) : (
                                <Text style={styles.saveBtnText}>Save Changes</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* --- MODAL 2: PAYMENT METHODS --- */}
            <Modal visible={paymentModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Payment Methods</Text>
                            <TouchableOpacity onPress={() => setPaymentModalVisible(false)}>
                                <Ionicons name="close-circle" size={iconSize.md} color={c.muted} />
                            </TouchableOpacity>
                        </View>

                        {/* Saved Card (Mock) */}
                        <View style={styles.cardItem}>
                            <View style={styles.cardLeft}>
                                <Ionicons name="card" size={iconSize.md} color={c.textPrimary} />
                                <View>
                                    <Text style={styles.cardName}>Visa •••• 4242</Text>
                                    <Text style={styles.cardExp}>Expires 12/28</Text>
                                </View>
                            </View>
                            <Ionicons name="checkmark-circle" size={iconSize.sm} color={SUCCESS} />
                        </View>

                        {/* Add New Card Button */}
                        <TouchableOpacity style={styles.addCardBtn} onPress={() => Alert.alert(t('integrationNeeded'), t('stripeSetupRequired'))}>
                            <Ionicons name="add" size={iconSize.sm} color={GOLD} />
                            <Text style={styles.addCardText}>Add New Card</Text>
                        </TouchableOpacity>

                        <Text style={styles.secureNote}>
                            <Ionicons name="lock-closed" size={iconSize.xs} /> Secured by Stripe
                        </Text>
                    </View>
                </View>
            </Modal>

        </View>
    );
}

const createStyles = (c: PremiumColors) => StyleSheet.create({
    screen: { flex: 1 },

    headerImage: { width: '100%', height: 200 },
    heroGrad: { flex: 1 },

    profileSection: { alignItems: 'center', marginTop: -60 },
    avatarContainer: { position: 'relative', marginBottom: space.md, ...shadow.card },
    avatar: { width: 110, height: 110, borderRadius: radius.pill, borderWidth: 4, borderColor: c.surface },
    editBadge: {
        position: 'absolute',
        bottom: space.xxs,
        right: space.xxs,
        backgroundColor: GOLD,
        padding: space.xs,
        borderRadius: radius.pill,
        borderWidth: 2,
        borderColor: c.surface,
    },

    name: { ...text.display, color: c.textPrimary, marginBottom: space.xxs },
    email: { ...text.footnote, color: c.textSecondary, marginBottom: space.md },

    badgeRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.xl },
    verBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        backgroundColor: SUCCESS_TINT,
        paddingHorizontal: space.sm,
        paddingVertical: space.xs,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: SUCCESS_BORDER,
    },
    verText: { ...text.caption, color: SUCCESS, fontWeight: weight.heavy },

    hubSection: { marginBottom: space.xl },
    hubGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: space.sm,
    },
    hubCard: {
        width: '47%',
        backgroundColor: c.surface,
        borderRadius: radius.lg,
        paddingVertical: space.lg,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.sm,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: c.border,
        ...shadow.card,
    },
    hubIconWrap: {
        width: 52,
        height: 52,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    hubLabel: { ...text.footnote, color: c.textPrimary, fontWeight: weight.heavy },

    menuContainer: { paddingTop: 0 },
    sectionTitle: { ...text.label, color: c.textSecondary, marginBottom: space.sm },

    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.surface,
        padding: space.md,
        borderRadius: radius.lg,
        marginBottom: space.sm,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: c.border,
        ...shadow.card,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: space.md,
    },
    menuText: { flex: 1, ...text.body, color: c.textPrimary },

    version: { textAlign: 'center', ...text.caption, color: c.muted, marginTop: space.lg },

    modalOverlay: { flex: 1, backgroundColor: withAlpha('#000000', ALPHA.scrim), justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: c.surface,
        borderTopLeftRadius: radius.xxl,
        borderTopRightRadius: radius.xxl,
        padding: space.xl,
        paddingBottom: space.xxl,
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.xl },
    modalTitle: { ...text.title, color: c.textPrimary },

    label: { ...text.footnote, color: c.textSecondary, fontWeight: weight.heavy, marginBottom: space.sm, marginTop: space.sm },
    input: {
        backgroundColor: c.surfaceAlt,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: radius.lg,
        padding: space.md,
        ...text.body,
        color: c.textPrimary,
    },

    saveBtn: {
        backgroundColor: GOLD,
        height: 54,
        borderRadius: radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: space.xxl,
    },
    saveBtnText: { color: '#0A0F1A', ...text.body, fontWeight: weight.heavy },

    cardItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: space.md,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: radius.lg,
        marginBottom: space.sm,
    },
    cardLeft: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    cardName: { ...text.body, color: c.textPrimary, fontWeight: weight.heavy },
    cardExp: { ...text.caption, color: c.textSecondary },
    addCardBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: space.md,
        borderWidth: 1,
        borderColor: GOLD_BORDER,
        borderStyle: 'dashed',
        borderRadius: radius.lg,
        gap: space.sm,
        backgroundColor: GOLD_TINT,
    },
    addCardText: { ...text.footnote, color: GOLD, fontWeight: weight.heavy },
    secureNote: { textAlign: 'center', ...text.caption, color: c.muted, marginTop: space.lg },
});
