import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { theme } from '@/constants/theme';
import { safeGoBack } from '@/utils/navigation';
import { P00_MATERIAL_HANDOFF_UNAVAILABLE } from '@/constants/p00Security';
import {
    ALPHA,
    GOLD,
    ICON_BUTTON_SIZE,
    icon as iconSize,
    radius,
    space,
    text,
    withAlpha,
} from '@/constants/design';

type SignedCartQrPayload = {
    cart_id: string;
    supplier_id: string;
    iat: number;
    signature: string;
};

const QR_SIGNING_KEY = 'material_cart_qr_v1';

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
        async (
            cart: { id: string; project_id: string },
            authorId: string,
        ) => {
            setUploadingProof(true);
            try {
                const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
                if (!cameraPermission.granted) {
                    Alert.alert(t('photoSkipped'), t('permissionCamera'));
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
                const filePath = `${cart.project_id}/${cart.id}/collection_${Date.now()}.${ext}`;

                const { error: uploadErr } = await supabase.storage
                    .from('site-updates')
                    .upload(filePath, blob, { upsert: false, contentType: asset.mimeType || 'image/jpeg' });
                if (uploadErr) throw uploadErr;

                const { data: publicData } = supabase.storage.from('site-updates').getPublicUrl(filePath);
                const imageUrl = publicData?.publicUrl;
                if (!imageUrl) throw new Error('Could not resolve uploaded image URL.');

                const { error: updateErr } = await supabase.from('project_updates').insert({
                    project_id: cart.project_id,
                    author_id: authorId,
                    title: 'Materials collected',
                    body: `Supplier handover photo for cart ${cart.id}.`,
                    photo_url: imageUrl,
                });
                if (updateErr) throw updateErr;
            } catch (e: unknown) {
                Alert.alert(
                    t('error'),
                    e instanceof Error ? e.message : t('couldNotSavePhoto'),
                );
            } finally {
                setUploadingProof(false);
            }
        },
        [t],
    );

    const handleBarcodeScanned = useCallback(
        async ({ data }: { data: string }) => {
            if (scannedRef.current || !user?.id) return;
            // Material handoff scan path intentionally disabled (P00).
            Alert.alert(t('error'), P00_MATERIAL_HANDOFF_UNAVAILABLE);
            void data;
            void cartId;
            void computeSignature;
            void parsePayload;
            void uploadCollectionPhoto;
            void scanning;
        },
        [t, user?.id, cartId, uploadCollectionPhoto, scanning],
    );

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
            <BlurView
                intensity={55}
                tint="dark"
                style={[styles.topBanner, { paddingTop: insets.top + space.xxs }]}
            >
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => safeGoBack(router, '/supplier/dashboard')}
                    hitSlop={12}
                >
                    <ChevronLeft size={iconSize.md} color="#F8FAFC" strokeWidth={2.5} />
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={styles.bannerTitle}>{t('scanCollection') || 'Scan collection QR'}</Text>
                    <Text style={styles.bannerSub}>{t('pointAtQr') || "Point at the QR on the provider's screen"}</Text>
                </View>
                <View style={styles.backBtn} />
                <View style={styles.accentLine} />
            </BlurView>
            <View style={styles.frameWrap} pointerEvents="none">
                <View style={styles.frame} />
            </View>
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
    topBanner: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingHorizontal: space.md,
        paddingTop: space.xxs,
        paddingBottom: space.sm,
        backgroundColor: 'rgba(10,15,26,0.72)',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        zIndex: 20,
    },
    backBtn: {
        width: ICON_BUTTON_SIZE,
        height: ICON_BUTTON_SIZE,
        borderRadius: radius.pill,
        backgroundColor: withAlpha('#FFFFFF', ALPHA.faint),
        alignItems: 'center',
        justifyContent: 'center',
    },
    bannerTitle: { color: '#F8FAFC', ...text.subtitle },
    bannerSub: { color: '#94A3B8', ...text.caption, marginTop: 2 },
    accentLine: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 2,
        opacity: 0.35,
        backgroundColor: GOLD,
    },
    frameWrap: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    frame: { width: 200, height: 200, borderWidth: 2, borderColor: GOLD, borderRadius: radius.lg },
});
