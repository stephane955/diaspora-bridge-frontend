import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { theme } from '@/constants/theme';
import { successFeedback } from '@/utils/haptics';
import { safeGoBack } from '@/utils/navigation';

type SignedCartQrPayload = {
    cart_id: string;
    supplier_id: string;
    iat: number;
    signature: string;
};

const QR_SIGNING_KEY = 'material_cart_qr_v1';
const QR_MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24h

function computeSignature(cartId: string, supplierId: string, iat: number) {
    const raw = `${cartId}|${supplierId}|${iat}|${QR_SIGNING_KEY}`;
    let hash = 5381;
    for (let i = 0; i < raw.length; i++) {
        hash = ((hash << 5) + hash) ^ raw.charCodeAt(i);
    }
    return Math.abs(hash).toString(36);
}

function parsePayload(raw: string): SignedCartQrPayload | null {
    try {
        const parsed = JSON.parse(raw);
        if (
            !parsed ||
            typeof parsed !== 'object' ||
            typeof parsed.cart_id !== 'string' ||
            typeof parsed.supplier_id !== 'string' ||
            typeof parsed.iat !== 'number' ||
            typeof parsed.signature !== 'string'
        ) {
            return null;
        }
        return parsed as SignedCartQrPayload;
    } catch {
        return null;
    }
}

export default function CollectionScannerScreen() {
    const { cartId } = useLocalSearchParams<{ cartId: string }>();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const { t } = useLanguage();
    const [permission, requestPermission] = useCameraPermissions();
    const [scanning, setScanning] = useState(false);
    const [uploadingProof, setUploadingProof] = useState(false);
    const scannedRef = useRef(false);

    const uploadCollectionPhoto = useCallback(
        async (cart: { id: string; project_id?: string; provider_id?: string | null }) => {
            setUploadingProof(true);
            try {
                const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
                if (!cameraPermission.granted) {
                    Alert.alert(
                        t('photoSkipped'),
                        t('permissionCamera')
                    );
                    return;
                }

                const result = await ImagePicker.launchCameraAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: true,
                    quality: 0.6,
                });

                if (result.canceled || !result.assets?.[0]?.uri) {
                    Alert.alert(t('photoSkipped'), t('noHandoverPhoto'));
                    return;
                }

                const asset = result.assets[0];
                const response = await fetch(asset.uri);
                const blob = await response.blob();
                const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
                const filePath = `${cart.project_id ?? 'unknown-project'}/${cart.id}/collection_${Date.now()}.${ext}`;

                const { error: uploadErr } = await supabase.storage
                    .from('site-updates')
                    .upload(filePath, blob, { upsert: false, contentType: asset.mimeType || 'image/jpeg' });
                if (uploadErr) throw uploadErr;

                const { data: publicData } = supabase.storage.from('site-updates').getPublicUrl(filePath);
                const imageUrl = publicData?.publicUrl;
                if (!imageUrl) throw new Error('Could not resolve uploaded image URL.');

                const { error: updateErr } = await supabase.from('project_updates').insert({
                    project_id: cart.project_id,
                    provider_id: cart.provider_id ?? null,
                    title: 'Materials collected',
                    description: `Supplier handover photo for cart ${cart.id}.`,
                    image_url: imageUrl,
                    update_type: 'material_collection',
                });
                if (updateErr) throw updateErr;
            } catch (e: any) {
                Alert.alert(
                    t('error'),
                    e?.message || t('couldNotSavePhoto')
                );
            } finally {
                setUploadingProof(false);
            }
        },
        [t]
    );

    const handleBarcodeScanned = useCallback(async ({ data }: { data: string }) => {
        if (scannedRef.current || !user?.id) return;
        scannedRef.current = true;
        setScanning(true);

        try {
            const rawQr = data?.trim?.();
            if (!rawQr) {
                Alert.alert(t('rejectedQr'), t('couldNotReadQr'));
                return;
            }

            const payload = parsePayload(rawQr);
            if (!payload) {
                Alert.alert(
                    t('rejectedQr'),
                    t('couldNotReadQr')
                );
                return;
            }

            if (!payload.signature) {
                Alert.alert(
                    t('rejectedQr'),
                    t('couldNotReadQr')
                );
                return;
            }

            const expectedSignature = computeSignature(payload.cart_id, payload.supplier_id, payload.iat);
            if (payload.signature !== expectedSignature) {
                Alert.alert(
                    t('rejectedQr'),
                    t('couldNotReadQr')
                );
                return;
            }

            const ageMs = Date.now() - payload.iat;
            if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > QR_MAX_AGE_MS) {
                Alert.alert(
                    t('rejectedQr'),
                    t('couldNotReadQr')
                );
                return;
            }

            if (payload.supplier_id !== user.id) {
                Alert.alert(
                    t('rejectedQr'),
                    t('qrOtherSupplier')
                );
                return;
            }

            if (cartId && payload.cart_id !== cartId) {
                Alert.alert(
                    t('rejectedQr'),
                    t('couldNotReadQr')
                );
                return;
            }

            const { data: cart, error: fetchErr } = await supabase
                .from('project_material_carts')
                .select('id, project_id, provider_id, supplier_id, status')
                .eq('id', payload.cart_id)
                .single();

            if (fetchErr || !cart) {
                Alert.alert(t('rejectedQr'), t('qrCartGone'));
                return;
            }

            if (cart.supplier_id !== user.id) {
                Alert.alert(t('rejectedQr'), t('qrOtherSupplier'));
                return;
            }

            if (cart.status === 'collected') {
                Alert.alert(
                    t('rejectedQr'),
                    t('qrNotApproved')
                );
                return;
            }

            if (cart.status !== 'approved') {
                Alert.alert(t('rejectedQr'), t('qrNotApproved'));
                return;
            }

            const { error: updateErr } = await supabase
                .from('project_material_carts')
                .update({ status: 'collected', updated_at: new Date().toISOString() })
                .eq('id', payload.cart_id);

            if (updateErr) throw updateErr;

            Alert.alert(
                t('success'),
                t('collectionVerified'),
                [
                    {
                        text: t('cancel'),
                        style: 'cancel',
                        onPress: () => {
                            successFeedback();
                            Alert.alert(t('success'), t('collectionVerified'), [{ text: t('ok'), onPress: () => safeGoBack(router, '/supplier/dashboard') }]);
                        },
                    },
                    {
                        text: t('ok'),
                        onPress: async () => {
                            await uploadCollectionPhoto(cart);
                            successFeedback();
                            Alert.alert(t('success'), t('collectionVerifiedTimeline'), [
                                { text: t('ok'), onPress: () => safeGoBack(router, '/supplier/dashboard') },
                            ]);
                        },
                    },
                ]
            );
        } catch (e: any) {
            Alert.alert(t('error'), e.message || t('couldNotVerifyCollection'));
        } finally {
            setScanning(false);
            scannedRef.current = false;
        }
    }, [user?.id, router, cartId, uploadCollectionPhoto, t]);

    if (!permission) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
        );
    }

    if (!permission.granted) {
        return (
            <View style={[styles.container, styles.center, { padding: 24 }]}>
                <Text style={styles.permissionText}>{t('permissionCamera')}</Text>
                <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
                    <Text style={styles.permissionBtnText}>Grant permission</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => safeGoBack(router, '/supplier/dashboard')}>
                    <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={scanning || uploadingProof ? undefined : handleBarcodeScanned}
            />
            <View style={[StyleSheet.absoluteFill, { paddingTop: insets.top + 16, paddingBottom: insets.bottom, paddingHorizontal: 20 }]} pointerEvents="none">
                <BlurView intensity={40} tint="dark" style={styles.overlay}>
                    <Text style={styles.overlayTitle}>Scan collection QR</Text>
                    <Text style={styles.overlaySub}>Point the camera at the QR code on the provider's screen</Text>
                    <View style={styles.frame} />
                </BlurView>
            </View>
            <TouchableOpacity
                style={[styles.closeBtn, { top: insets.top + 12 }]}
                onPress={() => safeGoBack(router, '/supplier/dashboard')}
            >
                <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    center: { justifyContent: 'center', alignItems: 'center' },
    permissionText: { fontSize: 16, color: theme.colors.text, textAlign: 'center', marginBottom: 24 },
    permissionBtn: { backgroundColor: theme.colors.active, paddingVertical: 14, paddingHorizontal: 28, borderRadius: theme.radii.md, marginBottom: 12 },
    permissionBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    cancelBtn: { padding: 12 },
    cancelBtnText: { color: theme.colors.textMuted, fontSize: 16 },
    overlay: { marginHorizontal: 24, marginTop: 40, padding: 20, borderRadius: theme.radii.lg, alignItems: 'center' },
    overlayTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
    overlaySub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
    frame: { width: 200, height: 200, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', borderRadius: 16, marginTop: 20 },
    closeBtn: { position: 'absolute', right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
});
