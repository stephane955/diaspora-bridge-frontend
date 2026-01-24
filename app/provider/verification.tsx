import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator, ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function VerificationScreen() {
    const { user } = useAuth();
    const router = useRouter();

    const [idImage, setIdImage] = useState<string | null>(null);
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

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.5, // Compressed for mobile data efficiency
        });

        if (!result.canceled) {
            setIdImage(result.assets[0].uri);
        }
    };

    const handleUpload = async () => {
        if (!idImage || !user) return Alert.alert("Required", "Please select an ID photo.");
        setUploading(true);

        try {
            // 1. Fetch the image and convert to Blob
            const response = await fetch(idImage);
            const blob = await response.blob();

            // 2. Setup unique path: folder/filename
            const fileExt = idImage.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const filePath = `${user.id}/${fileName}`;

            // 3. Upload to 'verifications' Private Bucket
            const { error: uploadError } = await supabase.storage
                .from('verifications')
                .upload(filePath, blob);

            if (uploadError) throw uploadError;

            // 4. Record the submission in the 'verifications' table
            const { error: vaultError } = await supabase
                .from('verifications')
                .insert({
                    user_id: user.id,
                    document_url: filePath,
                });

            if (vaultError) throw vaultError;

            // 5. Update Profile status to 'pending'
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ verification_status: 'pending' })
                .eq('id', user.id);

            if (profileError) throw profileError;

            setStatus('pending');
            Alert.alert("Success", "Documents submitted for review!");

        } catch (e: any) {
            console.error("Upload Error:", e);
            Alert.alert("Upload Failed", e.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.title}>Trust & Safety</Text>
            </View>

            <View style={styles.content}>
                {status === 'verified' ? (
                    <View style={styles.stateBox}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="checkmark-circle" size={80} color="#10B981" />
                        </View>
                        <Text style={styles.stateTitle}>Identity Verified</Text>
                        <Text style={styles.stateText}>You now have the official badge. This helps you get hired faster and unlock withdrawals.</Text>
                    </View>
                ) : status === 'pending' ? (
                    <View style={styles.stateBox}>
                        <Ionicons name="time" size={80} color="#F59E0B" />
                        <Text style={styles.stateTitle}>Review in Progress</Text>
                        <Text style={styles.stateText}>We're checking your documents. This usually takes less than 24 hours.</Text>
                    </View>
                ) : (
                    <>
                        <Text style={styles.sectionTitle}>Get Verified</Text>
                        <Text style={styles.infoText}>
                            Upload a clear photo of your National ID (CNI) or Passport. This data is stored securely and never shared.
                        </Text>

                        <TouchableOpacity style={styles.uploadCard} onPress={pickImage}>
                            {idImage ? (
                                <Image source={{ uri: idImage }} style={styles.previewImage} />
                            ) : (
                                <View style={styles.uploadPlaceholder}>
                                    <Ionicons name="id-card-outline" size={48} color="#94A3B8" />
                                    <Text style={styles.uploadLabel}>Select ID Photo</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.submitBtn, uploading && { opacity: 0.7 }]}
                            onPress={handleUpload}
                            disabled={uploading}
                        >
                            {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit for Approval</Text>}
                        </TouchableOpacity>
                    </>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: '#fff', gap: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    title: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
    content: { padding: 24 },
    sectionTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
    infoText: { fontSize: 15, color: '#64748B', lineHeight: 22, marginBottom: 32 },
    uploadCard: { height: 240, backgroundColor: '#fff', borderRadius: 20, borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed', overflow: 'hidden', justifyContent: 'center', alignItems: 'center', marginBottom: 32 },
    uploadPlaceholder: { alignItems: 'center', gap: 12 },
    uploadLabel: { color: '#94A3B8', fontWeight: '600' },
    previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    submitBtn: { backgroundColor: '#0F172A', padding: 18, borderRadius: 16, alignItems: 'center' },
    submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    stateBox: { alignItems: 'center', marginTop: 40, gap: 16 },
    iconCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' },
    stateTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
    stateText: { textAlign: 'center', color: '#64748B', lineHeight: 22 },
});