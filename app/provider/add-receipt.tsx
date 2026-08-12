import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
    ActivityIndicator, Image, ScrollView
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import PremiumHeader from '@/components/PremiumHeader';
import { providerMenuItems } from '@/constants/premiumMenus';
import { useLanguage } from '@/context/LanguageContext';
import { theme } from '@/constants/theme';
import { extractAmountFromReceiptImage } from '@/utils/receiptOcr';
import { uploadProjectMedia } from '@/lib/storage';
import { FLOATING_TAB_BAR_HEIGHT, PREMIUM_BG } from '@/constants/layout';

export default function AddReceiptScreen() {
    const insets = useSafeAreaInsets();
    const { projectId } = useLocalSearchParams<{ projectId: string }>();
    const router = useRouter();
    const { user } = useAuth();
    const { t } = useLanguage();
    const [receiptUri, setReceiptUri] = useState<string | null>(null);
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [uploading, setUploading] = useState(false);
    const [ocrLoading, setOcrLoading] = useState(false);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission', 'Camera roll access is needed to upload receipts.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });
        if (!result.canceled && result.assets[0]) {
            setReceiptUri(result.assets[0].uri);
            setAmount('');
            setOcrLoading(true);
            try {
                const extracted = await extractAmountFromReceiptImage(result.assets[0].uri);
                if (extracted != null) setAmount(String(extracted));
            } catch (_) {}
            setOcrLoading(false);
        }
    };

    const submit = async () => {
        const amt = parseInt(amount, 10);
        if (!receiptUri || !projectId || !user?.id || isNaN(amt) || amt <= 0) {
            Alert.alert('Missing info', 'Please add a receipt photo and enter the amount (CFA).');
            return;
        }
        setUploading(true);
        try {
            const receiptUrl = await uploadProjectMedia(
                receiptUri,
                projectId,
                `receipt_${user.id}_${Date.now()}.jpg`
            );

            const { error } = await supabase.from('project_expenses').insert({
                project_id: projectId,
                provider_id: user.id,
                amount: amt,
                description: description.trim() || 'Material receipt',
                type: 'material',
                receipt_url: receiptUrl,
                extracted_amount: amt,
                status: 'pending',
            });
            if (error) throw error;
            Alert.alert('Done', 'Receipt submitted. Client can approve it in the project Expenses tab.');
            router.back();
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Upload failed.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: PREMIUM_BG }]}>
            <PremiumHeader
                title={t('receipt')}
                subtitle={t('materialCartTitle')}
                showBack
                fallbackRoute="/provider/active"
                menuItems={providerMenuItems(router, t)}
            />
            <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 88, paddingBottom: FLOATING_TAB_BAR_HEIGHT + 40 }]}>
                <Text style={styles.hint}>Upload a hardware store receipt. Amount can be scanned or entered manually.</Text>
                <TouchableOpacity style={styles.uploadBox} onPress={pickImage}>
                    {receiptUri ? (
                        <Image source={{ uri: receiptUri }} style={styles.preview} />
                    ) : (
                        <>
                            <Ionicons name="receipt-outline" size={48} color={theme.colors.textMuted} />
                            <Text style={styles.uploadText}>Tap to select receipt photo</Text>
                        </>
                    )}
                </TouchableOpacity>
                {receiptUri && ocrLoading && <ActivityIndicator size="small" color={theme.colors.active} style={{ marginVertical: 8 }} />}
                <Text style={styles.label}>Amount (CFA)</Text>
                <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="e.g. 45000"
                />
                <Text style={styles.label}>Description (optional)</Text>
                <TextInput
                    style={styles.input}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="e.g. Cement, rods"
                />
                <TouchableOpacity style={[styles.btn, uploading && styles.btnDisabled]} onPress={submit} disabled={uploading}>
                    {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Submit receipt</Text>}
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { padding: theme.spacing.lg },
    hint: { fontSize: 14, color: theme.colors.textMuted, marginBottom: 16 },
    uploadBox: {
        height: 200,
        backgroundColor: theme.colors.surfaceAlt,
        borderRadius: theme.radii.lg,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        overflow: 'hidden',
    },
    preview: { width: '100%', height: '100%', resizeMode: 'cover' },
    uploadText: { marginTop: 8, fontSize: 14, color: theme.colors.textMuted },
    label: { fontWeight: '700', color: theme.colors.text, marginBottom: 6 },
    input: {
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radii.sm,
        padding: 14,
        fontSize: 16,
        marginBottom: 16,
        color: theme.colors.text,
    },
    btn: { backgroundColor: theme.colors.emerald, paddingVertical: 16, borderRadius: theme.radii.sm, alignItems: 'center' },
    btnDisabled: { opacity: 0.7 },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
