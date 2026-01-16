import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Alert, ActivityIndicator, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

type PortfolioItem = {
    id: number;
    image_url: string;
    created_at: string;
};

export default function ProviderProfile() {
    const { user, signOut } = useAuth(); // Use signOut from AuthContext for cleaner logic
    const router = useRouter();
    const { t } = useLanguage();
    const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [fullName, setFullName] = useState('');
    const [bio, setBio] = useState('');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const fetchPortfolio = useCallback(async () => {
        if (!user) return;
        const { data } = await supabase
            .from('portfolios')
            .select('*')
            .eq('provider_id', user.id)
            .order('created_at', { ascending: false });

        setPortfolio(data || []);
    }, [user]);

    const fetchProfile = useCallback(async () => {
        if (!user) return;
        const { data } = await supabase
            .from('profiles')
            .select('full_name, bio')
            .eq('id', user.id)
            .maybeSingle();

        setFullName(data?.full_name || user.user_metadata?.full_name || '');
        setBio(data?.bio || '');
    }, [user]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            await Promise.all([fetchPortfolio(), fetchProfile()]);
            setLoading(false);
        };
        load();
    }, [fetchPortfolio, fetchProfile]);

    const addPastWork = async () => {
        if (!user) return;
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert(t('permissionNeededTitle'), t('portfolioPermissionBody'));
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7
        });

        if (result.canceled) return;

        try {
            setUploading(true);
            const asset = result.assets[0];
            const ext = asset.uri.split('.').pop() || 'jpg';
            const path = `portfolio/${user.id}-${Date.now()}.${ext}`;

            const response = await fetch(asset.uri);
            const arrayBuffer = await response.arrayBuffer();
            const { error: uploadError } = await supabase.storage
                .from('portfolio-images')
                .upload(path, arrayBuffer, { contentType: asset.mimeType || 'image/jpeg' });

            if (uploadError) throw uploadError;
            const { data: publicData } = supabase.storage.from('portfolio-images').getPublicUrl(path);

            const { error } = await supabase.from('portfolios').insert({
                provider_id: user.id,
                image_url: publicData.publicUrl
            });
            if (error) throw error;

            fetchPortfolio();
        } catch (error: any) {
            Alert.alert(t('uploadFailedTitle'), error.message || t('portfolioUploadFailed'));
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);

        const { error } = await supabase
            .from('profiles')
            .upsert({ id: user.id, full_name: fullName, bio }, { onConflict: 'id' });

        if (!error) {
            await supabase.auth.updateUser({ data: { full_name: fullName } });
        }

        setSaving(false);

        if (error) {
            Alert.alert(t('errorTitle'), error.message || t('profileSaveFailed'));
            return;
        }

        Alert.alert(t('successTitle'), t('profileSaved'));
    };

    const handleSignOut = () => {
        Alert.alert(t('signOutTitle'), t('signOutConfirmBody'), [
            { text: t('cancel'), style: 'cancel' },
            {
                text: t('signOut'),
                style: 'destructive',
                onPress: async () => {
                    await supabase.auth.signOut();
                    router.replace('/login');
                }
            }
        ]);
    };

    // --- NEW: DELETE ACCOUNT LOGIC ---
    const handleDeleteAccount = () => {
        Alert.alert(
            t('deleteAccountTitle') || "Delete Account",
            t('deleteAccountConfirm') || "Are you sure? This will permanently delete your profile, portfolio, and active applications. This cannot be undone.",
            [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: t('delete'),
                    style: 'destructive',
                    onPress: async () => {
                        setDeleting(true);
                        try {
                            // Deleting from 'profiles' will trigger CASCADE delete in your DB
                            const { error } = await supabase.from('profiles').delete().eq('id', user?.id);

                            if (error) throw error;

                            // Finally, sign out and go to login
                            await supabase.auth.signOut();
                            router.replace('/login');
                        } catch (err: any) {
                            Alert.alert(t('errorTitle'), err.message || "Failed to delete account");
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
                <Text style={styles.headerTitle}>{t('myProfileTitle')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('editProfileTitle')}</Text>
                    <Text style={styles.label}>{t('fullNameLabel')}</Text>
                    <TextInput
                        style={styles.input}
                        value={fullName}
                        onChangeText={setFullName}
                        placeholder={t('fullNamePlaceholder')}
                        placeholderTextColor="#94A3B8"
                    />

                    <Text style={styles.label}>{t('bioLabel')}</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={bio}
                        onChangeText={setBio}
                        placeholder={t('bioPlaceholder')}
                        placeholderTextColor="#94A3B8"
                        multiline
                    />

                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{t('saveChanges')}</Text>}
                    </TouchableOpacity>
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>{t('portfolioTitle')}</Text>
                        <TouchableOpacity style={styles.addBtn} onPress={addPastWork} disabled={uploading}>
                            {uploading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="add" size={16} color="#fff" />
                                    <Text style={styles.addText}>{t('addAction')}</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <ActivityIndicator size="large" color="#0EA5E9" style={{ marginTop: 20 }} />
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                            {portfolio.length === 0 ? (
                                <View style={styles.empty}>
                                    <Text style={styles.emptyText}>{t('noPortfolioItems')}</Text>
                                    <Text style={styles.emptySub}>{t('portfolioHint')}</Text>
                                </View>
                            ) : (
                                portfolio.map((item) => (
                                    <Image key={item.id} source={{ uri: item.image_url }} style={styles.portfolioImg} />
                                ))
                            )}
                        </ScrollView>
                    )}
                </View>

                {/* --- Danger Zone --- */}
                <View style={styles.dangerZone}>
                    <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
                        <Text style={styles.signOutText}>{t('signOut')}</Text>
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 50, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    backBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
    content: { padding: 20, gap: 20 },
    section: { backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E2E8F0' },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
    label: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8, marginTop: 6 },
    input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, fontSize: 15, backgroundColor: '#fff', color: '#0F172A' },
    textArea: { minHeight: 100, textAlignVertical: 'top' },
    saveBtn: { backgroundColor: '#0F172A', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
    saveText: { color: '#fff', fontWeight: '700' },
    addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0EA5E9', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
    addText: { color: '#fff', fontWeight: '700' },
    portfolioImg: { width: 200, height: 160, borderRadius: 16, backgroundColor: '#E2E8F0' },
    empty: { width: 260, backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#E2E8F0' },
    emptyText: { fontWeight: '800', color: '#0F172A', marginBottom: 6 },
    emptySub: { color: '#64748B' },
    dangerZone: { gap: 12, marginTop: 10, marginBottom: 30 },
    signOutBtn: { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
    signOutText: { color: '#64748B', fontWeight: '700' },
    deleteBtn: { backgroundColor: '#FEF2F2', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#FEE2E2' },
    deleteText: { color: '#EF4444', fontWeight: '700' }
});