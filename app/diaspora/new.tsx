import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator, Platform } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function NewProject() {
    const router = useRouter();
    const { user } = useAuth();

    const [title, setTitle] = useState('');
    const [city, setCity] = useState('');
    const [budget, setBudget] = useState('');
    const [description, setDescription] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // 1. Pick an Image
    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.7,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    // 2. Upload Image & Save Project
    const handleCreate = async () => {
        if (!title || !city || !budget) {
            Alert.alert('Missing Fields', 'Please fill in the title, city, and budget.');
            return;
        }

        setLoading(true);

        try {
            // A. Upload Image (Optional: For now we just use the local URI or a placeholder logic)
            // *Note: Real image upload to Supabase Storage requires extra setup.
            // For this demo, we will simulate it or save the URI if testing locally.
            // Ideally, you upload the file to Supabase Storage here and get a public URL.*

            const imageUrl = image || 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=1000';

            // B. Insert into Database
            const { error } = await supabase
                .from('projects')
                .insert({
                    owner_id: user?.id,
                    title: title,
                    city: city,
                    budget: parseFloat(budget) || 0,
                    description: description,
                    status: 'Active',
                    image_url: imageUrl,
                });

            if (error) throw error;

            Alert.alert('Success', 'Project created successfully!');
            router.back(); // Go back to dashboard

        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>

            {/* Image Section */}
            <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                {image ? (
                    <Image source={{ uri: image }} style={styles.previewImage} />
                ) : (
                    <View style={styles.placeholder}>
                        <Ionicons name="camera-outline" size={40} color="#94A3B8" />
                        <Text style={styles.photoText}>Add Cover Photo</Text>
                    </View>
                )}
            </TouchableOpacity>

            <View style={styles.form}>
                <Text style={styles.label}>Project Title</Text>
                <TextInput
                    style={styles.input}
                    placeholder="e.g. Family Duplex in Douala"
                    value={title}
                    onChangeText={setTitle}
                />

                <Text style={styles.label}>City / Location</Text>
                <TextInput
                    style={styles.input}
                    placeholder="e.g. Bonapriso, Douala"
                    value={city}
                    onChangeText={setCity}
                />

                <Text style={styles.label}>Estimated Budget (CFA)</Text>
                <TextInput
                    style={styles.input}
                    placeholder="e.g. 15000000"
                    keyboardType="numeric"
                    value={budget}
                    onChangeText={setBudget}
                />

                <Text style={styles.label}>Description</Text>
                <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Describe the scope of work..."
                    multiline
                    numberOfLines={4}
                    value={description}
                    onChangeText={setDescription}
                />

                <TouchableOpacity
                    style={[styles.submitBtn, loading && styles.disabledBtn]}
                    onPress={handleCreate}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.btnText}>Create Project</Text>
                    )}
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    imagePicker: { width: '100%', height: 200, backgroundColor: '#E2E8F0', marginBottom: 20 },
    previewImage: { width: '100%', height: '100%' },
    placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    photoText: { color: '#64748B', fontWeight: '600' },

    form: { padding: 20 },
    label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8, marginTop: 16 },
    input: { backgroundColor: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 16, color: '#0F172A' },
    textArea: { height: 100, textAlignVertical: 'top' },

    submitBtn: { backgroundColor: '#0EA5E9', padding: 18, borderRadius: 14, alignItems: 'center', marginTop: 30, shadowColor: "#0EA5E9", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    disabledBtn: { opacity: 0.7 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});