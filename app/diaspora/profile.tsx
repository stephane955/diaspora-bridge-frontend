import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Image, ScrollView,
    Switch, Alert, ImageBackground, Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

export default function ClientProfileScreen() {
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
        <View style={styles.container}>
            <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

                {/* --- HERO HEADER --- */}
                <ImageBackground
                    source={{ uri: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop' }}
                    style={styles.headerImage}
                >
                    <LinearGradient colors={['rgba(15,23,42,0.3)', '#F8FAFC']} style={styles.gradient} />
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
                            <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                            <Text style={styles.verText}>Verified Client</Text>
                        </View>
                        <View style={[styles.verBadge, { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' }]}>
                            <Ionicons name="location" size={14} color="#0EA5E9" />
                            <Text style={[styles.verText, { color: '#0EA5E9' }]}>{profile?.city || "Diaspora"}</Text>
                        </View>
                    </View>
                </View>

                {/* --- MENU OPTIONS --- */}
                <View style={styles.menuContainer}>
                    <Text style={styles.sectionTitle}>{t('accountSettings')}</Text>

                    {/* EDIT PROFILE BUTTON */}
                    <TouchableOpacity style={styles.menuItem} onPress={() => setEditModalVisible(true)}>
                        <View style={[styles.iconBox, { backgroundColor: '#F0F9FF' }]}>
                            <Ionicons name="person" size={20} color="#0EA5E9" />
                        </View>
                        <Text style={styles.menuText}>{t('editProfileTitle') || "Edit Profile"}</Text>
                        <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                    </TouchableOpacity>

                    {/* PAYMENT METHODS BUTTON */}
                    <TouchableOpacity style={styles.menuItem} onPress={() => setPaymentModalVisible(true)}>
                        <View style={[styles.iconBox, { backgroundColor: '#F0FDF4' }]}>
                            <Ionicons name="card" size={20} color="#16A34A" />
                        </View>
                        <Text style={styles.menuText}>Payment Methods</Text>
                        <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                    </TouchableOpacity>

                    <View style={styles.menuItem}>
                        <View style={[styles.iconBox, { backgroundColor: '#FFF7ED' }]}>
                            <Ionicons name="notifications" size={20} color="#F97316" />
                        </View>
                        <Text style={styles.menuText}>{t('notificationsTitle')}</Text>
                        <Switch
                            value={notificationsEnabled}
                            onValueChange={setNotificationsEnabled}
                            trackColor={{ false: "#E2E8F0", true: "#0EA5E9" }}
                        />
                    </View>

                    <Text style={[styles.sectionTitle, { marginTop: 24 }]}>{t('support')}</Text>

                    <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/modal')}>
                        <View style={[styles.iconBox, { backgroundColor: '#F1F5F9' }]}>
                            <Ionicons name="help-circle" size={20} color="#64748B" />
                        </View>
                        <Text style={styles.menuText}>Help Center</Text>
                        <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
                        <View style={[styles.iconBox, { backgroundColor: '#FEF2F2' }]}>
                            <Ionicons name="log-out" size={20} color="#EF4444" />
                        </View>
                        <Text style={[styles.menuText, { color: '#EF4444' }]}>{t('signOut')}</Text>
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
                                <Ionicons name="close-circle" size={28} color="#94A3B8" />
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
                                <ActivityIndicator color="#fff" />
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
                                <Ionicons name="close-circle" size={28} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        {/* Saved Card (Mock) */}
                        <View style={styles.cardItem}>
                            <View style={styles.cardLeft}>
                                <Ionicons name="card" size={24} color="#0F172A" />
                                <View>
                                    <Text style={styles.cardName}>Visa •••• 4242</Text>
                                    <Text style={styles.cardExp}>Expires 12/28</Text>
                                </View>
                            </View>
                            <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                        </View>

                        {/* Add New Card Button */}
                        <TouchableOpacity style={styles.addCardBtn} onPress={() => Alert.alert("Integration Needed", "Stripe setup required.")}>
                            <Ionicons name="add" size={20} color="#0EA5E9" />
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
    container: { flex: 1, backgroundColor: '#F8FAFC' },

    headerImage: { width: '100%', height: 220 },
    gradient: { flex: 1, marginTop: 100 },

    profileSection: { alignItems: 'center', marginTop: -60, paddingHorizontal: 20 },
    avatarContainer: { position: 'relative', marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
    avatar: { width: 110, height: 110, borderRadius: 55, borderWidth: 4, borderColor: '#fff' },
    editBadge: { position: 'absolute', bottom: 4, right: 4, backgroundColor: '#0F172A', padding: 8, borderRadius: 20, borderWidth: 2, borderColor: '#fff' },

    name: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
    email: { fontSize: 14, color: '#64748B', marginBottom: 16 },

    badgeRow: { flexDirection: 'row', gap: 10 },
    verBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#DCFCE7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#86EFAC' },
    verText: { fontSize: 12, fontWeight: '700', color: '#16A34A' },

    menuContainer: { padding: 24 },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: '#94A3B8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },

    menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 5, borderWidth: 1, borderColor: '#F1F5F9' },
    iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    menuText: { flex: 1, fontSize: 16, fontWeight: '600', color: '#0F172A' },

    version: { textAlign: 'center', color: '#CBD5E1', fontSize: 12, marginTop: 20 },

    // --- MODAL STYLES ---
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },

    label: { fontSize: 14, fontWeight: '700', color: '#64748B', marginBottom: 8, marginTop: 10 },
    input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 16, fontSize: 16, color: '#0F172A' },

    saveBtn: { backgroundColor: '#0F172A', height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 30 },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    // Payment Styles
    cardItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, marginBottom: 12 },
    cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    cardName: { fontWeight: '700', color: '#0F172A' },
    cardExp: { fontSize: 12, color: '#64748B' },
    addCardBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderWidth: 1, borderColor: '#0EA5E9', borderStyle: 'dashed', borderRadius: 16, gap: 8, backgroundColor: '#F0F9FF' },
    addCardText: { color: '#0EA5E9', fontWeight: '700' },
    secureNote: { textAlign: 'center', color: '#94A3B8', fontSize: 12, marginTop: 20, fontWeight: '500' }
});