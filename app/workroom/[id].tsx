import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    Alert, ActivityIndicator, Image
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator'; // <--- The Fix
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { FlashList } from '@shopify/flash-list';

export default function WorkroomScreen() {
    const { id } = useLocalSearchParams(); // Project ID
    const { user } = useAuth();
    const router = useRouter();

    const [project, setProject] = useState<any>(null);
    const [milestones, setMilestones] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchWorkroomData();
    }, [id]);

    const fetchWorkroomData = async () => {
        try {
            // 1. Get Project Details
            const { data: proj } = await supabase
                .from('projects')
                .select('*, profiles:owner_id(full_name, avatar_url, city)')
                .eq('id', id)
                .single();
            setProject(proj);

            // 2. Get Milestones
            const { data: miles } = await supabase
                .from('milestones')
                .select('*')
                .eq('project_id', id)
                .order('created_at', { ascending: true });

            setMilestones(miles || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleUploadEvidence = async (milestoneId: string) => {
        try {
            // 1. Pick Image (Prevent cropping to save RAM on old phones)
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 0.5,
            });

            if (result.canceled) return;
            setUploading(true);

            // 2. OPTIMIZATION: Resize & Compress (The "Cameroon Fix")
            // This ensures a 4MB photo becomes ~40KB for fast 3G upload
            const manipulatedResult = await ImageManipulator.manipulateAsync(
                result.assets[0].uri,
                [{ resize: { width: 800 } }],
                { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
            );

            // 3. Prepare Upload
            const uri = manipulatedResult.uri;
            const fileName = `${milestoneId}_${Date.now()}.jpg`;
            const filePath = `evidence/${fileName}`;

            // 4. Upload to Storage
            const response = await fetch(uri);
            const blob = await response.blob();

            const { error: uploadError } = await supabase.storage
                .from('evidence')
                .upload(filePath, blob);

            if (uploadError) throw uploadError;

            // 5. Update Database
            const { error: dbError } = await supabase
                .from('milestones')
                .update({
                    evidence_url: filePath,
                    status: 'in_review'
                })
                .eq('id', milestoneId);

            if (dbError) throw dbError;

            Alert.alert("Success", "Evidence uploaded! Client notified.");
            fetchWorkroomData();

        } catch (e: any) {
            Alert.alert("Upload Failed", "Check your internet connection.");
        } finally {
            setUploading(false);
        }
    };

    const renderMilestone = ({ item, index }: { item: any, index: number }) => {
        const isLocked = index > 0 && milestones[index - 1].status !== 'paid';
        const isPaid = item.status === 'paid';
        const isReview = item.status === 'in_review';

        return (
            <View style={[styles.milestoneCard, isLocked && styles.lockedCard]}>
                <View style={styles.milestoneHeader}>
                    <View style={styles.stepBadge}>
                        <Text style={styles.stepText}>Step {index + 1}</Text>
                    </View>
                    <Text style={[styles.statusText, isPaid ? styles.textGreen : styles.textOrange]}>
                        {item.status.toUpperCase().replace('_', ' ')}
                    </Text>
                </View>

                <Text style={styles.milestoneTitle}>{item.title}</Text>
                <Text style={styles.milestoneAmount}>{Number(item.amount).toLocaleString()} CFA</Text>

                {/* ACTION BUTTONS */}
                {!isLocked && !isPaid && (
                    <TouchableOpacity
                        style={[styles.actionBtn, isReview && styles.disabledBtn]}
                        onPress={() => !isReview && handleUploadEvidence(item.id)}
                        disabled={isReview || uploading}
                    >
                        {uploading ? (
                            <ActivityIndicator color="#fff" />
                        ) : isReview ? (
                            <Text style={styles.btnText}>Waiting for Approval...</Text>
                        ) : (
                            <View style={{flexDirection:'row', alignItems:'center', gap: 8}}>
                                <Ionicons name="camera" size={18} color="#fff" />
                                <Text style={styles.btnText}>Upload Proof</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                )}

                {isLocked && (
                    <View style={styles.lockOverlay}>
                        <Ionicons name="lock-closed" size={20} color="#94A3B8" />
                        <Text style={styles.lockText}>Complete previous step to unlock</Text>
                    </View>
                )}
            </View>
        );
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0F172A" /></View>;

    return (
        <View style={styles.container}>
            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Workroom</Text>
                <View style={{width: 40}} />
            </View>

            {/* UPGRADE: FlashList handles the scrolling (ListHeaderComponent) */}
            <View style={{flex: 1, paddingHorizontal: 20}}>
                <FlashList
                    data={milestones}
                    renderItem={renderMilestone}
                    estimatedItemSize={150}
                    ListHeaderComponent={
                        <View style={styles.projectCard}>
                            <Text style={styles.projectTitle}>{project?.title}</Text>
                            <View style={styles.clientRow}>
                                <Image source={{ uri: project?.profiles?.avatar_url }} style={styles.avatar} />
                                <View>
                                    <Text style={styles.clientName}>{project?.profiles?.full_name}</Text>
                                    <Text style={styles.clientCity}>{project?.profiles?.city}</Text>
                                </View>
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>IN PROGRESS</Text>
                                </View>
                            </View>
                            <Text style={styles.sectionTitle}>Project Milestones</Text>
                        </View>
                    }
                    contentContainerStyle={{ paddingBottom: 40 }}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 15, backgroundColor: '#fff' },
    backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },

    projectCard: { backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 20, marginTop: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
    projectTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 15 },
    clientRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E2E8F0' },
    clientName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
    clientCity: { fontSize: 12, color: '#64748B' },
    badge: { marginLeft: 'auto', backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    badgeText: { fontSize: 10, fontWeight: '800', color: '#16A34A' },

    sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },

    milestoneCard: { backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0' },
    lockedCard: { opacity: 0.6, backgroundColor: '#F1F5F9' },

    milestoneHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    stepBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    stepText: { fontSize: 10, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' },
    statusText: { fontSize: 12, fontWeight: '700' },
    textGreen: { color: '#16A34A' },
    textOrange: { color: '#F59E0B' },

    milestoneTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
    milestoneAmount: { fontSize: 14, color: '#64748B', marginBottom: 15 },

    actionBtn: { backgroundColor: '#0F172A', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
    disabledBtn: { backgroundColor: '#94A3B8' },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    lockOverlay: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
    lockText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' }
});