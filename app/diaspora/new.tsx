import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView,
    Platform, Modal, FlatList, ImageBackground
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur'; // Optional: for premium glass effect

const CITIES = [
    "Douala", "Yaoundé", "Bamenda", "Bafoussam",
    "Garoua", "Maroua", "Ngaoundéré", "Kumba",
    "Buea", "Nkongsamba", "Limbe", "Kribi"
];

export default function NewProjectScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { t } = useLanguage();

    const [title, setTitle] = useState('');
    const [budget, setBudget] = useState('');
    const [description, setDescription] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [city, setCity] = useState('');
    const [showCityPicker, setShowCityPicker] = useState(false);

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'] as any,
                allowsEditing: true,
                aspect: [16, 9],
                quality: 0.5,
            });

            if (!result.canceled && result.assets[0].uri) {
                setImage(result.assets[0].uri);
            }
        } catch (e) {
            console.log("Image picker error:", e);
        }
    };

    const handleSubmit = async () => {
        if (!title || !city || !budget || !description) {
            Alert.alert("Missing Fields", "Please fill in all details.");
            return;
        }
        setLoading(true);
        try {
            const imageUrl = image || 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&q=80';
            const { error } = await supabase.from('projects').insert({
                owner_id: user?.id,
                title, city,
                budget: parseFloat(budget),
                description,
                image_url: imageUrl,
                status: 'pending',
            });
            if (error) throw error;
            Alert.alert("Success", "Project posted successfully!");
            router.replace('/diaspora');
        } catch (err: any) {
            Alert.alert("Error", err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* --- HEADER --- */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color="#0F172A" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{t('tabPostJob' as any) || "Create Project"}</Text>
                    <View style={{ width: 44 }} />
                </View>

                {/* --- IMAGE PICKER --- */}
                <TouchableOpacity onPress={pickImage} activeOpacity={0.9} style={styles.imagePickerContainer}>
                    {image ? (
                        <ImageBackground source={{ uri: image }} style={styles.previewImage} imageStyle={{ borderRadius: 28 }}>
                            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={styles.imageOverlay}>
                                <View style={styles.glassBadge}>
                                    <Ionicons name="camera" size={18} color="#fff" />
                                    <Text style={styles.editText}>Change Cover</Text>
                                </View>
                            </LinearGradient>
                        </ImageBackground>
                    ) : (
                        <View style={styles.placeholderWrapper}>
                            <LinearGradient colors={['#F8FAFC', '#F1F5F9']} style={styles.placeholderGradient}>
                                <View style={styles.iconCircle}>
                                    <Ionicons name="add" size={32} color="#0EA5E9" />
                                </View>
                                <Text style={styles.placeholderText}>Add a project photo</Text>
                            </LinearGradient>
                        </View>
                    )}
                </TouchableOpacity>

                {/* --- FORM --- */}
                <View style={styles.formCard}>
                    <Text style={styles.sectionTitle}>Project Specs</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('project.title' as any) || "Project Title"}</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Modern Villa Design"
                            placeholderTextColor="#94A3B8"
                            value={title}
                            onChangeText={setTitle}
                        />
                    </View>

                    <View style={styles.row}>
                        <View style={styles.flex1}>
                            <Text style={styles.label}>{t('project.city' as any) || "Location"}</Text>
                            <TouchableOpacity style={styles.selectBtn} onPress={() => setShowCityPicker(true)}>
                                <Text style={city ? styles.selectText : styles.placeholderSelect}>{city || "Select City"}</Text>
                                <Ionicons name="location" size={16} color="#0EA5E9" />
                            </TouchableOpacity>
                        </View>
                        <View style={[styles.flex1, { marginLeft: 16 }]}>
                            <Text style={styles.label}>{t('project.budget' as any) || "Budget"}</Text>
                            <View style={styles.budgetContainer}>
                                <TextInput
                                    style={styles.budgetInput}
                                    placeholder="0"
                                    keyboardType="numeric"
                                    value={budget}
                                    onChangeText={setBudget}
                                />
                                <Text style={styles.currency}>CFA</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('project.description' as any) || "Detailed Description"}</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            placeholder="What needs to be done?"
                            placeholderTextColor="#94A3B8"
                            multiline
                            value={description}
                            onChangeText={setDescription}
                        />
                    </View>

                    {/* --- BUTTON MOVED HERE --- */}
                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={loading}
                        activeOpacity={0.8}
                        style={styles.mainButtonContainer}
                    >
                        <LinearGradient
                            colors={['#0EA5E9', '#2563EB']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.submitBtn}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Text style={styles.submitText}>Publish Project</Text>
                                    <Ionicons name="rocket" size={20} color="#fff" />
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* --- CITY MODAL --- */}
            <Modal visible={showCityPicker} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalBar} />
                        <Text style={styles.modalTitle}>Choose City</Text>
                        <FlatList
                            data={CITIES}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.cityOption}
                                    onPress={() => { setCity(item); setShowCityPicker(false); }}
                                >
                                    <Text style={[styles.cityText, city === item && styles.citySelected]}>{item}</Text>
                                    {city === item && <Ionicons name="checkmark-circle" size={22} color="#0EA5E9" />}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    scrollContent: { paddingBottom: 40 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 24, paddingBottom: 20 },
    headerTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    backBtn: { width: 45, height: 45, borderRadius: 15, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },

    imagePickerContainer: { marginHorizontal: 24, height: 200, borderRadius: 28, marginBottom: 10 },
    previewImage: { width: '100%', height: '100%' },
    imageOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    glassBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
    editText: { color: '#fff', fontWeight: '700', marginLeft: 8 },

    placeholderWrapper: { flex: 1, borderRadius: 28, borderWidth: 2, borderColor: '#F1F5F9', borderStyle: 'dashed', overflow: 'hidden' },
    placeholderGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    iconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#0EA5E9', shadowOpacity: 0.1, shadowRadius: 10 },
    placeholderText: { marginTop: 12, fontSize: 15, fontWeight: '600', color: '#64748B' },

    formCard: { paddingHorizontal: 24, paddingTop: 20 },
    sectionTitle: { fontSize: 14, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 20 },
    inputGroup: { marginBottom: 24 },
    label: { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 10 },
    input: { backgroundColor: '#F8FAFC', height: 58, borderRadius: 18, paddingHorizontal: 20, fontSize: 16, color: '#0F172A', borderWidth: 1, borderColor: '#E2E8F0' },
    textArea: { height: 120, paddingTop: 18, textAlignVertical: 'top' },

    row: { flexDirection: 'row', marginBottom: 24 },
    flex1: { flex: 1 },
    selectBtn: { backgroundColor: '#F8FAFC', height: 58, borderRadius: 18, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#E2E8F0' },
    selectText: { fontSize: 16, color: '#0F172A', fontWeight: '600' },
    placeholderSelect: { fontSize: 16, color: '#94A3B8' },

    budgetContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', height: 58, borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', paddingRight: 20 },
    budgetInput: { flex: 1, paddingHorizontal: 20, fontSize: 18, color: '#0F172A', fontWeight: '700' },
    currency: { fontSize: 14, fontWeight: '800', color: '#0EA5E9' },

    mainButtonContainer: { marginTop: 10, shadowColor: "#2563EB", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 10 },
    submitBtn: { height: 62, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
    submitText: { color: '#fff', fontSize: 18, fontWeight: '800' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 24, height: '70%' },
    modalBar: { width: 40, height: 5, backgroundColor: '#E2E8F0', alignSelf: 'center', borderRadius: 10, marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 20, textAlign: 'center' },
    cityOption: { paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#F8FAFC', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cityText: { fontSize: 17, color: '#475569', fontWeight: '500' },
    citySelected: { color: '#0EA5E9', fontWeight: '800' }
});