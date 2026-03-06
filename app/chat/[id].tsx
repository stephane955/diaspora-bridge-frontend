import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Image,
    Animated,
    ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { theme } from '@/constants/theme';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { lightFeedback, successFeedback, selectionFeedback } from '@/utils/haptics';
import { Message, Project } from '@/types/models';
import { getProjectAccessRole } from '@/utils/observers';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import PulseLoader from '@/components/PulseLoader';

type MessageRow = Message;

function ReadReceipt({ isRead }: { isRead: boolean }) {
    const pulse = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        if (!isRead) return;
        const anim = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1.15, duration: 800, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
            ])
        );
        anim.start();
        return () => anim.stop();
    }, [isRead, pulse]);
    return (
        <Animated.View style={{ marginLeft: 4, transform: [{ scale: pulse }] }}>
            <Ionicons
                name="checkmark-done"
                size={14}
                color={isRead ? theme.colors.emerald : theme.colors.active}
            />
        </Animated.View>
    );
}

export default function ChatScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { user } = useAuth();
    const { t, language: deviceLanguage } = useLanguage();

    const projectId = typeof id === 'string' ? id : id?.[0];
    const [messages, setMessages] = useState<MessageRow[]>([]);
    const [text, setText] = useState('');
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [project, setProject] = useState<{ title?: string; image_url?: string | null } | null>(null);
    const [recording, setRecording] = useState(false);
    const [recordingUri, setRecordingUri] = useState<string | null>(null);
    const [transcriptionPlaceholder, setTranscriptionPlaceholder] = useState<string | null>(null);
    const [isObserver, setIsObserver] = useState(false);
    const [translatingId, setTranslatingId] = useState<string | null>(null);
    const recordingRef = useRef<{ stopAndUnloadAsync: () => Promise<void>; getURI: () => string | null } | null>(null);
    const scrollThrottle = useRef<ReturnType<typeof setTimeout> | null>(null);

    const listRef = useRef<FlashList<MessageRow>>(null);

    useEffect(() => {
        if (!projectId || !user?.id) return;
        getProjectAccessRole(projectId, user.id).then((role) => setIsObserver(role === 'observer'));
    }, [projectId, user?.id]);

    const fetchMessages = useCallback(async () => {
        if (!projectId) return;
        const { data, error } = await supabase
            .from<MessageRow>('messages')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('fetchMessages:', error);
            setLoading(false);
            return;
        }
        setMessages(data ?? []);
        setLoading(false);
    }, [projectId]);

    const [hasDispute, setHasDispute] = useState(false);

    useEffect(() => {
        if (!projectId) return;

        supabase
            .from<Project>('projects')
            .select('title, image_url, dispute_milestone_id')
            .eq('id', projectId)
            .single()
            .then(({ data }) => {
                setProject(data ?? null);
                setHasDispute(!!(data as any)?.dispute_milestone_id);
            });

        fetchMessages();
    }, [projectId, fetchMessages]);

    useEffect(() => {
        if (!projectId) return;

        const channel = supabase
            .channel(`chat:${projectId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `project_id=eq.${projectId}`,
                },
                (payload: RealtimePostgresChangesPayload<MessageRow>) => {
                    const newRow = payload.new as MessageRow;
                    setMessages((prev) => [...prev, newRow]);
                }
            )
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [projectId]);

    const sendMessage = async () => {
        const trimmed = text.trim();
        if (!trimmed || !projectId || !user?.id) return;

        setText('');
        successFeedback();

        const { error } = await supabase.from<MessageRow>('messages').insert({
            project_id: projectId,
            sender_id: user.id,
            content: trimmed,
        });

        if (error) {
            console.error('sendMessage:', error);
            setText(trimmed);
        }
    };

    const pickImage = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) return;

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.5,
        });

        if (result.canceled) return;

        try {
            setUploading(true);
            lightFeedback();
            const asset = result.assets[0];
            const ext = asset.uri.split('.').pop() || 'jpg';
            if (!projectId || !user?.id) return;
            const path = `${projectId}/${Date.now()}.${ext}`;

            const response = await fetch(asset.uri);
            const arrayBuffer = await response.arrayBuffer();
            const { error: uploadError } = await supabase.storage
                .from('chat-images')
                .upload(path, arrayBuffer, { contentType: asset.mimeType || 'image/jpeg' });

            if (uploadError) throw uploadError;

            const { data: publicData } = supabase.storage.from('chat-images').getPublicUrl(path);

            await supabase.from<MessageRow>('messages').insert({
                project_id: projectId,
                sender_id: user.id,
                content: '📷 Image',
                image_url: publicData.publicUrl,
            });
        } catch (e) {
            console.error('Image upload:', e);
        } finally {
            setUploading(false);
        }
    };

    const handleScroll = useCallback(() => {
        if (scrollThrottle.current) return;
        scrollThrottle.current = setTimeout(() => {
            selectionFeedback();
            scrollThrottle.current = null;
        }, 400);
    }, []);

    const startRecording = async () => {
        try {
            const avModule = 'expo-' + 'av';
            const { Audio } = require(avModule) as typeof import('expo-av');
            await Audio.requestPermissionsAsync();
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });
            const { recording: rec } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            recordingRef.current = rec;
            setRecording(true);
            setTranscriptionPlaceholder(null);
        } catch (e) {
            console.warn('Start recording failed', e);
        }
    };

    const stopRecordingAndSend = async () => {
        const rec = recordingRef.current;
        if (!rec) return;
        setRecording(false);
        try {
            await rec.stopAndUnloadAsync();
            const uri = rec.getURI();
            recordingRef.current = null;
            if (!uri || !projectId || !user?.id) return;
            setRecordingUri(uri);
            setTranscriptionPlaceholder('Transcribing...');

            let audioUrl: string | null = null;
            try {
                const path = `${projectId}/voice_${Date.now()}.m4a`;
                const response = await fetch(uri);
                const blob = await response.blob();
                const { error: uploadErr } = await supabase.storage
                    .from('project_media')
                    .upload(path, blob, { contentType: 'audio/mp4' });
                if (!uploadErr) {
                    const { data: urlData } = supabase.storage.from('project_media').getPublicUrl(path);
                    audioUrl = urlData.publicUrl;
                }
            } catch (_) { /* upload optional */ }

            const { data: inserted, error } = await supabase.from('messages').insert({
                project_id: projectId,
                sender_id: user.id,
                content: '🎤 Voice note',
                ...(audioUrl && { audio_url: audioUrl }),
            }).select('id').single();

            if (error) throw error;
            successFeedback();
            setTranscriptionPlaceholder(null);
            setRecordingUri(null);

            if (inserted?.id && audioUrl) {
                try {
                    await supabase.functions.invoke('transcribe-voice', { body: { message_id: inserted.id } });
                } catch (_) { /* Edge Function may not be deployed */ }
            }
        } catch (e) {
            console.warn('Stop/send recording failed', e);
            setTranscriptionPlaceholder(null);
            setRecordingUri(null);
        }
    };

    const handleTranslate = async (messageId: string) => {
        setTranslatingId(messageId);
        try {
            await supabase.functions.invoke('translate-message', {
                body: { message_id: messageId, target_lang: deviceLanguage || 'en' },
            });
            fetchMessages();
        } catch (_) { /* Edge Function may not be deployed */ }
        setTranslatingId(null);
    };

    const displayText = (item: MessageRow) => {
        if (item.audio_url) {
            if (item.translation_text && item.translation_lang === deviceLanguage) return item.translation_text;
            return item.transcription_text || item.content;
        }
        return item.content;
    };

    const langNames: Record<string, string> = { en: 'English', fr: 'Français', es: 'Español', de: 'Deutsch', it: 'Italiano' };

    const renderMessage = ({ item, index }: { item: MessageRow; index: number }) => {
        const isMe = item.sender_id === user?.id;
        const time = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isRead = isMe && index < messages.length - 2;
        const isVoice = !!item.audio_url;
        const text = displayText(item);
        const showTranslate = isVoice && item.transcription_text && item.translation_lang !== deviceLanguage;

        return (
            <View style={[styles.msgWrapper, isMe ? styles.myMsgWrapper : styles.theirMsgWrapper]}>
                {!!item.image_url && (
                    <View style={[styles.imageBubble, isMe ? styles.myImageBubble : styles.theirImageBubble]}>
                        <Image source={{ uri: item.image_url }} style={styles.msgImage} />
                    </View>
                )}
                {(!item.image_url || (item.content && item.content !== '📷 Image')) && (
                    isMe ? (
                        <LinearGradient
                            colors={['#0EA5E9', '#6366F1']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[styles.bubble, styles.myBubble]}
                        >
                            {isVoice && <View style={styles.voiceIconRow}><Ionicons name="mic" size={14} color="rgba(255,255,255,0.9)" /><Text style={[styles.msgText, styles.myText]}> </Text></View>}
                            <Text style={[styles.msgText, styles.myText]}>{text}</Text>
                            {showTranslate && (
                                <TouchableOpacity style={styles.translateBtn} onPress={() => handleTranslate(item.id)} disabled={!!translatingId}>
                                    {translatingId === item.id ? <ActivityIndicator size="small" color="rgba(255,255,255,0.9)" /> : (
                                        <Text style={styles.translateBtnText}>Translate to {langNames[deviceLanguage] || deviceLanguage}</Text>
                                    )}
                                </TouchableOpacity>
                            )}
                        </LinearGradient>
                    ) : (
                        <View style={[styles.bubble, styles.theirBubble]}>
                            {isVoice && <View style={styles.voiceIconRow}><Ionicons name="mic" size={14} color={theme.colors.textMuted} /></View>}
                            <Text style={[styles.msgText, styles.theirText]}>{text}</Text>
                            {showTranslate && (
                                <TouchableOpacity style={styles.translateBtnThem} onPress={() => handleTranslate(item.id)} disabled={!!translatingId}>
                                    {translatingId === item.id ? <ActivityIndicator size="small" color={theme.colors.active} /> : (
                                        <Text style={styles.translateBtnTextThem}>Translate to {langNames[deviceLanguage] || deviceLanguage}</Text>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                    )
                )}
                <View style={[styles.metaRow, isMe && { justifyContent: 'flex-end' }]}>
                    <Text style={styles.timeText}>{time}</Text>
                    {isMe && <ReadReceipt isRead={isRead} />}
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.safe, { paddingBottom: insets.bottom }]}>
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={0}
            >
                {/* Contextual Header: BlurView + Project Title + Thumbnail */}
                <BlurView intensity={80} tint="dark" style={styles.headerBlur}>
                    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                        <TouchableOpacity onPress={() => { lightFeedback(); if (router.canGoBack()) router.back(); else router.replace('/'); }} style={styles.backBtn} activeOpacity={0.7}>
                            <View style={styles.iconCircle}>
                                <Ionicons name="chevron-back" size={22} color="#fff" />
                            </View>
                        </TouchableOpacity>
                        {project?.image_url && (
                            <Image source={{ uri: project.image_url }} style={styles.headerThumb} />
                        )}
                        <View style={styles.headerCenter}>
                            <Text style={styles.headerTitle} numberOfLines={1}>{project?.title ?? 'Chat'}</Text>
                            <View style={styles.onlineRow}>
                                <View style={[styles.liveDot, { backgroundColor: theme.colors.emerald }]} />
                                <Text style={styles.onlineText}>Online</Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={pickImage}
                            disabled={uploading}
                            style={styles.headerAction}
                            activeOpacity={0.7}
                        >
                            {uploading ? (
                                <PulseLoader size={24} color="#fff" />
                            ) : (
                                <Ionicons name="camera-outline" size={22} color="#fff" />
                            )}
                        </TouchableOpacity>
                    </View>
                </BlurView>

                {hasDispute && (
                    <View style={styles.arbitrationBanner}>
                        <Ionicons name="warning" size={18} color={theme.colors.warning} />
                        <Text style={styles.arbitrationBannerText}>Arbitration mode – dispute in progress. Moderator may join.</Text>
                    </View>
                )}

                {/* Chat Area */}
                <View style={styles.chatArea}>
                    {loading ? (
                        <View style={styles.loadingWrap}>
                            <PulseLoader size={48} color={theme.colors.active} />
                        </View>
                    ) : (
                        <FlashList
                            ref={listRef}
                            data={messages}
                            renderItem={renderMessage}
                            estimatedItemSize={72}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={styles.listContent}
                            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
                            keyboardShouldPersistTaps="handled"
                            onScroll={handleScroll}
                            scrollEventThrottle={400}
                            ListEmptyComponent={
                                <View style={styles.emptyChatWrap}>
                                    <Ionicons name="chatbubbles-outline" size={56} color={theme.colors.border} />
                                    <Text style={styles.emptyChatText}>Start the conversation!</Text>
                                    <Text style={styles.emptyChatSub}>Send a message to get things moving.</Text>
                                </View>
                            }
                        />
                    )}
                </View>

                {/* Floating Glassmorphic Input (hidden for observers) */}
                {isObserver ? (
                    <View style={[styles.observerBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                        <Ionicons name="eye-outline" size={18} color={theme.colors.textMuted} />
                        <Text style={styles.observerBarText}>View only – you cannot send messages</Text>
                    </View>
                ) : (
                    <BlurView intensity={60} tint="light" style={styles.inputBlur}>
                        {transcriptionPlaceholder ? (
                            <View style={styles.voicePlaceholder}>
                                <ActivityIndicator size="small" color={theme.colors.active} />
                                <Text style={styles.voicePlaceholderText}>{transcriptionPlaceholder}</Text>
                            </View>
                        ) : null}
                        <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                            <TouchableOpacity
                                style={styles.micBtn}
                                onPress={recording ? stopRecordingAndSend : startRecording}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name={recording ? 'stop-circle' : 'mic'}
                                    size={24}
                                    color={recording ? theme.colors.danger : theme.colors.textMuted}
                                />
                            </TouchableOpacity>
                            <TextInput
                                style={styles.input}
                                placeholder={t('typeMessage') || 'Type a message...'}
                                placeholderTextColor={theme.colors.textSubtle}
                                value={text}
                                onChangeText={setText}
                                multiline
                                maxLength={500}
                            />
                            <TouchableOpacity
                                style={[styles.sendBtn, !text.trim() && !recording && styles.sendBtnDisabled]}
                                onPress={text.trim() ? sendMessage : (recording ? stopRecordingAndSend : undefined)}
                                disabled={!text.trim() && !recording}
                                activeOpacity={0.7}
                            >
                                <LinearGradient
                                    colors={text.trim() || recording ? ['#0EA5E9', '#6366F1'] : [theme.colors.border, theme.colors.border]}
                                    style={styles.sendBtnGradient}
                                >
                                    <Ionicons
                                        name="arrow-up"
                                        size={20}
                                        color={text.trim() || recording ? '#fff' : theme.colors.textSubtle}
                                    />
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </BlurView>
                )}
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.colors.primary },
    keyboardView: { flex: 1, backgroundColor: theme.colors.background },

    headerBlur: {
        overflow: 'hidden',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: Platform.OS === 'android' ? theme.colors.primary : 'transparent',
    },
    backBtn: {},
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerThumb: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginLeft: 12,
    },
    headerCenter: { flex: 1, marginHorizontal: 12 },
    headerTitle: { fontSize: 17, ...theme.typography.title, color: '#fff' },
    onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    liveDot: { width: 6, height: 6, borderRadius: 3 },
    onlineText: { fontSize: 11, color: theme.colors.textSubtle },
    headerAction: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    chatArea: { flex: 1, backgroundColor: theme.colors.background },
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 24 },

    msgWrapper: { marginBottom: 12, maxWidth: '82%' },
    myMsgWrapper: { alignSelf: 'flex-end', alignItems: 'flex-end' },
    theirMsgWrapper: { alignSelf: 'flex-start', alignItems: 'flex-start' },

    bubble: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
    imageBubble: { borderRadius: theme.radii.md, overflow: 'hidden', ...theme.shadow.soft },
    myImageBubble: { borderBottomRightRadius: 4 },
    theirImageBubble: { borderBottomLeftRadius: 4 },
    myBubble: { borderBottomRightRadius: 4, ...theme.shadow.glow },
    theirBubble: {
        borderRadius: 20,
        borderBottomLeftRadius: 4,
        backgroundColor: 'rgba(241,245,249,0.95)',
        borderWidth: 1,
        borderColor: 'rgba(226,232,240,0.5)',
    },

    msgText: { fontSize: 15, lineHeight: 22 },
    myText: { color: '#FFFFFF' },
    theirText: { color: theme.colors.text },

    voiceIconRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
    translateBtn: { marginTop: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: theme.radii.sm, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)' },
    translateBtnText: { fontSize: 12, color: 'rgba(255,255,255,0.95)', fontWeight: '600' },
    translateBtnThem: { marginTop: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: theme.radii.sm, alignSelf: 'flex-start', backgroundColor: theme.colors.activeSoft + '30' },
    translateBtnTextThem: { fontSize: 12, color: theme.colors.active, fontWeight: '600' },

    msgImage: { width: 200, height: 150, borderRadius: theme.radii.md - 2, backgroundColor: theme.colors.border },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginHorizontal: 4 },
    timeText: { fontSize: 10, color: theme.colors.textSubtle },

    emptyChatWrap: { alignItems: 'center', paddingTop: 80, gap: 8 },
    emptyChatText: { fontSize: 18, ...theme.typography.title, color: theme.colors.text },
    emptyChatSub: { fontSize: 14, color: theme.colors.textMuted },

    observerBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: theme.colors.surfaceAlt,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.border,
    },
    observerBarText: { fontSize: 13, color: theme.colors.textMuted, fontWeight: '500' },
    arbitrationBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: theme.colors.warning + '20', borderBottomWidth: 1, borderBottomColor: theme.colors.warning + '40' },
    arbitrationBannerText: { flex: 1, fontSize: 12, fontWeight: '600', color: theme.colors.text },
    inputBlur: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.border,
    },
    voicePlaceholder: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingTop: 8,
    },
    voicePlaceholderText: {
        fontSize: 13,
        color: theme.colors.textMuted,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 12,
        paddingVertical: 10,
        paddingTop: 14,
        backgroundColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.92)' : 'transparent',
        gap: 10,
    },
    input: {
        flex: 1,
        backgroundColor: 'rgba(248,250,252,0.95)',
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 15,
        maxHeight: 100,
        borderWidth: 1,
        borderColor: 'rgba(226,232,240,0.8)',
        color: theme.colors.text,
    },
    micBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(248,250,252,0.95)',
        borderWidth: 1,
        borderColor: 'rgba(226,232,240,0.8)',
    },
    sendBtn: {},
    sendBtnGradient: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        ...theme.shadow.glow,
    },
    sendBtnDisabled: { opacity: 0.6 },
});
