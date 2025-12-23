import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, Image, Alert, ActivityIndicator, KeyboardAvoidingView,
    Platform, Modal, FlatList
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import NavigationBar from '@/components/NavigationBar';

// 1. DEFINE YOUR OFFICIAL CITY LIST HERE
const CITIES = [
    "Douala", "Yaoundé", "Bamenda", "Bafoussam",
    "Garoua", "Maroua", "Ngaoundéré", "Kumba",
    "Buea", "Nkongsamba", "Limbe", "Kribi"
];

export default function NewProjectScreen() {
    const router = useRouter();
    const { user } = useAuth();

    const [title, setTitle] = useState('');
    const [budget, setBudget] = useState('');
    const [description, setDescription] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Dropdown State
    const [city, setCity] = useState('');
    const [showCityModal, setShowCityModal] = useState(false);

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

    // Inside app/diaspora/new.tsx

    const handleCreate = async () => {
        // 1. Prevent double clicks
        if (loading) return;

        if (!title || !city || !budget || !description) {
            return Alert.alert("Missing Info", "Please fill in all fields.");
        }

        setLoading(true);

        try {
            let imageUrl = null;

            // Image Upload
            if (image) {
                const fileName = `${Date.now()}.jpg`;
                const formData = new FormData();
                formData.append('file', {
                    uri: image,
                    name: fileName,
                    type: 'image/jpeg',
                } as any);

                const { data } = await supabase.storage.from('project-images').upload(fileName, formData);
                if (data) {
                    const { data: publicUrl } = supabase.storage.from('project-images').getPublicUrl(fileName);
                    imageUrl = publicUrl.publicUrl;
                }
            }

            // Create Project
            const { error: insertError } = await supabase
                .from('projects')
                .insert({
                    owner_id: user?.id,
                    title,
                    city,
                    description,
                    budget: parseInt(budget),
                    image_url: imageUrl,
                    status: 'Pending',
                    created_at: new Date(),
                });

            if (insertError) throw insertError;

            // --- THE FIX IS HERE ---

            // 2. STOP the spinner immediately so the button comes back
            setLoading(false);

            // 3. Show Success Alert -> Then Navigate to Dashboard
            Alert.alert("Success", "Project posted!", [
                {
                    text: "OK",
                    onPress: () => {
                        // This forces the app to go to the Dashboard
                        router.replace('/diaspora');
                    }
                }
            ]);

        } catch (e: any) {
            // 4. Stop spinner on error too
            setLoading(false);
            Alert.alert("Error", e.message);
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: '#fff' }}>
            {/* Custom Modal for City Selection */}
            <Modal visible={showCityModal} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select City</Text>
                            <TouchableOpacity onPress={() => setShowCityModal(false)}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={CITIES}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.cityOption}
                                    onPress={() => { setCity(item); setShowCityModal(false); }}
                                >
                                    <Text style={[styles.cityText, city === item && { color: '#0EA5E9', fontWeight: '700' }]}>
                                        {item}
                                    </Text>
                                    {city === item && <Ionicons name="checkmark" size={20} color="#0EA5E9" />}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>

            <NavigationBar title="New Project" showBack={true} />

            <ScrollView contentContainerStyle={styles.content}>

                <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                    {image ? (
                        <Image source={{ uri: image }} style={styles.previewImage} />
                    ) : (
                        <View style={styles.placeholder}>
                            <Ionicons name="camera" size={32} color="#94A3B8" />
                            <Text style={styles.pickerText}>Add Cover Photo</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <Text style={styles.label}>Project Title</Text>
                <TextInput
                    style={styles.input}
                    placeholder="e.g. Villa Construction"
                    placeholderTextColor="#CBD5E1"
                    value={title}
                    onChangeText={setTitle}
                />

                <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.label}>City / Location</Text>
                        {/* CHANGED: This is now a button that opens the modal */}
                        <TouchableOpacity
                            style={[styles.input, styles.dropdownBtn]}
                            onPress={() => setShowCityModal(true)}
                        >
                            <Text style={{ color: city ? '#0F172A' : '#CBD5E1', fontSize: 16 }}>
                                {city || "Select City"}
                            </Text>
                            <Ionicons name="chevron-down" size={20} color="#64748B" />
                        </TouchableOpacity>
                    </View>
                    <View style={{ width: 12 }} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Budget (CFA)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="5,000,000"
                            placeholderTextColor="#CBD5E1"
                            keyboardType="numeric"
                            value={budget}
                            onChangeText={setBudget}
                        />
                    </View>
                </View>

                <Text style={styles.label}>Description</Text>
                <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Describe the work needed..."
                    placeholderTextColor="#CBD5E1"
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    value={description}
                    onChangeText={setDescription}
                />

                <TouchableOpacity
                    style={[styles.createBtn, loading && { opacity: 0.7 }]}
                    onPress={handleCreate}
                    disabled={loading}
                >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Post Job</Text>}
                </TouchableOpacity>

            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    content: { padding: 20 },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '60%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
    cityOption: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    cityText: { fontSize: 16, color: '#334155' },

    imagePicker: { height: 180, backgroundColor: '#F8FAFC', borderRadius: 16, marginBottom: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed' },
    placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
    pickerText: { color: '#64748B', fontWeight: '600' },
    previewImage: { width: '100%', height: '100%' },

    label: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8, marginTop: 4 },
    input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, fontSize: 16, color: '#0F172A', marginBottom: 16 },
    dropdownBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

    textArea: { height: 100 },
    row: { flexDirection: 'row' },

    createBtn: { backgroundColor: '#0F172A', padding: 18, borderRadius: 14, alignItems: 'center', marginTop: 10 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '700' }
});