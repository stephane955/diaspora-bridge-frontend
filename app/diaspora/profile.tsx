import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Image, ScrollView,
    Switch, Alert, ImageBackground, Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { theme } from '@/constants/theme';

export default function ClientProfileScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { user, signOut } = useAuth();
    const { t } = useLanguage();

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
            Alert.alert("Success", "Profile updated successfully.");
        } catch (error: any) {
            Alert.alert("Error", error.message);
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
            Alert.alert("Info", "Photo selection working. Storage upload needs to be connected.");
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

                {/* --- HERO HEADER --- */}
                <ImageBackground
                    source={{ uri: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop' }}
                    style={styles.headerImage}
                >
                    <LinearGradient colors={[theme.colors.glassDark, theme.colors.background]} style={styles.gradient} />
                </ImageBackground>

                {/* --- PROFILE CARD --- */}
                <View style={styles.profileSection}>
                    <TouchableOpacity onPress={changeAvatar} style={styles.avatarContainer}>
                        <Image
                            source={{ uri: profile?.avatar_url || 'https://i.pravatar.cc/150?u=fake' }}
                            style={styles.avatar}
                        />
                        <View style={styles.editBadge}>
                            <Ionicons name="camera" size={14} color="#fff" />
                        </View>
                    </TouchableOpacity>

                    <Text style={styles.name}>{profile?.full_name || "Client Name"}</Text>
                    <Text style={styles.email}>{user?.email}</Text>

                    <View style={styles.badgeRow}>
                        <View style={styles.verBadge}>
                            <Ionicons name="checkmark-circle" size={14} color={theme.colors.success} />
                            <Text style={styles.verText}>Verified Client</Text>
                        </View>
                        <View style={[styles.verBadge, { backgroundColor: theme.colors.activeSoft + '30', borderColor: theme.colors.activeSoft + '60' }]}>
                            <Ionicons name="location" size={14} color={theme.colors.active} />
                            <Text style={[styles.verText, { color: theme.colors.active }]}>{profile?.city || "Diaspora"}</Text>
                        </View>
                    </View>
                </View>

                {/* --- MENU OPTIONS --- */}
                <View style={styles.menuContainer}>
                    <Text style={styles.sectionTitle}>{t('accountSettings')}</Text>

                    {/* EDIT PROFILE BUTTON */}
                    <TouchableOpacity style={styles.menuItem} onPress={() => setEditModalVisible(true)}>
                        <View style={[styles.iconBox, { backgroundColor: theme.colors.activeSoft + '25' }]}>
                            <Ionicons name="person" size={20} color={theme.colors.active} />
                        </View>
                        <Text style={styles.menuText}>{t('editProfileTitle') || "Edit Profile"}</Text>
                        <Ionicons name="chevron-forward" size={20} color={theme.colors.textSubtle} />
                    </TouchableOpacity>

                    {/* PAYMENT METHODS BUTTON */}
                    <TouchableOpacity style={styles.menuItem} onPress={() => setPaymentModalVisible(true)}>
                        <View style={[styles.iconBox, { backgroundColor: theme.colors.success + '20' }]}>
                            <Ionicons name="card" size={20} color={theme.colors.success} />
                        </View>
                        <Text style={styles.menuText}>Payment Methods</Text>
                        <Ionicons name="chevron-forward" size={20} color={theme.colors.textSubtle} />
                    </TouchableOpacity>

                    <View style={styles.menuItem}>
                        <View style={[styles.iconBox, { backgroundColor: theme.colors.warning + '25' }]}>
                            <Ionicons name="notifications" size={20} color={theme.colors.warning} />
                        </View>
                        <Text style={styles.menuText}>{t('notificationsTitle')}</Text>
                        <Switch
                            value={notificationsEnabled}
                            onValueChange={setNotificationsEnabled}
                            trackColor={{ false: theme.colors.border, true: theme.colors.active }}
                        />
                    </View>

                    <Text style={[styles.sectionTitle, { marginTop: 24 }]}>{t('support')}</Text>

                    <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/modal')}>
                        <View style={[styles.iconBox, { backgroundColor: theme.colors.background }]}>
                            <Ionicons name="help-circle" size={20} color={theme.colors.textMuted} />
                        </View>
                        <Text style={styles.menuText}>Help Center</Text>
                        <Ionicons name="chevron-forward" size={20} color={theme.colors.textSubtle} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
                        <View style={[styles.iconBox, { backgroundColor: theme.colors.danger + '18' }]}>
                            <Ionicons name="log-out" size={20} color={theme.colors.danger} />
                        </View>
                        <Text style={[styles.menuText, { color: theme.colors.danger }]}>{t('signOut')}</Text>
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
                                <Ionicons name="close-circle" size={28} color={theme.colors.textSubtle} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.label}>Full Name</Text>
                        <TextInput
                            style={styles.input}
                            value={newName}
                            onChangeText={setNewName}
                            placeholder="John Doe"
                        />

                        <Text style={styles.label}>Current City</Text>
                        <TextInput
                            style={styles.input}
                            value={newCity}
                            onChangeText={setNewCity}
                            placeholder="e.g. Paris, France"
                        />

                        <TouchableOpacity
                            style={styles.saveBtn}
                            onPress={handleUpdateProfile}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color={theme.colors.surface} />
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
                                <Ionicons name="close-circle" size={28} color={theme.colors.textSubtle} />
                            </TouchableOpacity>
                        </View>

                        {/* Saved Card (Mock) */}
                        <View style={styles.cardItem}>
                            <View style={styles.cardLeft}>
                                <Ionicons name="card" size={24} color={theme.colors.text} />
                                <View>
                                    <Text style={styles.cardName}>Visa •••• 4242</Text>
                                    <Text style={styles.cardExp}>Expires 12/28</Text>
                                </View>
                            </View>
                            <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
                        </View>

                        {/* Add New Card Button */}
                        <TouchableOpacity style={styles.addCardBtn} onPress={() => Alert.alert("Integration Needed", "Stripe setup required.")}>
                            <Ionicons name="add" size={20} color={theme.colors.active} />
                            <Text style={styles.addCardText}>Add New Card</Text>
                        </TouchableOpacity>

                        <Text style={styles.secureNote}>
                            <Ionicons name="lock-closed" size={12} /> Secured by Stripe
                        </Text>
                    </View>
                </View>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },

    headerImage: { width: '100%', height: 220 },
    gradient: { flex: 1, marginTop: 100 },

    profileSection: { alignItems: 'center', marginTop: -60, paddingHorizontal: theme.spacing.lg },
    avatarContainer: { position: 'relative', marginBottom: theme.spacing.md, ...theme.shadow.soft },
    avatar: { width: 110, height: 110, borderRadius: 55, borderWidth: 4, borderColor: theme.colors.surface },
    editBadge: { position: 'absolute', bottom: 4, right: 4, backgroundColor: theme.colors.primary, padding: theme.spacing.sm, borderRadius: theme.radii.pill, borderWidth: 2, borderColor: theme.colors.surface },

    name: { fontSize: 24, fontWeight: '800', color: theme.colors.text, marginBottom: 4 },
    email: { fontSize: 14, color: theme.colors.textMuted, marginBottom: theme.spacing.md },

    badgeRow: { flexDirection: 'row', gap: theme.spacing.sm },
    verBadge: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, backgroundColor: theme.colors.success + '25', paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.success + '55' },
    verText: { fontSize: 12, fontWeight: '700', color: theme.colors.success },

    menuContainer: { padding: theme.spacing.xl },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.textSubtle, marginBottom: theme.spacing.sm, textTransform: 'uppercase', letterSpacing: 1 },

    menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radii.md, marginBottom: theme.spacing.sm, ...theme.shadow.soft, borderWidth: 1, borderColor: theme.colors.border },
    iconBox: { width: 40, height: 40, borderRadius: theme.radii.sm, alignItems: 'center', justifyContent: 'center', marginRight: theme.spacing.md },
    menuText: { flex: 1, fontSize: 16, fontWeight: '600', color: theme.colors.text },

    version: { textAlign: 'center', color: theme.colors.textSubtle, fontSize: 12, marginTop: theme.spacing.lg },

    modalOverlay: { flex: 1, backgroundColor: theme.colors.glassDark, justifyContent: 'flex-end' },
    modalContent: { backgroundColor: theme.colors.surface, borderTopLeftRadius: theme.radii.xl, borderTopRightRadius: theme.radii.xl, padding: theme.spacing.xl, paddingBottom: 40 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.xl },
    modalTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text },

    label: { fontSize: 14, fontWeight: '700', color: theme.colors.textMuted, marginBottom: theme.spacing.sm, marginTop: theme.spacing.sm },
    input: { backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.sm, padding: theme.spacing.md, fontSize: 16, color: theme.colors.text },

    saveBtn: { backgroundColor: theme.colors.primary, height: 56, borderRadius: theme.radii.md, alignItems: 'center', justifyContent: 'center', marginTop: 30 },
    saveBtnText: { color: theme.colors.surface, fontSize: 16, fontWeight: '700' },

    cardItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.md, marginBottom: theme.spacing.sm },
    cardLeft: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    cardName: { fontWeight: '700', color: theme.colors.text },
    cardExp: { fontSize: 12, color: theme.colors.textMuted },
    addCardBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.active, borderStyle: 'dashed', borderRadius: theme.radii.md, gap: theme.spacing.sm, backgroundColor: theme.colors.activeSoft + '20' },
    addCardText: { color: theme.colors.active, fontWeight: '700' },
    secureNote: { textAlign: 'center', color: theme.colors.textSubtle, fontSize: 12, marginTop: theme.spacing.lg, fontWeight: '500' }
});