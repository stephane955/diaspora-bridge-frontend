import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { theme } from '@/constants/theme';
import { successFeedback } from '@/utils/haptics';

export default function CollectionScannerScreen() {
    const { cartId } = useLocalSearchParams<{ cartId: string }>();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const [permission, requestPermission] = useCameraPermissions();
    const [scanning, setScanning] = useState(false);
    const scannedRef = useRef(false);

    const handleBarcodeScanned = useCallback(async ({ data }: { data: string }) => {
        if (scannedRef.current || !user?.id) return;
        scannedRef.current = true;
        setScanning(true);

        try {
            const scannedId = data?.trim?.();
            if (!scannedId) {
                Alert.alert('Invalid code', 'Could not read QR code.');
                return;
            }

            const { data: cart, error: fetchErr } = await supabase
                .from('project_material_carts')
                .select('id, supplier_id, status')
                .eq('id', scannedId)
                .single();

            if (fetchErr || !cart) {
                Alert.alert('Invalid cart', 'This QR code does not match a valid order.');
                return;
            }

            if (cart.supplier_id !== user.id) {
                Alert.alert('Wrong supplier', 'This order belongs to another supplier.');
                return;
            }

            if (cart.status !== 'approved') {
                Alert.alert('Not ready', 'This order is not approved for collection.');
                return;
            }

            const { error: updateErr } = await supabase
                .from('project_material_carts')
                .update({ status: 'collected', updated_at: new Date().toISOString() })
                .eq('id', scannedId);

            if (updateErr) throw updateErr;
            successFeedback();
            Alert.alert('Success', 'Collection verified!', [
                { text: 'OK', onPress: () => router.back() },
            ]);
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Could not verify collection.');
        } finally {
            setScanning(false);
            scannedRef.current = false;
        }
    }, [user?.id, router]);

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
                <Text style={styles.permissionText}>Camera access is needed to scan the collection QR code.</Text>
                <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
                    <Text style={styles.permissionBtnText}>Grant permission</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
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
                onBarcodeScanned={scanning ? undefined : handleBarcodeScanned}
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
                onPress={() => router.back()}
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
