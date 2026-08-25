import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';
import { uploadKycDocument } from '@/lib/storage';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PremiumHeader from '@/components/PremiumHeader';
import { providerMenuItems } from '@/constants/premiumMenus';
import {
  FLOATING_TAB_BAR_HEIGHT,
  PREMIUM_BG,
  PREMIUM_GOLD,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/constants/layout';
import { successFeedback } from '@/utils/haptics';
import { getAndClearVerificationScanResult } from '@/utils/verificationScanResult';

export default function VerificationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('unverified');

  useEffect(() => {
    checkStatus();
  }, [user]);

  useFocusEffect(
    React.useCallback(() => {
      const result = getAndClearVerificationScanResult();
      if (!result) return;
      (async () => {
        try {
          const manip = await ImageManipulator.manipulateAsync(
            result.uri,
            [{ resize: { width: 800 } }],
            { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG },
          );
          if (result.type === 'front') setFrontImage(manip.uri);
          if (result.type === 'back') setBackImage(manip.uri);
          successFeedback();
        } catch {
          if (result.type === 'front') setFrontImage(result.uri);
          if (result.type === 'back') setBackImage(result.uri);
        }
      })();
    }, []),
  );

  const checkStatus = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('verification_status')
      .eq('id', user.id)
      .single();
    if (data) setStatus(data.verification_status);
  };

  const pickImage = async (type: 'front' | 'back' | 'selfie') => {
    const { status: perm } = await ImagePicker.requestCameraPermissionsAsync();
    if (perm !== 'granted') {
      Alert.alert(t('error'), t('permissionCamera'));
      return;
    }

    let result;
    if (type === 'selfie') {
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });
    }

    if (!result.canceled) {
      const manipResult = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 800 } }],
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG },
      );
      successFeedback();
      if (type === 'front') setFrontImage(manipResult.uri);
      if (type === 'back') setBackImage(manipResult.uri);
      if (type === 'selfie') setSelfie(manipResult.uri);
    }
  };

  const handleSubmit = async () => {
    if (!frontImage || !backImage || !selfie) {
      Alert.alert(t('missingDocuments'), t('provideAll3Photos'));
      return;
    }

    setUploading(true);
    try {
      const timestamp = Date.now();
      const userId = user?.id;
      if (!userId) throw new Error('Not signed in');

      const frontPath = `${userId}/front_${timestamp}.jpg`;
      const backPath = `${userId}/back_${timestamp}.jpg`;
      const selfiePath = `${userId}/selfie_${timestamp}.jpg`;

      await uploadKycDocument(frontImage, userId, `front_${timestamp}.jpg`);
      await uploadKycDocument(backImage, userId, `back_${timestamp}.jpg`);
      await uploadKycDocument(selfie, userId, `selfie_${timestamp}.jpg`);

      const now = new Date().toISOString();
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          verification_status: 'pending',
          verification_submitted_at: now,
          verification_document_paths: {
            front: frontPath,
            back: backPath,
            selfie: selfiePath,
          },
        })
        .eq('id', userId);

      if (profileError) throw profileError;

      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'verification',
        title: t('verificationSubmitted') || 'Verification submitted',
        message:
          t('verificationSubmittedMessage') || "We'll review your documents shortly.",
        is_read: false,
      });

      setStatus('pending');
      successFeedback();
      Alert.alert(t('success'), 'Documents submitted! Returning to profile.');
      setTimeout(() => router.push('/provider/profile'), 1200);
    } catch (error: any) {
      Alert.alert(t('error'), error.message || t('couldNotSavePhoto'));
    } finally {
      setUploading(false);
    }
  };

  const renderUploadCard = (
    label: string,
    hint: string,
    image: string | null,
    onPress: () => void,
    scanType?: 'front' | 'back',
  ) => (
    <TouchableOpacity style={styles.uploadCard} onPress={onPress} activeOpacity={0.9}>
      <BlurView intensity={36} tint="dark" style={styles.uploadBlur}>
        {image ? (
          <Image source={{ uri: image }} style={styles.previewImage} />
        ) : (
          <View style={styles.placeholder}>
            <View style={styles.iconBg}>
              <Ionicons
                name={scanType ? 'id-card-outline' : 'person'}
                size={26}
                color={PREMIUM_GOLD}
              />
            </View>
            <Text style={styles.cardLabel}>{label}</Text>
            <Text style={styles.cardHint}>{hint}</Text>
            {scanType ? (
              <TouchableOpacity
                style={styles.scanLink}
                onPress={() => {
                  successFeedback();
                  router.push(`/provider/verification-scan?type=${scanType}`);
                }}
              >
                <Ionicons name="scan-outline" size={14} color={PREMIUM_GOLD} />
                <Text style={styles.scanLinkText}>
                  {t('scanWithCamera') || 'Scan with camera'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
        {image ? (
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark" size={14} color="#0A0F1A" />
          </View>
        ) : null}
      </BlurView>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <PremiumHeader
        title={t('verifyTitle')}
        subtitle={t('verifySub')}
        showBack
        fallbackRoute="/provider/profile"
        menuItems={providerMenuItems(router, t)}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + 88,
            paddingBottom: FLOATING_TAB_BAR_HEIGHT + 40,
            paddingHorizontal: 20,
          },
        ]}
      >
        {status === 'verified' ? (
          <View style={styles.stateBox}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(52,211,153,0.15)' }]}>
              <Ionicons name="checkmark-circle" size={72} color="#34D399" />
            </View>
            <Text style={styles.stateTitle}>{t('verified')}</Text>
            <Text style={styles.stateText}>{t('identityConfirmed')}</Text>
          </View>
        ) : status === 'pending' ? (
          <View style={styles.stateBox}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(212,175,55,0.15)' }]}>
              <Ionicons name="hourglass" size={56} color={PREMIUM_GOLD} />
            </View>
            <Text style={styles.stateTitle}>{t('statusPending') || 'Pending'}</Text>
            <Text style={styles.stateText}>
              {t('reviewingDocuments') || 'We are reviewing your documents.'}
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.intro}>
              {t('verifyIntro') ||
                'Upload a clear ID and selfie. Documents stay encrypted and are only used for verification.'}
            </Text>

            {renderUploadCard(
              t('idFront') || 'ID Front',
              t('tapToUpload') || 'Tap to upload',
              frontImage,
              () => pickImage('front'),
              'front',
            )}
            {renderUploadCard(
              t('idBack') || 'ID Back',
              t('tapToUpload') || 'Tap to upload',
              backImage,
              () => pickImage('back'),
              'back',
            )}
            {renderUploadCard(
              t('selfie') || 'Selfie',
              t('tapToTakePhoto') || 'Tap to take photo',
              selfie,
              () => pickImage('selfie'),
            )}

            <View style={styles.infoBox}>
              <Ionicons name="lock-closed" size={16} color={PREMIUM_GOLD} />
              <Text style={styles.infoText}>
                {t('docsEncrypted') ||
                  'Documents are encrypted. Only used for verification.'}
              </Text>
            </View>

            {(!frontImage || !backImage || !selfie) && (
              <Text style={styles.addAllHint}>
                {t('addAllThreeToSubmit') ||
                  'Add all three photos above to submit for verification.'}
              </Text>
            )}
            <View style={{ height: 120 }} />
          </>
        )}
      </ScrollView>

      {status === 'unverified' && frontImage && backImage && selfie ? (
        <BlurView intensity={70} tint="dark" style={styles.footer}>
          <Text style={styles.footerHint}>
            {t('adminWillVerify') || 'An admin will verify your documents.'}
          </Text>
          <TouchableOpacity
            style={[styles.submitBtn, uploading && styles.disabledBtn]}
            onPress={handleSubmit}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#0A0F1A" />
            ) : (
              <Text style={styles.submitText}>
                {t('submitForAdminVerify') || 'Submit for admin verification'}
              </Text>
            )}
          </TouchableOpacity>
        </BlurView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PREMIUM_BG },
  scroll: { paddingBottom: 24 },
  intro: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
  },
  uploadCard: {
    height: 168,
    borderRadius: 22,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  uploadBlur: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.75)',
  },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  iconBg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(212,175,55,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
  },
  cardLabel: { fontSize: 15, fontWeight: '800', color: TEXT_PRIMARY },
  cardHint: { fontSize: 12, color: TEXT_SECONDARY },
  scanLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  scanLinkText: { fontSize: 12, color: PREMIUM_GOLD, fontWeight: '700' },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  checkBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: PREMIUM_GOLD,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(212,175,55,0.1)',
    padding: 16,
    borderRadius: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.22)',
  },
  infoText: { flex: 1, fontSize: 12, color: TEXT_SECONDARY, fontWeight: '600' },
  addAllHint: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    marginTop: 16,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(10,15,26,0.92)',
  },
  footerHint: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 12,
  },
  submitBtn: {
    backgroundColor: PREMIUM_GOLD,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  disabledBtn: { opacity: 0.6 },
  submitText: { color: '#0A0F1A', fontWeight: '800', fontSize: 15 },
  stateBox: { alignItems: 'center', marginTop: 60, gap: 14, paddingHorizontal: 24 },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTitle: { fontSize: 22, fontWeight: '800', color: TEXT_PRIMARY },
  stateText: { textAlign: 'center', color: TEXT_SECONDARY, fontSize: 15, lineHeight: 22 },
});
