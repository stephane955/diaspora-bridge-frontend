import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    Image, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function PostUpdateScreen() {
    const router = useRouter();
    const { projectId } = useLocalSearchParams(); // Gets ID from the previous screen
    const { user } = useAuth();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    // 1. Pick Image
    const pickImage = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
            Alert.alert("Permission Required", "Please allow access to your photos.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.5,
            base64: true, // Needed if you want to upload via base64 later
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    // 2. Submit Update
    const handleSubmit = async () => {
        if (!title.trim()) return Alert.alert("Missing Title", "Please give this update a title.");
        if (!description.trim()) return Alert.alert("Missing Description", "Please describe the work done.");
        if (!user || !projectId) return;

        setUploading(true);
        try {
            // A. Image Upload (Mock for now, easy to switch to real Storage)
            // In a real app, you would upload `image` to Supabase Storage here.
            const mockImageUrl = image ? image : null;

            // B. Insert into Database
            const { error } = await supabase.from('project_updates').insert({
                project_id: projectId,
                provider_id: user.id,
                title: title,
                description: description,
                image_url: mockImageUrl,
                update_type: 'general'
            });

            if (error) throw error;

            Alert.alert("Success", "Update posted successfully!");
            router.back();

        } catch (e: any) {
            Alert.alert("Error", e.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.container}
        >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
                    <Ionicons name="close" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Post Progress</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Image Section */}
                <Text style={styles.label}>Visual Proof</Text>
                <TouchableOpacity style={styles.imageBox} onPress={pickImage}>
                    {image ? (
                        <>
                            <Image source={{ uri: image }} style={styles.previewImage} />
                            <View style={styles.editBadge}>
                                <Ionicons name="pencil" size={16} color="#fff" />
                            </View>
                        </>
                    ) : (
                        <View style={styles.placeholder}>
                            <Ionicons name="camera" size={40} color="#94A3B8" />
                            <Text style={styles.placeholderText}>Tap to upload photo</Text>
                        </View>
                    )}
                </TouchableOpacity>

                {/* Form Fields */}
                <Text style={styles.label}>Update Title</Text>
                <TextInput
                    style={styles.inputSingle}
                    placeholder="e.g. Foundation Complete"
                    value={title}
                    onChangeText={setTitle}
                />

                <Text style={styles.label}>Description</Text>
                <TextInput
                    style={styles.inputMulti}
                    placeholder="Describe what was completed..."
                    multiline
                    textAlignVertical="top"
                    value={description}
                    onChangeText={setDescription}
                />
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={uploading}>
                    {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Post Update</Text>}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },

    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    closeBtn: { padding: 8, backgroundColor: '#F1F5F9', borderRadius: 20 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },

    content: { padding: 24 },
    label: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 8, marginTop: 16 },

    imageBox: { width: '100%', height: 200, borderRadius: 20, backgroundColor: '#F8FAFC', borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed', overflow: 'hidden' },
    placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    placeholderText: { color: '#64748B', fontWeight: '600' },
    previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    editBadge: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', padding: 8, borderRadius: 20 },

    inputSingle: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 16, fontSize: 16, borderWidth: 1, borderColor: '#E2E8F0' },
    inputMulti: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 16, height: 120, fontSize: 16, borderWidth: 1, borderColor: '#E2E8F0' },

    footer: { padding: 24, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    submitBtn: { backgroundColor: '#0F172A', height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
    submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});