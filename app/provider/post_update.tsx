import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker'; //
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase'; //
import { useAuth } from '@/context/AuthContext'; //
import { mediumFeedback, successFeedback } from '@/utils/haptics'; //

export default function PostUpdateScreen() {
    const router = useRouter();
    const { user } = useAuth();

    // 1. Grab the projectId passed from the Active Sites screen
    const params = useLocalSearchParams();
    const projectId = params.projectId;

    const [description, setDescription] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [projectTitle, setProjectTitle] = useState('');

    // 2. Fetch Project Name (so the provider knows what they are posting to)
    useEffect(() => {
        if (projectId) {
            fetchProjectDetails();
        }
    }, [projectId]);

    const fetchProjectDetails = async () => {
        const { data } = await supabase
            .from('projects')
            .select('title')
            .eq('id', projectId)
            .single();
        if (data) setProjectTitle(data.title);
    };

    const pickImage = async () => {
        mediumFeedback();
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.5,
            base64: true, // Needed for simple upload
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const handleUpload = async () => {
        if (!projectId || !description || !image) {
            Alert.alert('Missing Info', 'Please add a description and a photo.');
            return;
        }

        setLoading(true);
        try {
            // A. Upload Image logic would go here
            // (For now, we'll assume the URI is enough for the prototype or use a placeholder if backend storage isn't ready)
            // Ideally: Upload to Supabase Storage -> Get Public URL -> Save URL

            // For this step, we will save the local URI to the DB so the flow works
            // (In production, replace this with the Storage code we discussed in Chat)

            // B. Save Update to Database
            const { error } = await supabase.from('project_updates').insert([
                {
                    project_id: projectId,
                    provider_id: user?.id,
                    description: description,
                    // In a real app, this must be a http URL from Supabase Storage
                    image_url: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&q=80',
                    title: 'Work Update' // Default title
                }
            ]);

            if (error) throw error;

            successFeedback();
            Alert.alert('Success', 'Update posted! The client can now see it.');
            router.back();

        } catch (error: any) {
            Alert.alert('Upload Failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
            <Text style={styles.title}>Post Work Update</Text>

            {/* Context Header */}
            <View style={styles.projectBadge}>
                <Ionicons name="briefcase" size={16} color="#0EA5E9" />
                <Text style={styles.projectBadgeText}>
                    Posting to: <Text style={{fontWeight: '800'}}>{projectTitle || 'Loading...'}</Text>
                </Text>
            </View>

            <Text style={styles.label}>What was done today?</Text>
            <TextInput
                style={styles.input}
                multiline
                numberOfLines={4}
                value={description}
                onChangeText={setDescription}
                placeholder="e.g., Finished the foundation blocks..."
            />

            <TouchableOpacity style={styles.imageBtn} onPress={pickImage}>
                {image ? (
                    <Image source={{ uri: image }} style={styles.previewImage} />
                ) : (
                    <View style={styles.placeholder}>
                        <Ionicons name="camera" size={40} color="#94A3B8" />
                        <Text style={styles.placeholderText}>Add Progress Photo</Text>
                    </View>
                )}
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.submitBtn, loading && { opacity: 0.5 }]}
                onPress={handleUpload}
                disabled={loading}
            >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Update</Text>}
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    title: { fontSize: 24, fontWeight: '800', marginBottom: 20, marginTop: 40, color: '#0F172A' },

    projectBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F0F9FF', padding: 12, borderRadius: 12, marginBottom: 20 },
    projectBadgeText: { color: '#0369A1', fontSize: 14 },

    label: { fontSize: 14, fontWeight: '600', color: '#64748B', marginBottom: 8 },
    input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 15, fontSize: 16, textAlignVertical: 'top', backgroundColor: '#F8FAFC', minHeight: 100 },

    imageBtn: { marginTop: 20, height: 200, backgroundColor: '#F8FAFC', borderRadius: 12, overflow: 'hidden', borderStyle: 'dashed', borderWidth: 2, borderColor: '#CBD5E1' },
    previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    placeholderText: { color: '#94A3B8', marginTop: 10, fontWeight: '600' },

    submitBtn: { marginTop: 30, backgroundColor: '#0EA5E9', padding: 18, borderRadius: 16, alignItems: 'center', shadowColor: "#0EA5E9", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    submitText: { color: '#fff', fontSize: 16, fontWeight: '700' }
});