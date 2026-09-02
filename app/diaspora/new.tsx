import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView,
    Platform, Modal, FlatList, ImageBackground
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import PremiumHeader from '@/components/PremiumHeader';
import { clientMenuItems } from '@/constants/premiumMenus';
import { theme } from '@/constants/theme';
import { FLOATING_TAB_BAR_HEIGHT, PREMIUM_BG } from '@/constants/layout';

const CITIES = [
    "Douala", "Yaoundé", "Bamenda", "Bafoussam",
    "Garoua", "Maroua", "Ngaoundéré", "Kumba",
    "Buea", "Nkongsamba", "Limbe", "Kribi"
];

export default function NewProjectScreen() {
    const insets = useSafeAreaInsets();
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
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
        if (!user?.id) {
            Alert.alert(t('errorTitle'), t('somethingWentWrong'));
            return;
        }
        if (!title || !city || !budget || !description) {
            Alert.alert(t('missingFields'), t('missingFields'));
            return;
        }
        setLoading(true);
        try {
            const imageUrl = image || 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&q=80';
            const { error } = await supabase.from('projects').insert({
                owner_id: user.id,
                title, city,
                estimated_budget_minor: Math.trunc(parseFloat(budget) || 0),
                currency: 'XAF',
                description,
                image_url: imageUrl,
                status: 'pending',
            });
            if (error) throw error;
            Alert.alert(t('success'), t('profileSaved'));
            router.replace('/diaspora');
        } catch (err: unknown) {
            Alert.alert(t('errorTitle'), err instanceof Error ? err.message : t('somethingWentWrong'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.screen}
        >
            <PremiumHeader
                title={t('newProjectTitle')}
                subtitle={t('postProjectSub')}
                showBack
                fallbackRoute="/diaspora"
                menuItems={clientMenuItems(router, t)}
            />
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 88, paddingBottom: FLOATING_TAB_BAR_HEIGHT + 40, paddingHorizontal: theme.spacing.lg }]}
            >
                {/* --- IMAGE PICKER --- */}
                <TouchableOpacity onPress={pickImage} activeOpacity={0.9} style={styles.imagePickerContainer}>
                    {image ? (
                        <ImageBackground source={{ uri: image }} style={styles.previewImage} imageStyle={{ borderRadius: 28 }}>
                            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={styles.imageOverlay}>
                                <View style={styles.glassBadge}>
                                    <Ionicons name="camera" size={18} color="#fff" />
                                    <Text style={styles.editText}>{t('changeCover')}</Text>
                                </View>
                            </LinearGradient>
                        </ImageBackground>
                    ) : (
                        <View style={styles.placeholderWrapper}>
                            <LinearGradient colors={['#F8FAFC', '#F1F5F9']} style={styles.placeholderGradient}>
                                <View style={styles.iconCircle}>
                                    <Ionicons name="add" size={32} color={theme.colors.active} />
                                </View>
                                <Text style={styles.placeholderText}>{t('addProjectPhoto')}</Text>
                            </LinearGradient>
                        </View>
                    )}
                </TouchableOpacity>

                {/* --- FORM --- */}
                <View style={styles.formCard}>
                    <Text style={styles.sectionTitle}>{t('projectSpecs')}</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('project.title' as any) || "Project Title"}</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Modern Villa Design"
                            placeholderTextColor={theme.colors.textSubtle}
                            value={title}
                            onChangeText={setTitle}
                        />
                    </View>

                    <View style={styles.row}>
                        <View style={styles.flex1}>
                            <Text style={styles.label}>{t('project.city' as any) || "Location"}</Text>
                            <TouchableOpacity style={styles.selectBtn} onPress={() => setShowCityPicker(true)}>
                                <Text style={city ? styles.selectText : styles.placeholderSelect}>{city || t('selectCityPlaceholder')}</Text>
                                <Ionicons name="location" size={16} color={theme.colors.active} />
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
                            placeholderTextColor={theme.colors.textSubtle}
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
                        {loading ? (
                            <ActivityIndicator color={theme.colors.surface} />
                        ) : (
                            <Text style={styles.submitText}>{t('publishProject')}</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* --- CITY MODAL --- */}
            <Modal visible={showCityPicker} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalBar} />
                        <Text style={styles.modalTitle}>{t('chooseCity')}</Text>
                        <FlatList
                            data={CITIES}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.cityOption}
                                    onPress={() => { setCity(item); setShowCityPicker(false); }}
                                >
                                    <Text style={[styles.cityText, city === item && styles.citySelected]}>{item}</Text>
                                    {city === item && <Ionicons name="checkmark-circle" size={22} color={theme.colors.active} />}
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
    container: { flex: 1, backgroundColor: PREMIUM_BG },
    screen: { flex: 1, backgroundColor: PREMIUM_BG },
    scrollContent: {},

    imagePickerContainer: { height: 200, borderRadius: theme.radii.xl, marginBottom: theme.spacing.sm },
    previewImage: { width: '100%', height: '100%' },
    imageOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    glassBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.glass, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
    editText: { color: theme.colors.surface, fontWeight: '700', marginLeft: theme.spacing.sm },

    placeholderWrapper: { flex: 1, borderRadius: theme.radii.xl, borderWidth: 2, borderColor: theme.colors.border, borderStyle: 'dashed', overflow: 'hidden' },
    placeholderGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    iconCircle: { width: 56, height: 56, borderRadius: theme.radii.xl, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center', ...theme.shadow.soft },
    placeholderText: { marginTop: theme.spacing.sm, fontSize: 15, fontWeight: '600', color: theme.colors.textMuted },

    formCard: { paddingTop: theme.spacing.lg },
    sectionTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.textSubtle, textTransform: 'uppercase', letterSpacing: 1, marginBottom: theme.spacing.lg },
    inputGroup: { marginBottom: theme.spacing.xl },
    label: { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginBottom: theme.spacing.sm },
    input: { backgroundColor: theme.colors.background, height: 58, borderRadius: theme.radii.lg, paddingHorizontal: theme.spacing.lg, fontSize: 16, color: theme.colors.text, borderWidth: 1, borderColor: theme.colors.border },
    textArea: { height: 120, paddingTop: theme.spacing.lg, textAlignVertical: 'top' },

    row: { flexDirection: 'row', marginBottom: theme.spacing.xl },
    flex1: { flex: 1 },
    selectBtn: { backgroundColor: theme.colors.background, height: 58, borderRadius: theme.radii.lg, paddingHorizontal: theme.spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: theme.colors.border },
    selectText: { fontSize: 16, color: theme.colors.text, fontWeight: '600' },
    placeholderSelect: { fontSize: 16, color: theme.colors.textSubtle },

    budgetContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.background, height: 58, borderRadius: theme.radii.lg, borderWidth: 1, borderColor: theme.colors.border, paddingRight: theme.spacing.lg },
    budgetInput: { flex: 1, paddingHorizontal: theme.spacing.lg, fontSize: 18, color: theme.colors.text, fontWeight: '700' },
    currency: { fontSize: 14, fontWeight: '800', color: theme.colors.active },

    mainButtonContainer: { marginTop: theme.spacing.sm, height: 54, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', ...theme.shadow.soft },
    submitText: { color: theme.colors.surface, fontSize: 18, fontWeight: '800' },

    modalOverlay: { flex: 1, backgroundColor: theme.colors.glassDark, justifyContent: 'flex-end' },
    modalContent: { backgroundColor: theme.colors.surface, borderTopLeftRadius: theme.radii.xl, borderTopRightRadius: theme.radii.xl, padding: theme.spacing.xl, height: '70%' },
    modalBar: { width: 40, height: 5, backgroundColor: theme.colors.border, alignSelf: 'center', borderRadius: 10, marginBottom: theme.spacing.lg },
    modalTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text, marginBottom: theme.spacing.lg, textAlign: 'center' },
    cityOption: { paddingVertical: theme.spacing.lg, borderBottomWidth: 1, borderBottomColor: theme.colors.background, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cityText: { fontSize: 17, color: theme.colors.textMuted, fontWeight: '500' },
    citySelected: { color: theme.colors.active, fontWeight: '800' }
});