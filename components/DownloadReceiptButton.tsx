import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import {
  generateAndShareReceipt,
  type MilestoneReceiptData,
} from '@/utils/pdfReceipt';
import { PREMIUM_GOLD, TEXT_PRIMARY } from '@/constants/layout';
import { successFeedback } from '@/utils/haptics';
import { useLanguage } from '@/context/LanguageContext';

type Props = {
  data: MilestoneReceiptData;
  compact?: boolean;
};

export default function DownloadReceiptButton({ data, compact }: Props) {
  const [busy, setBusy] = useState(false);
  const { t } = useLanguage();

  const onPress = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await generateAndShareReceipt(data);
      successFeedback();
    } catch (e: any) {
      Alert.alert(t('errorTitle'), e?.message || t('uploadFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} disabled={busy}>
      <BlurView intensity={40} tint="dark" style={[styles.btn, compact && styles.compact]}>
        {busy ? (
          <ActivityIndicator color={PREMIUM_GOLD} />
        ) : (
          <>
            <Ionicons name="download-outline" size={16} color={PREMIUM_GOLD} />
            <Text style={styles.text}>{t('downloadReceipt')}</Text>
          </>
        )}
      </BlurView>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: 'rgba(212,175,55,0.1)',
  },
  compact: { paddingVertical: 10, marginTop: 8 },
  text: { color: TEXT_PRIMARY, fontWeight: '800', fontSize: 13 },
});
