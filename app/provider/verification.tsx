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
import PremiumHeader from '@/components/PremiumHeader';
import { providerMenuItems } from '@/constants/premiumMenus';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import { useScreenOffsets } from '@/hooks/useScreenOffsets';
import {
  ALPHA,
  GOLD,
  GOLD_BORDER,
  GOLD_TINT,
  SUCCESS,
  glow,
  icon as iconSize,
  radius,
  shadow,
  space,
  text,
  weight,
  withAlpha,
} from '@/constants/design';
import { successFeedback } from '@/utils/haptics';
import { getAndClearVerificationScanResult } from '@/utils/verificationScanResult';

export default function VerificationScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const c = usePremiumColors();
  const offsets = useScreenOffsets();

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
      <BlurView
        intensity={36}
        tint={c.blurTint}
        style={[styles.uploadBlur, { backgroundColor: c.surface }]}
      >
        {image ? (
          <Image source={{ uri: image }} style={styles.previewImage} />
        ) : (
          <View style={styles.placeholder}>
            <View style={styles.iconBg}>
              <Ionicons
                name={scanType ? 'id-card-outline' : 'person'}
                size={iconSize.lg}
                color={GOLD}
              />
            </View>
            <Text style={[styles.cardLabel, { color: c.textPrimary }]}>{label}</Text>
            <Text style={[styles.cardHint, { color: c.textSecondary }]}>{hint}</Text>
            {scanType ? (
              <TouchableOpacity
                style={styles.scanLink}
                onPress={() => {
                  successFeedback();
                  router.push(`/provider/verification-scan?type=${scanType}`);
                }}
              >
                <Ionicons name="scan-outline" size={iconSize.xs} color={GOLD} />
                <Text style={styles.scanLinkText}>
                  {t('scanWithCamera') || 'Scan with camera'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
        {image ? (
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark" size={iconSize.xs} color="#0A0F1A" />
          </View>
        ) : null}
      </BlurView>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <PremiumHeader
        title={t('verifyTitle')}
        subtitle={t('verifySub')}
        showBack
        fallbackRoute="/provider/profile"
        menuItems={providerMenuItems(router, t)}
      />

      <ScrollView contentContainerStyle={offsets.content}>
        {status === 'verified' ? (
          <View style={styles.stateBox}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: withAlpha(SUCCESS, ALPHA.medium) },
              ]}
            >
              <Ionicons name="checkmark-circle" size={72} color={SUCCESS} />
            </View>
            <Text style={[styles.stateTitle, { color: c.textPrimary }]}>{t('verified')}</Text>
            <Text style={[styles.stateText, { color: c.textSecondary }]}>
              {t('identityConfirmed')}
            </Text>
          </View>
        ) : status === 'pending' ? (
          <View style={styles.stateBox}>
            <View style={[styles.iconCircle, { backgroundColor: GOLD_TINT }]}>
              <Ionicons name="hourglass" size={56} color={GOLD} />
            </View>
            <Text style={[styles.stateTitle, { color: c.textPrimary }]}>
              {t('statusPending') || 'Pending'}
            </Text>
            <Text style={[styles.stateText, { color: c.textSecondary }]}>
              {t('reviewingDocuments') || 'We are reviewing your documents.'}
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.intro, { color: c.textSecondary }]}>
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
              <Ionicons name="lock-closed" size={iconSize.xs} color={GOLD} />
              <Text style={[styles.infoText, { color: c.textSecondary }]}>
                {t('docsEncrypted') ||
                  'Documents are encrypted. Only used for verification.'}
              </Text>
            </View>

            {(!frontImage || !backImage || !selfie) && (
              <Text style={[styles.addAllHint, { color: c.textSecondary }]}>
                {t('addAllThreeToSubmit') ||
                  'Add all three photos above to submit for verification.'}
              </Text>
            )}
            <View style={{ height: 120 }} />
          </>
        )}
      </ScrollView>

      {status === 'unverified' && frontImage && backImage && selfie ? (
        <BlurView
          intensity={70}
          tint={c.blurTint}
          style={[styles.footer, { backgroundColor: c.glass, borderTopColor: c.border }]}
        >
          <Text style={[styles.footerHint, { color: c.textSecondary }]}>
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
  container: { flex: 1 },
  intro: {
    ...text.footnote,
    lineHeight: 21,
    marginBottom: space.md,
  },
  uploadCard: {
    height: 168,
    borderRadius: radius.xl,
    marginBottom: space.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GOLD_BORDER,
  },
  uploadBlur: {
    flex: 1,
  },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xs },
  iconBg: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: GOLD_TINT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xxs,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
  },
  cardLabel: { ...text.footnote, fontWeight: weight.heavy },
  cardHint: text.caption,
  scanLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xxs,
    marginTop: space.xs,
  },
  scanLinkText: { ...text.caption, fontWeight: weight.heavy, color: GOLD },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  checkBadge: {
    position: 'absolute',
    top: space.sm,
    right: space.sm,
    backgroundColor: GOLD,
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: GOLD_TINT,
    padding: space.md,
    borderRadius: radius.lg,
    marginTop: space.xs,
    borderWidth: 1,
    borderColor: GOLD_BORDER,
  },
  infoText: { flex: 1, ...text.caption },
  addAllHint: {
    ...text.caption,
    textAlign: 'center',
    marginTop: space.md,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: space.lg,
    paddingTop: space.md,
    borderTopWidth: 1,
    ...shadow.floating,
  },
  footerHint: {
    ...text.caption,
    textAlign: 'center',
    marginBottom: space.sm,
  },
  submitBtn: {
    backgroundColor: GOLD,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    ...glow(GOLD),
  },
  disabledBtn: { opacity: 0.6 },
  submitText: { ...text.footnote, fontWeight: weight.heavy, color: '#0A0F1A' },
  stateBox: { alignItems: 'center', marginTop: 60, gap: space.md, paddingHorizontal: space.xl },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTitle: { ...text.title, fontWeight: weight.heavy },
  stateText: { textAlign: 'center', ...text.footnote, lineHeight: 22 },
});
