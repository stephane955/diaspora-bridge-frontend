import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
// Using relative paths to resolve potential path alias issues in the build environment
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export default function ClientProfileScreen() {
    const router = useRouter();
    const { user, signOut } = useAuth();
    const { t } = useLanguage();
    const [fullName, setFullName] = useState('');
    const [bio, setBio] = useState('');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) return;
            try {
                const { data } = await supabase
                    .from('profiles')
                    .select('full_name, bio')
                    .eq('id', user.id)
                    .maybeSingle();

                setFullName(data?.full_name || user.user_metadata?.full_name || '');
                setBio(data?.bio || '');
            } catch (error) {
                console.error("Error fetching profile:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [user]);

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);

        const { error } = await supabase
            .from('profiles')
            .upsert({ id: user.id, full_name: fullName, bio }, { onConflict: 'id' });

        if (!error) {
            // Update auth metadata so headers/other screens reflect the change immediately
            await supabase.auth.updateUser({ data: { full_name: fullName } });
        }

        setSaving(false);

        if (error) {
            Alert.alert(t('errorTitle') || "Error", error.message || t('profileSaveFailed'));
            return;
        }

        Alert.alert(t('successTitle') || "Success", t('profileSaved'));
    };

    const handleSignOut = () => {
        Alert.alert(t('signOutTitle') || "Sign Out", t('signOutConfirmBody') || "Are you sure you want to sign out?", [
            { text: t('cancel') || "Cancel", style: 'cancel' },
            {
                text: t('signOut') || "Sign Out",
                style: 'destructive',
                onPress: async () => {
                    await signOut();
                    router.replace('/login');
                }
            }
        ]);
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            t('deleteAccountTitle') || "Delete Account",
            t('deleteAccountConfirm') || "This action is permanent. All your projects, profile data, and messages will be deleted. Are you sure?",
            [
                { text: t('cancel') || "Cancel", style: 'cancel' },
                {
                    text: t('delete') || "Delete",
                    style: 'destructive',
                    onPress: async () => {
                        setDeleting(true);
                        try {
                            // Deleting from public.profiles will trigger the CASCADE delete in Supabase
                            const { error } = await supabase
                                .from('profiles')
                                .delete()
                                .eq('id', user?.id);

                            if (error) throw error;

                            // After DB deletion, sign out the user session
                            await signOut();
                            router.replace('/login');
                        } catch (err: any) {
                            Alert.alert(t('errorTitle') || "Error", err.message || "Failed to delete account");
                        } finally {
                            setDeleting(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={20} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('myProfileTitle') || "My Profile"}</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>
            ) : (
                <ScrollView contentContainerStyle={styles.content}>
                    {/* Identity Card */}
                    <View style={styles.infoCard}>
                        <View style={styles.avatarCircle}>
                            <Text style={styles.avatarText}>{fullName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}</Text>
                        </View>
                        <Text style={styles.userEmail}>{user?.email}</Text>
                        <View style={styles.roleBadge}>
                            <Text style={styles.roleText}>Client / Diaspora</Text>
                        </View>
                    </View>

                    {/* Editable Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>{t('editProfileTitle') || "General Info"}</Text>

                        <Text style={styles.label}>{t('fullNameLabel') || "Full Name"}</Text>
                        <TextInput
                            style={styles.input}
                            value={fullName}
                            onChangeText={setFullName}
                            placeholder={t('fullNamePlaceholder') || "Enter name"}
                            placeholderTextColor="#94A3B8"
                        />

                        <Text style={styles.label}>{t('bioLabel') || "Bio"}</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={bio}
                            onChangeText={setBio}
                            placeholder={t('bioPlaceholder') || "About you"}
                            placeholderTextColor="#94A3B8"
                            multiline
                        />

                        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                            {saving ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.saveText}>{t('saveChanges') || "Save Changes"}</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Danger Zone */}
                    <View style={styles.dangerZone}>
                        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
                            <Text style={styles.signOutText}>{t('signOut') || "Sign Out"}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.deleteBtn}
                            onPress={handleDeleteAccount}
                            disabled={deleting}
                        >
                            {deleting ? (
                                <ActivityIndicator color="#EF4444" />
                            ) : (
                                <Text style={styles.deleteText}>{t('deleteAccountAction') || "Delete Account"}</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 50, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    backBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
    content: { padding: 20, gap: 20 },
    infoCard: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#E2E8F0' },
    avatarCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#0EA5E9', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    avatarText: { fontSize: 28, fontWeight: '800', color: '#fff' },
    userEmail: { fontSize: 14, color: '#64748B', marginBottom: 8 },
    roleBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
    roleText: { fontSize: 11, fontWeight: '700', color: '#475569', textTransform: 'uppercase' },
    section: { backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E2E8F0' },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 16 },
    label: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8, marginTop: 6 },
    input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, fontSize: 15, backgroundColor: '#F8FAFC', color: '#0F172A' },
    textArea: { minHeight: 100, textAlignVertical: 'top' },
    saveBtn: { backgroundColor: '#0EA5E9', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
    saveText: { color: '#fff', fontWeight: '700' },
    dangerZone: { gap: 12, marginTop: 10, marginBottom: 30 },
    signOutBtn: { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
    signOutText: { color: '#64748B', fontWeight: '700' },
    deleteBtn: { backgroundColor: '#FEF2F2', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#FEE2E2' },
    deleteText: { color: '#EF4444', fontWeight: '700' }
});