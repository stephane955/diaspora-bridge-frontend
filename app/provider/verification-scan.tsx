import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { setVerificationScanResult } from '@/utils/verificationScanResult';
import { PREMIUM_GOLD, TEXT_PRIMARY, TEXT_SECONDARY } from '@/constants/layout';
import { successFeedback } from '@/utils/haptics';
import { useLanguage } from '@/context/LanguageContext';

export default function VerificationScanScreen() {
  const { type } = useLocalSearchParams<{ type: 'front' | 'back' }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const docType =
    type === 'front'
      ? t('idFront') || 'ID / Passport (front)'
      : t('idBack') || 'ID / Passport (back)';

  if (!permission) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={PREMIUM_GOLD} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.center, { padding: 24 }]}>
        <View style={styles.permIcon}>
          <Ionicons name="camera-outline" size={36} color={PREMIUM_GOLD} />
        </View>
        <Text style={styles.permissionText}>
          {t('cameraPermission') || 'Camera access is needed to scan your document.'}
        </Text>
        <TouchableOpacity
          style={styles.permissionBtn}
          onPress={() => {
            successFeedback();
            requestPermission();
          }}
        >
          <Text style={styles.permissionBtnText}>{t('grantPermission') || 'Grant permission'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelBtnText}>{t('cancel') || 'Cancel'}</Text>
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
        successFeedback();
        setVerificationScanResult({ type, uri: photo.uri });
        router.back();
      } else {
        Alert.alert(t('error'), t('couldNotSavePhoto'));
      }
    } catch (e: unknown) {
      Alert.alert(t('error'), e instanceof Error ? e.message : t('captureFailed'));
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

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.overlay, { paddingTop: insets.top + 72, paddingBottom: insets.bottom + 120 }]}>
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
      </View>

      <BlurView intensity={50} tint="dark" style={[styles.topBanner, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>{t('scanDocument') || 'Scan document'}</Text>
          <Text style={styles.bannerSub}>
            {t('alignInFrame') || 'Align'} {docType} {t('withinFrame') || 'within the gold frame'}
          </Text>
        </View>
      </BlurView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 28 }]}>
        <Text style={styles.footerHint}>
          {t('scanTip') || 'Hold steady · Good lighting · No glare'}
        </Text>
        <TouchableOpacity
          style={[styles.captureBtn, capturing && styles.captureBtnDisabled]}
          onPress={capture}
          disabled={!cameraReady || capturing}
        >
          {capturing ? (
            <ActivityIndicator color="#0A0F1A" />
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
  permIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(212,175,55,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  permissionText: {
    fontSize: 16,
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  permissionBtn: {
    backgroundColor: PREMIUM_GOLD,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    marginBottom: 12,
  },
  permissionBtnText: { color: '#0A0F1A', fontWeight: '800', fontSize: 16 },
  cancelBtn: { paddingVertical: 12 },
  cancelBtnText: { color: TEXT_SECONDARY, fontSize: 16 },

  overlay: { flex: 1 },
  edgeBand: { flex: 1, backgroundColor: 'rgba(10,15,26,0.62)' },
  middleRow: { flexDirection: 'row', flex: 2.2 },
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
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.55)',
    borderRadius: 12,
  },
  cornerGuide: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: PREMIUM_GOLD,
  },
  cornerTL: { top: '5%', left: '5%', borderLeftWidth: 4, borderTopWidth: 4 },
  cornerTR: {
    top: '5%',
    right: '5%',
    left: undefined,
    borderRightWidth: 4,
    borderTopWidth: 4,
  },
  cornerBL: {
    bottom: '5%',
    left: '5%',
    top: undefined,
    borderLeftWidth: 4,
    borderBottomWidth: 4,
  },
  cornerBR: {
    bottom: '5%',
    right: '5%',
    top: undefined,
    left: undefined,
    borderRightWidth: 4,
    borderBottomWidth: 4,
  },

  topBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: 'rgba(10,15,26,0.72)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.2)',
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: '800' },
  bannerSub: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 12,
  },
  footerHint: {
    color: 'rgba(248,250,252,0.9)',
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(10,15,26,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  captureBtn: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: 'rgba(212,175,55,0.25)',
    borderWidth: 3,
    borderColor: PREMIUM_GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtnDisabled: { opacity: 0.6 },
  captureBtnInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: PREMIUM_GOLD,
  },
});
