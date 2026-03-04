import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { setVerificationScanResult } from '@/utils/verificationScanResult';

export default function VerificationScanScreen() {
    const { type } = useLocalSearchParams<{ type: 'front' | 'back' }>();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [permission, requestPermission] = useCameraPermissions();
    const [cameraReady, setCameraReady] = useState(false);
    const [capturing, setCapturing] = useState(false);
    const cameraRef = useRef<CameraView>(null);

    const docType = type === 'front' ? 'ID / Passport (front)' : 'ID / Passport (back)';

    if (!permission) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#0F172A" />
            </View>
        );
    }

    if (!permission.granted) {
        return (
            <View style={[styles.container, styles.center, { padding: 24 }]}>
                <Text style={styles.permissionText}>Camera access is needed to scan your document.</Text>
                <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
                    <Text style={styles.permissionBtnText}>Grant permission</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const capture = async () => {
        if (!cameraRef.current || !cameraReady || capturing || !type) return;
        setCapturing(true);
        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.8,
                skipProcessing: false,
            });
            if (photo?.uri) {
                setVerificationScanResult({ type, uri: photo.uri });
                router.back();
            } else {
                Alert.alert('Error', 'Could not save photo.');
            }
        } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Capture failed.');
        } finally {
            setCapturing(false);
        }
    };

    return (
        <View style={styles.container}>
            <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing="back"
                onCameraReady={() => setCameraReady(true)}
            />
            {/* Scanning overlay: darkened edges + document frame with alignment guides */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <View style={[styles.overlay, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 100 }]}>
                    {/* Top band */}
                    <View style={styles.edgeBand} />
                    <View style={styles.middleRow}>
                        <View style={styles.edgeBand} />
                        <View style={styles.frameContainer}>
                            <View style={[styles.cornerGuide, styles.cornerTL]} />
                            <View style={[styles.cornerGuide, styles.cornerTR]} />
                            <View style={[styles.cornerGuide, styles.cornerBL]} />
                            <View style={[styles.cornerGuide, styles.cornerBR]} />
                            <View style={styles.frameInner} />
                        </View>
                        <View style={styles.edgeBand} />
                    </View>
                    <View style={styles.edgeBand} />
                </View>
                <Text style={[styles.hint, { top: insets.top + 12 }]}>
                    Align {docType} within the frame
                </Text>
            </View>

            {/* Back button */}
            <TouchableOpacity
                style={[styles.backBtn, { top: insets.top + 8 }]}
                onPress={() => router.back()}
            >
                <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>

            {/* Capture button */}
            <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
                <TouchableOpacity
                    style={[styles.captureBtn, capturing && styles.captureBtnDisabled]}
                    onPress={capture}
                    disabled={!cameraReady || capturing}
                >
                    {capturing ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <View style={styles.captureBtnInner} />
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    center: { justifyContent: 'center', alignItems: 'center' },
    permissionText: { fontSize: 16, color: '#fff', textAlign: 'center', marginBottom: 24 },
    permissionBtn: { backgroundColor: '#0EA5E9', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, marginBottom: 12 },
    permissionBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    cancelBtn: { paddingVertical: 12 },
    cancelBtnText: { color: 'rgba(255,255,255,0.8)', fontSize: 16 },

    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    edgeBand: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    middleRow: { flexDirection: 'row', flex: 2 },
    frameContainer: {
        flex: 1,
        maxWidth: 320,
        alignSelf: 'center',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    frameInner: {
        width: '90%',
        aspectRatio: 1.58,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.7)',
        borderRadius: 8,
    },
    cornerGuide: {
        position: 'absolute',
        width: 28,
        height: 28,
        borderColor: '#fff',
        borderRadius: 2,
    },
    cornerTL: { top: '5%', left: '5%', borderLeftWidth: 4, borderTopWidth: 4 },
    cornerTR: { top: '5%', right: '5%', left: undefined, borderRightWidth: 4, borderTopWidth: 4 },
    cornerBL: { bottom: '5%', left: '5%', top: undefined, borderLeftWidth: 4, borderBottomWidth: 4 },
    cornerBR: { bottom: '5%', right: '5%', top: undefined, left: undefined, borderRightWidth: 4, borderBottomWidth: 4 },
    hint: {
        position: 'absolute',
        left: 0,
        right: 0,
        textAlign: 'center',
        color: 'rgba(255,255,255,0.95)',
        fontSize: 15,
        fontWeight: '600',
    },
    backBtn: {
        position: 'absolute',
        left: 16,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    captureBtn: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderWidth: 4,
        borderColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    captureBtnDisabled: { opacity: 0.6 },
    captureBtnInner: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#fff',
    },
});
