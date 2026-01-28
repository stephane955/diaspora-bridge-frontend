import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Image,
    ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient'; // <--- PREMIUM LOOK
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

export default function VerificationScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { t } = useLanguage();

    const [frontImage, setFrontImage] = useState<string | null>(null);
    const [backImage, setBackImage] = useState<string | null>(null);
    const [selfie, setSelfie] = useState<string | null>(null);

    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState('unverified');

    useEffect(() => { checkStatus(); }, [user]);

    const checkStatus = async () => {
        if (!user) return;
        const { data } = await supabase
            .from('profiles')
            .select('verification_status')
            .eq('id', user.id)
            .single();
        if (data) setStatus(data.verification_status);
    };

    // --- NAVIGATION FIX ---
    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            // Fallback: Force navigation to Profile Tab
            router.push('/provider/profile');
        }
    };

    const pickImage = async (type: 'front' | 'back' | 'selfie') => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Permission", t('cameraPermission') || "Camera access required");
            return;
        }

        let result;
        if (type === 'selfie') {
            result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
            });
        } else {
            result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.7,
            });
        }

        if (!result.canceled) {
            const manipResult = await ImageManipulator.manipulateAsync(
                result.assets[0].uri,
                [{ resize: { width: 800 } }],
                { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
            );

            if (type === 'front') setFrontImage(manipResult.uri);
            if (type === 'back') setBackImage(manipResult.uri);
            if (type === 'selfie') setSelfie(manipResult.uri);
        }
    };

    const uploadToSupabase = async (uri: string, path: string) => {
        const response = await fetch(uri);
        const blob = await response.blob();
        const { error } = await supabase.storage.from('verifications').upload(path, blob);
        if (error) throw error;
    };

    const handleSubmit = async () => {
        if (!frontImage || !backImage || !selfie) {
            Alert.alert("Missing Documents", t('missingFields') || "Please provide all 3 photos.");
            return;
        }

        setUploading(true);
        try {
            const timestamp = Date.now();
            const userId = user?.id;

            await uploadToSupabase(frontImage, `${userId}/front_${timestamp}.jpg`);
            await uploadToSupabase(backImage, `${userId}/back_${timestamp}.jpg`);
            await uploadToSupabase(selfie, `${userId}/selfie_${timestamp}.jpg`);

            const { error } = await supabase
                .from('profiles')
                .update({ verification_status: 'pending' })
                .eq('id', userId);

            if (error) throw error;

            setStatus('pending');
            Alert.alert(t('success'), "Documents submitted! Returning to profile.");
            setTimeout(() => router.push('/provider/profile'), 1500); // Force return to profile

        } catch (error: any) {
            Alert.alert("Error", error.message || "Upload failed.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <View style={styles.container}>

            {/* --- PREMIUM GRADIENT HEADER --- */}
            <LinearGradient colors={['#0F172A', '#334155']} style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{t('verifyTitle') || "Identity Verification"}</Text>
                    <View style={{width: 40}} />
                </View>
                {/* Visual Trust Indicator */}
                <View style={styles.headerBadgeContainer}>
                    <Ionicons name="shield-checkmark" size={32} color="#4ADE80" />
                    <Text style={styles.headerSub}>{t('verifySub') || "Secure your account"}</Text>
                </View>
            </LinearGradient>

            <ScrollView contentContainerStyle={styles.scroll}>

                {status === 'verified' ? (
                    <View style={styles.stateBox}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="checkmark-circle" size={80} color="#10B981" />
                        </View>
                        <Text style={styles.stateTitle}>{t('verified')}</Text>
                        <Text style={styles.stateText}>{t('identityConfirmed')}</Text>
                    </View>
                ) : status === 'pending' ? (
                    <View style={styles.stateBox}>
                        <Ionicons name="time" size={80} color="#F59E0B" />
                        <Text style={styles.stateTitle}>{t('statusPending') || "Pending"}</Text>
                        <Text style={styles.stateText}>We are reviewing your documents.</Text>
                    </View>
                ) : (
                    <>
                        {/* 1. ID FRONT */}
                        <TouchableOpacity style={styles.uploadCard} onPress={() => pickImage('front')}>
                            {frontImage ? (
                                <Image source={{ uri: frontImage }} style={styles.previewImage} />
                            ) : (
                                <View style={styles.placeholder}>
                                    <View style={styles.iconBg}><Ionicons name="id-card-outline" size={28} color="#0F172A" /></View>
                                    <Text style={styles.cardLabel}>{t('idFront') || "ID Front"}</Text>
                                    <Text style={styles.cardHint}>Tap to upload</Text>
                                </View>
                            )}
                            {frontImage && <View style={styles.checkBadge}><Ionicons name="checkmark" size={14} color="#fff" /></View>}
                        </TouchableOpacity>

                        {/* 2. ID BACK */}
                        <TouchableOpacity style={styles.uploadCard} onPress={() => pickImage('back')}>
                            {backImage ? (
                                <Image source={{ uri: backImage }} style={styles.previewImage} />
                            ) : (
                                <View style={styles.placeholder}>
                                    <View style={styles.iconBg}><Ionicons name="card-outline" size={28} color="#0F172A" /></View>
                                    <Text style={styles.cardLabel}>{t('idBack') || "ID Back"}</Text>
                                    <Text style={styles.cardHint}>Tap to upload</Text>
                                </View>
                            )}
                            {backImage && <View style={styles.checkBadge}><Ionicons name="checkmark" size={14} color="#fff" /></View>}
                        </TouchableOpacity>

                        {/* 3. SELFIE */}
                        <TouchableOpacity style={styles.uploadCard} onPress={() => pickImage('selfie')}>
                            {selfie ? (
                                <Image source={{ uri: selfie }} style={styles.previewImage} />
                            ) : (
                                <View style={styles.placeholder}>
                                    <View style={styles.iconBg}><Ionicons name="person" size={28} color="#0F172A" /></View>
                                    <Text style={styles.cardLabel}>{t('selfie') || "Selfie"}</Text>
                                    <Text style={styles.cardHint}>Tap to take photo</Text>
                                </View>
                            )}
                            {selfie && <View style={styles.checkBadge}><Ionicons name="checkmark" size={14} color="#fff" /></View>}
                        </TouchableOpacity>

                        <View style={styles.infoBox}>
                            <Ionicons name="lock-closed" size={16} color="#64748B" />
                            <Text style={styles.infoText}>Documents are encrypted. Only used for verification.</Text>
                        </View>

                        <View style={{height: 100}} />
                    </>
                )}
            </ScrollView>

            {/* FLOATING FOOTER */}
            {status === 'unverified' && (
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.submitBtn, uploading && styles.disabledBtn]}
                        onPress={handleSubmit}
                        disabled={uploading}
                    >
                        {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{t('submitVerify') || "Submit"}</Text>}
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },

    // HEADER STYLES
    header: {
        paddingTop: 60,
        paddingBottom: 24,
        paddingHorizontal: 24,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 5
    },
    headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
    headerBadgeContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 4 },
    headerSub: { fontSize: 14, color: '#E2E8F0', fontWeight: '500' },

    scroll: { padding: 24 },

    // CARDS
    uploadCard: { height: 160, backgroundColor: '#fff', borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2, overflow: 'hidden' },
    placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
    iconBg: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    cardLabel: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
    cardHint: { fontSize: 12, color: '#94A3B8' },
    previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },

    checkBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: '#22C55E', width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },

    infoBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#EFF6FF', padding: 16, borderRadius: 16, marginTop: 8 },
    infoText: { flex: 1, fontSize: 12, color: '#3B82F6', fontWeight: '600' },

    // FOOTER
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    submitBtn: { backgroundColor: '#0F172A', paddingVertical: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#0F172A', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    disabledBtn: { backgroundColor: '#94A3B8', shadowOpacity: 0 },
    submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },

    // STATUS STATES
    stateBox: { alignItems: 'center', marginTop: 60, gap: 16 },
    iconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' },
    stateTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
    stateText: { textAlign: 'center', color: '#64748B', fontSize: 15 },
});