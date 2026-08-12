import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PREMIUM_BG, TEXT_PRIMARY, TEXT_SECONDARY } from '@/constants/layout';
import { mediumFeedback, successFeedback } from '@/utils/haptics';
import { useLanguage } from '@/context/LanguageContext';

const WARNING_RED = '#EF4444';

type Props = {
  visible: boolean;
  milestoneTitle?: string;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void> | void;
};

export default function OpenDisputeSheet({
  visible,
  milestoneTitle,
  loading,
  onClose,
  onSubmit,
}: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [reason, setReason] = useState('');

  const submit = async () => {
    const text = reason.trim();
    if (!text || loading) return;
    mediumFeedback();
    await onSubmit(text);
    setReason('');
    successFeedback();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}
      >
        <BlurView
          intensity={80}
          tint="dark"
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
        >
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Ionicons name="warning" size={22} color={WARNING_RED} />
            <Text style={styles.title}>{t('openDispute')}</Text>
          </View>
          <Text style={styles.sub}>
            {milestoneTitle
              ? `${milestoneTitle} — ${t('openDisputeSub')}`
              : t('openDisputeSub')}
          </Text>
          <TextInput
            style={styles.input}
            placeholder={t('openDisputePlaceholder')}
            placeholderTextColor="#64748B"
            multiline
            value={reason}
            onChangeText={setReason}
            textAlignVertical="top"
          />
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancel} onPress={onClose} disabled={!!loading}>
              <Text style={styles.cancelText}>{t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submit, (!reason.trim() || loading) && { opacity: 0.5 }]}
              onPress={submit}
              disabled={!reason.trim() || !!loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>{t('fileDispute')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </BlurView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: 'rgba(10,15,26,0.94)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(148,163,184,0.4)',
    marginBottom: 16,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  title: { color: TEXT_PRIMARY, fontSize: 20, fontWeight: '800' },
  sub: { color: TEXT_SECONDARY, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  input: {
    minHeight: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.28)',
    backgroundColor: 'rgba(15,23,42,0.8)',
    color: TEXT_PRIMARY,
    padding: 14,
    fontSize: 15,
    marginBottom: 16,
  },
  actions: { flexDirection: 'row', gap: 12 },
  cancel: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  cancelText: { color: TEXT_SECONDARY, fontWeight: '700', fontSize: 15 },
  submit: {
    flex: 1.4,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WARNING_RED,
  },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
