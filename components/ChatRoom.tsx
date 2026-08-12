import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { YStack, XStack, Text } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { lightFeedback, successFeedback } from '@/utils/haptics';
import { PREMIUM_GOLD } from '@/constants/layout';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import { useLanguage } from '@/context/LanguageContext';
import { BlurView } from 'expo-blur';
import {
  useProjectMessages,
  type ChatMessage,
} from '@/hooks/useProjectMessages';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';

const CHAT_HEADER_HEIGHT = 44;
const INPUT_MIN_HEIGHT = 42;
const INPUT_LINE_HEIGHT = 20;
const INPUT_MAX_LINES = 4;
const INPUT_MAX_HEIGHT = INPUT_MIN_HEIGHT + (INPUT_MAX_LINES - 1) * INPUT_LINE_HEIGHT;

type ChatRoomProps = {
  projectId: string;
  maxHeight?: number;
  readOnly?: boolean;
  bottomInset?: number;
  /** Extra offset when embedded under PremiumHeader (full-screen chat) */
  headerOffset?: number;
  /** Hide the built-in "Project Chat" strip when parent renders a richer header */
  hideInternalHeader?: boolean;
};

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function AudioBubble({ uri, isMine }: { uri: string; isMine: boolean }) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [positionSec, setPositionSec] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => undefined);
    };
  }, []);

  const togglePlayback = async () => {
    try {
      if (playing && soundRef.current) {
        await soundRef.current.pauseAsync();
        setPlaying(false);
        return;
      }

      setLoading(true);
      if (!soundRef.current) {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
        const { sound, status } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true },
          (playbackStatus) => {
            if (!playbackStatus.isLoaded) return;
            setPositionSec(Math.floor(playbackStatus.positionMillis / 1000));
            if (playbackStatus.durationMillis) {
              setDurationSec(Math.floor(playbackStatus.durationMillis / 1000));
            }
            if (playbackStatus.didJustFinish) {
              setPlaying(false);
              setPositionSec(0);
            }
          }
        );
        soundRef.current = sound;
        if (status.isLoaded && status.durationMillis) {
          setDurationSec(Math.floor(status.durationMillis / 1000));
        }
        setPlaying(true);
      } else {
        await soundRef.current.playAsync();
        setPlaying(true);
      }
      lightFeedback();
    } catch (e) {
      console.warn('Audio playback failed', e);
    } finally {
      setLoading(false);
    }
  };

  const elapsed = playing ? positionSec : 0;
  const progress = durationSec ? Math.min(100, (elapsed / durationSec) * 100) : 0;
  const iconColor = isMine ? '#0A0F1A' : '#E2E8F0';

  return (
    <XStack alignItems="center" gap={10} minWidth={140}>
      <Pressable onPress={togglePlayback} hitSlop={12}>
        {loading ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <Ionicons
            name={playing ? 'pause-circle' : 'play-circle'}
            size={32}
            color={iconColor}
          />
        )}
      </Pressable>
      <YStack flex={1} gap={4}>
        <XStack height={4} borderRadius={2} backgroundColor="rgba(148,163,184,0.35)" overflow="hidden">
          <XStack width={`${progress}%`} backgroundColor={isMine ? '#FDE68A' : '#94A3B8'} />
        </XStack>
        <Text fontSize={11} color={isMine ? 'rgba(10,15,26,0.75)' : 'rgba(248,250,252,0.85)'}>
          {formatDuration(durationSec || 0)}
        </Text>
      </YStack>
    </XStack>
  );
}

function MessageBubble({
  message,
  isMine,
  colors,
}: {
  message: ChatMessage;
  isMine: boolean;
  colors: ReturnType<typeof usePremiumColors>;
}) {
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const isAudio = !!message.audioUrl;
  const mineBg = colors.isDark ? colors.gold : colors.blue;
  const mineText = colors.isDark ? '#0A0F1A' : '#FFFFFF';

  return (
    <XStack
      justifyContent={isMine ? 'flex-end' : 'flex-start'}
      paddingHorizontal={12}
      marginBottom={10}
    >
      <YStack maxWidth="82%" alignItems={isMine ? 'flex-end' : 'flex-start'}>
        <YStack
          paddingHorizontal={14}
          paddingVertical={10}
          borderRadius={18}
          borderBottomRightRadius={isMine ? 2 : 18}
          borderBottomLeftRadius={isMine ? 18 : 2}
          backgroundColor={isMine ? mineBg : colors.bubbleOther}
          borderWidth={1}
          borderColor={isMine ? 'rgba(212,175,55,0.45)' : colors.border}
          style={styles.bubbleShadow}
        >
          {isAudio ? (
            <AudioBubble uri={message.audioUrl!} isMine={isMine} />
          ) : (
            <Text fontSize={15} lineHeight={20} color={isMine ? mineText : colors.bubbleOtherText}>
              {message.content}
            </Text>
          )}
        </YStack>
        <XStack alignItems="center" gap={4} marginTop={4}>
          <Text fontSize={10} color={colors.textSecondary}>
            {time}
          </Text>
          {isMine && (
            message.pending ? (
              <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
            ) : (
              <Ionicons name="checkmark-done" size={12} color="#34D399" />
            )
          )}
        </XStack>
      </YStack>
    </XStack>
  );
}

export default function ChatRoom({
  projectId,
  maxHeight = 420,
  readOnly = false,
  bottomInset,
  headerOffset = 0,
  hideInternalHeader = false,
}: ChatRoomProps) {
  const { user } = useAuth();
  const colors = usePremiumColors();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [text, setText] = useState('');
  const [inputHeight, setInputHeight] = useState(INPUT_MIN_HEIGHT);
  const [sending, setSending] = useState(false);

  const { messages, loading, error, sendMessage, sendAudioMessage } =
    useProjectMessages(projectId);
  const {
    isRecording,
    recordingDuration,
    uploading,
    startRecording,
    stopRecording,
    uploadVoiceNote,
  } = useVoiceRecorder(projectId);

  const keyboardVerticalOffset =
    Platform.OS === 'ios'
      ? insets.top + (hideInternalHeader ? 0 : CHAT_HEADER_HEIGHT) + headerOffset + 8
      : insets.top + headerOffset;

  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    scrollToBottom(true);
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => scrollToBottom(true)
    );
    return () => showSub.remove();
  }, [scrollToBottom]);

  const handleSendText = async () => {
    const trimmed = text.trim();
    if (!trimmed || !user?.id || sending) return;

    setText('');
    setInputHeight(INPUT_MIN_HEIGHT);
    setSending(true);

    const { error: sendError } = await sendMessage(user.id, trimmed);
    setSending(false);

    if (sendError) {
      setText(trimmed);
      return;
    }
    successFeedback();
    scrollToBottom(true);
  };

  const handleStopRecording = async () => {
    if (!user?.id || readOnly) return;
    const result = await stopRecording();
    if (!result?.uri) return;

    const publicUrl = await uploadVoiceNote(result.uri);
    if (!publicUrl) return;

    const { error: sendError } = await sendAudioMessage(user.id, publicUrl);
    if (!sendError) {
      successFeedback();
      scrollToBottom(true);
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const isMine = item.senderId === user?.id;
      return <MessageBubble message={item} isMine={isMine} colors={colors} />;
    },
    [user?.id, colors]
  );

  const showInput = !readOnly && !!user?.id;

  return (
    <KeyboardAvoidingView
      style={[
        styles.root,
        {
          height: maxHeight,
          backgroundColor: colors.bg,
          borderColor: colors.border,
        },
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <View style={styles.inner}>
        {!hideInternalHeader ? (
          <XStack
            paddingHorizontal={14}
            paddingVertical={10}
            backgroundColor={colors.glassStrong}
            borderBottomWidth={1}
            borderBottomColor={colors.border}
            alignItems="center"
            justifyContent="space-between"
            height={CHAT_HEADER_HEIGHT + 8}
          >
            <Text fontSize={15} fontWeight="700" color={colors.textPrimary}>
              {t('projectChatTitle')}
            </Text>
            <XStack alignItems="center" gap={6}>
              <YStack width={8} height={8} borderRadius={4} backgroundColor="#22C55E" />
              <Text fontSize={12} color={colors.textSecondary} fontWeight="600">
                Live
              </Text>
            </XStack>
          </XStack>
        ) : null}

        <View style={styles.listWrap}>
          {loading ? (
            <YStack flex={1} alignItems="center" justifyContent="center">
              <ActivityIndicator size="small" color={colors.gold} />
            </YStack>
          ) : error ? (
            <YStack flex={1} alignItems="center" justifyContent="center" padding={16}>
              <Text color={colors.textSecondary} textAlign="center">
                {error}
              </Text>
            </YStack>
          ) : messages.length === 0 ? (
            <YStack flex={1} alignItems="center" justifyContent="center" padding={16}>
              <Ionicons name="chatbubbles-outline" size={28} color={colors.textSecondary} />
              <Text color={colors.textSecondary} marginTop={8} textAlign="center">
                {t('noConversationsSub')}
              </Text>
            </YStack>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              onContentSizeChange={() => scrollToBottom(false)}
              onLayout={() => scrollToBottom(false)}
            />
          )}
        </View>

        {showInput && (
          <BlurView
            intensity={55}
            tint={colors.blurTint}
            style={[
              styles.inputBar,
              {
                paddingBottom: Math.max(10, Platform.OS === 'ios' ? insets.bottom * 0.25 : 10),
                backgroundColor: colors.glass,
                borderTopColor: colors.border,
              },
            ]}
          >
            <View style={styles.inputRow}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={t('typeMessage')}
                placeholderTextColor={colors.muted}
                multiline
                maxLength={2000}
                editable={!isRecording && !uploading}
                onSubmitEditing={handleSendText}
                blurOnSubmit={false}
                returnKeyType="default"
                textAlignVertical="center"
                onContentSizeChange={(e) => {
                  const next = Math.min(
                    INPUT_MAX_HEIGHT,
                    Math.max(INPUT_MIN_HEIGHT, e.nativeEvent.contentSize.height + 10)
                  );
                  setInputHeight(next);
                }}
                style={[
                  styles.textInput,
                  {
                    height: Math.max(INPUT_MIN_HEIGHT, inputHeight),
                    maxHeight: INPUT_MAX_HEIGHT,
                    color: colors.textPrimary,
                    backgroundColor: colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)',
                    borderColor: colors.border,
                  },
                ]}
              />

              <Pressable
                onPressIn={() => {
                  lightFeedback();
                  startRecording();
                }}
                onPressOut={handleStopRecording}
                disabled={uploading || sending}
                style={({ pressed }) => [
                  styles.iconBtn,
                  {
                    backgroundColor: colors.isDark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(15,23,42,0.06)',
                  },
                  isRecording && styles.iconBtnRecording,
                  pressed && { opacity: 0.85 },
                ]}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color={colors.textPrimary} />
                ) : (
                  <Ionicons
                    name={isRecording ? 'mic' : 'mic-outline'}
                    size={22}
                    color={isRecording ? '#FFFFFF' : colors.textPrimary}
                  />
                )}
              </Pressable>

              <Pressable
                onPress={handleSendText}
                disabled={!text.trim() || sending || isRecording || uploading}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.sendBtn,
                  {
                    backgroundColor: PREMIUM_GOLD,
                    opacity: !text.trim() || sending || isRecording || uploading ? 0.45 : pressed ? 0.88 : 1,
                  },
                ]}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#0A0F1A" />
                ) : (
                  <Ionicons name="send" size={18} color="#0A0F1A" />
                )}
              </Pressable>
            </View>

            {isRecording && (
              <XStack justifyContent="center" paddingTop={8} alignItems="center" gap={6}>
                <YStack width={8} height={8} borderRadius={4} backgroundColor="#EF4444" />
                <Text fontSize={12} color="#EF4444" fontWeight="600">
                  Recording {formatDuration(recordingDuration)}
                </Text>
              </XStack>
            )}
          </BlurView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
  },
  inner: {
    flex: 1,
  },
  listWrap: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 12,
    flexGrow: 1,
  },
  bubbleShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  inputBar: {
    borderTopWidth: 1,
    paddingHorizontal: 10,
    paddingTop: 10,
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    lineHeight: INPUT_LINE_HEIGHT,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtn: {
    width: 48,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnRecording: {
    backgroundColor: '#EF4444',
  },
});
