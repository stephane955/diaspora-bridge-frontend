import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function PostUpdateScreen() {
    const router = useRouter();
    const { user } = useAuth();

    const [description, setDescription] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [projects, setProjects] = useState<any[]>([]);
    const [selectedProject, setSelectedProject] = useState<string | null>(null);

    useEffect(() => {
        fetchProjects();
    }, []);

    async function fetchProjects() {
        const { data } = await supabase.from('projects').select('id, title');
        if (data) setProjects(data);
    }

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.5,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const handleUpload = async () => {
        if (!selectedProject || !description || !image) {
            Alert.alert('Missing Info', 'Please select a project, add a description, and a photo.');
            return;
        }

        setLoading(true);
        try {
            // 1. Prepare Image Name
            const fileName = `${Date.now()}.jpg`;
            const formData = new FormData();
            formData.append('file', {
                uri: image,
                name: fileName,
                type: 'image/jpeg',
            } as any);

            // 2. Upload to Supabase Storage (Assumes bucket 'updates' exists)
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('updates')
                .upload(fileName, formData);

            if (uploadError) throw uploadError;

            // 3. Get Public URL
            const { data: { publicUrl } } = supabase.storage.from('updates').getPublicUrl(fileName);

            // 4. Save to Database
            const { error: dbError } = await supabase.from('project_updates').insert([
                {
                    project_id: selectedProject,
                    provider_id: user?.id,
                    description,
                    image_url: publicUrl,
                }
            ]);

            if (dbError) throw dbError;

            Alert.alert('Success', 'Update posted successfully!');
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

            <Text style={styles.label}>Select Project</Text>
            <View style={styles.pickerContainer}>
                {projects.map((p) => (
                    <TouchableOpacity
                        key={p.id}
                        style={[styles.projectOption, selectedProject === p.id && styles.selectedOption]}
                        onPress={() => setSelectedProject(p.id)}
                    >
                        <Text style={selectedProject === p.id ? styles.whiteText : {}}>{p.title}</Text>
                    </TouchableOpacity>
                ))}
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
    title: { fontSize: 24, fontWeight: '800', marginBottom: 20, marginTop: 40 },
    label: { fontSize: 14, fontWeight: '600', color: '#64748B', marginBottom: 8, marginTop: 20 },
    input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 15, fontSize: 16, textAlignVertical: 'top' },
    pickerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    projectOption: { padding: 10, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 20 },
    selectedOption: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
    whiteText: { color: '#fff', fontWeight: '700' },
    imageBtn: { marginTop: 20, height: 200, backgroundColor: '#F8FAFC', borderRadius: 12, overflow: 'hidden', borderStyle: 'dashed', borderWidth: 2, borderColor: '#CBD5E1' },
    previewImage: { width: '100%', height: '100%' },
    placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    placeholderText: { color: '#94A3B8', marginTop: 10, fontWeight: '600' },
    submitBtn: { marginTop: 30, backgroundColor: '#0EA5E9', padding: 18, borderRadius: 12, alignItems: 'center' },
    submitText: { color: '#fff', fontSize: 16, fontWeight: '700' }
});