import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    Image, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import PremiumHeader from '@/components/PremiumHeader';
import { providerMenuItems } from '@/constants/premiumMenus';
import { useLanguage } from '@/context/LanguageContext';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import { useScreenOffsets } from '@/hooks/useScreenOffsets';
import {
    ALPHA,
    GOLD,
    font,
    glow,
    icon as iconSize,
    radius,
    space,
    text,
    weight,
    withAlpha,
} from '@/constants/design';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { enqueue } from '@/utils/offlineQueue';
import { requiredRouteParam } from '@/utils/routeParams';

export default function PostUpdateScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ projectId?: string | string[] }>();
    const projectId = requiredRouteParam(params.projectId);
    const { user } = useAuth();
    const { t } = useLanguage();
    const c = usePremiumColors();
    const offsets = useScreenOffsets();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    // 1. Pick Image
    const pickImage = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
            Alert.alert(t('permissionRequired'), t('permissionPhotos'));
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled) {
            const uri = result.assets[0].uri;
            const manipulated = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 800 } }],
                { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
            );
            setImage(manipulated.uri);
        }
    };

    // 2. Submit Update
    const handleSubmit = async () => {
        if (!title.trim()) return Alert.alert(t('missingTitle'), t('pleaseGiveUpdateTitle'));
        if (!description.trim()) return Alert.alert(t('missingDescription'), t('pleaseDescribeWork'));
        if (!user || !projectId) return;
        await submitUpdate();
    };

    const submitUpdate = async () => {
        if (!user || !projectId) return;
        setUploading(true);
        try {
            let photoUrl: string | null = null;
            if (image) {
                const { uploadProjectMedia } = await import('@/lib/storage');
                photoUrl = await uploadProjectMedia(image, projectId, `update_${user.id}_${Date.now()}.jpg`);
            }

            const { error } = await supabase.from('project_updates').insert({
                project_id: projectId,
                author_id: user.id,
                title: title,
                body: description,
                photo_url: photoUrl,
            });

            if (error) throw error;

            Alert.alert(t('success'), t('updatePostedSuccess'));
            router.back();

        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : t('somethingWentWrong');
            const isNetwork = /network|fetch|failed to fetch/i.test(message);
            if (isNetwork && user && projectId) {
                await enqueue({
                    type: 'project_update',
                    payload: {
                        project_id: projectId,
                        author_id: user.id,
                        title: title.trim(),
                        body: description.trim(),
                        photo_url: image ?? null,
                    },
                });
                Alert.alert(t('savedOffline'), t('updateWillSync'));
                router.back();
            } else {
                Alert.alert(t('error'), message);
            }
        } finally {
            setUploading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={[styles.container, { backgroundColor: c.bg }]}
        >
            <PremiumHeader
                title={t('postUpdateTitle')}
                subtitle={t('uploadProof')}
                showBack
                fallbackRoute="/provider/active"
                menuItems={providerMenuItems(router, t)}
            />
            <ScrollView contentContainerStyle={offsets.content}>

                {/* Image Section */}
                <Text style={[styles.label, { color: c.textPrimary }]}>Visual Proof</Text>
                <TouchableOpacity
                    style={[styles.imageBox, { backgroundColor: c.surface, borderColor: c.border }]}
                    onPress={pickImage}
                >
                    {image ? (
                        <>
                            <Image source={{ uri: image }} style={styles.previewImage} />
                            <View style={styles.editBadge}>
                                <Ionicons name="pencil" size={iconSize.xs} color="#fff" />
                            </View>
                        </>
                    ) : (
                        <View style={styles.placeholder}>
                            <Ionicons name="camera" size={iconSize.lg} color={c.muted} />
                            <Text style={[styles.placeholderText, { color: c.muted }]}>
                                Tap to upload photo
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>

                {/* Form Fields */}
                <Text style={[styles.label, { color: c.textPrimary }]}>Update Title</Text>
                <TextInput
                    style={[
                        styles.inputSingle,
                        { backgroundColor: c.surface, borderColor: c.border, color: c.textPrimary },
                    ]}
                    placeholder="e.g. Foundation Complete"
                    placeholderTextColor={c.muted}
                    value={title}
                    onChangeText={setTitle}
                />

                <Text style={[styles.label, { color: c.textPrimary }]}>{t('descriptionLabel')}</Text>
                <TextInput
                    style={[
                        styles.inputMulti,
                        { backgroundColor: c.surface, borderColor: c.border, color: c.textPrimary },
                    ]}
                    placeholder="Describe what was completed..."
                    placeholderTextColor={c.muted}
                    multiline
                    textAlignVertical="top"
                    value={description}
                    onChangeText={setDescription}
                />
            </ScrollView>

            <View
                style={[
                    styles.footer,
                    {
                        backgroundColor: c.surface,
                        borderTopColor: c.border,
                        paddingHorizontal: offsets.horizontal,
                        paddingBottom: offsets.bottom,
                    },
                ]}
            >
                <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={uploading}>
                    {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{t('postUpdateTitle')}</Text>}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },

    label: {
        ...text.footnote,
        fontWeight: weight.heavy,
        marginBottom: space.xs,
        marginTop: space.md,
    },

    imageBox: {
        width: '100%',
        height: 200,
        borderRadius: radius.xl,
        borderWidth: 2,
        borderStyle: 'dashed',
        overflow: 'hidden',
    },
    placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm },
    placeholderText: text.footnote,
    previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    editBadge: {
        position: 'absolute',
        bottom: space.sm,
        right: space.sm,
        backgroundColor: withAlpha('#000000', ALPHA.scrim),
        padding: space.xs,
        borderRadius: radius.pill,
    },

    inputSingle: {
        height: 56,
        borderRadius: radius.lg,
        paddingHorizontal: space.md,
        fontSize: font.body,
        fontWeight: weight.semibold,
        borderWidth: 1,
    },
    inputMulti: {
        height: 120,
        borderRadius: radius.lg,
        paddingHorizontal: space.md,
        paddingTop: space.md,
        fontSize: font.body,
        fontWeight: weight.semibold,
        borderWidth: 1,
    },

    footer: { paddingTop: space.lg, borderTopWidth: 1 },
    submitBtn: {
        backgroundColor: GOLD,
        height: 56,
        borderRadius: radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        ...glow(GOLD),
    },
    submitText: { ...text.body, fontWeight: weight.heavy, color: '#0A0F1A' },
});
