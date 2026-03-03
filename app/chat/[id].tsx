import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { theme } from '@/constants/theme';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { lightFeedback } from '@/utils/haptics';
import { Message, Project } from '@/types/models';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type MessageRow = Message;

export default function ChatScreen() {
    const insets = useSafeAreaInsets();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { user } = useAuth();
    const { t } = useLanguage();
    const router = useRouter();

    const projectId = typeof id === 'string' ? id : id?.[0];
    const [messages, setMessages] = useState<MessageRow[]>([]);
    const [text, setText] = useState('');
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [projectTitle, setProjectTitle] = useState('Chat');

    const listRef = useRef<FlashList<MessageRow>>(null);

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

    useEffect(() => {
        if (!projectId) return;

        supabase
            .from<Project>('projects')
            .select('title')
            .eq('id', projectId)
            .single()
            .then(({ data }) => {
                if (data?.title) setProjectTitle(data.title);
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

        return () => {
            supabase.removeChannel(channel);
        };
    }, [projectId]);

    const sendMessage = async () => {
        const trimmed = text.trim();
        if (!trimmed || !projectId || !user?.id) return;

        setText('');
        lightFeedback();

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

    const handleBack = () => {
        lightFeedback();
        router.back();
    };

    const renderMessage = ({ item }: { item: MessageRow }) => {
        const isMe = item.sender_id === user?.id;
        return (
            <View style={[styles.msgWrapper, isMe ? styles.myMsgWrapper : styles.theirMsgWrapper]}>
                {!!item.image_url && (
                    <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble, styles.imageBubble]}>
                        <Image source={{ uri: item.image_url }} style={styles.msgImage} />
                    </View>
                )}
                {(!item.image_url || (item.content && item.content !== '📷 Image')) && (
                    <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
                        <Text style={[styles.msgText, isMe ? styles.myText : styles.theirText]}>
                            {item.content}
                        </Text>
                    </View>
                )}
                <Text style={styles.timeText}>
                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
        );
    };

    return (
        <View style={[styles.safe, { flex: 1, backgroundColor: theme.colors.primary, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                {/* Header — custom (layout has headerShown: false) */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.8}>
                        <Ionicons name="arrow-back" size={24} color={theme.colors.surface} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {projectTitle}
                    </Text>
                    <TouchableOpacity
                        onPress={pickImage}
                        disabled={uploading}
                        style={styles.headerAction}
                        activeOpacity={0.8}
                    >
                        {uploading ? (
                            <ActivityIndicator size="small" color={theme.colors.textSubtle} />
                        ) : (
                            <Ionicons name="camera-outline" size={22} color={theme.colors.surface} />
                        )}
                    </TouchableOpacity>
                </View>

                {/* Chat — Slate background */}
                <View style={styles.chatArea}>
                    {loading ? (
                        <View style={styles.loadingWrap}>
                            <ActivityIndicator size="large" color="#0EA5E9" />
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
                        />
                    )}
                </View>

                {/* Input */}
                <View style={styles.inputRow}>
                    <TextInput
                        style={styles.input}
                        placeholder={t('typeMessage') || 'Type a message...'}
                        placeholderTextColor="#94A3B8"
                        value={text}
                        onChangeText={setText}
                        multiline
                        maxLength={500}
                    />
                    <TouchableOpacity
                        style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
                        onPress={sendMessage}
                        onPressIn={() => text.trim() && lightFeedback()}
                        disabled={!text.trim()}
                        activeOpacity={0.8}
                    >
                        <Ionicons
                            name="arrow-up"
                            size={20}
                            color={text.trim() ? theme.colors.surface : theme.colors.textSubtle}
                        />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: '#0F172A',
    },
    keyboardView: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 14,
        paddingTop: Platform.OS === 'android' ? 14 : 10,
        backgroundColor: '#0F172A',
    },
    backBtn: {
        padding: 8,
        marginLeft: 4,
    },
    headerTitle: {
        flex: 1,
        fontSize: 17,
        fontWeight: '700',
        color: '#F8FAFC',
        textAlign: 'center',
        marginHorizontal: 8,
    },
    headerAction: {
        padding: 8,
        minWidth: 40,
        alignItems: 'flex-end',
    },
    chatArea: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    loadingWrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        paddingBottom: 24,
    },
    msgWrapper: {
        marginBottom: 14,
        maxWidth: '82%',
    },
    myMsgWrapper: {
        alignSelf: 'flex-end',
        alignItems: 'flex-end',
    },
    theirMsgWrapper: {
        alignSelf: 'flex-start',
        alignItems: 'flex-start',
    },
    bubble: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 18,
    },
    imageBubble: {
        padding: 4,
    },
    myBubble: {
        backgroundColor: '#0EA5E9',
        borderBottomRightRadius: 4,
    },
    theirBubble: {
        backgroundColor: '#FFFFFF',
        borderBottomLeftRadius: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    msgText: {
        fontSize: 15,
        lineHeight: 22,
    },
    myText: {
        color: '#FFFFFF',
    },
    theirText: {
        color: '#0F172A',
    },
    msgImage: {
        width: 200,
        height: 150,
        borderRadius: 14,
        backgroundColor: '#E2E8F0',
    },
    timeText: {
        fontSize: 10,
        color: '#94A3B8',
        marginTop: 4,
        marginHorizontal: 4,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 12,
        paddingVertical: 10,
        paddingBottom: Platform.OS === 'ios' ? 10 : 12,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
        gap: 10,
    },
    input: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 15,
        maxHeight: 100,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        color: '#0F172A',
    },
    sendBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#0EA5E9',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 2,
    },
    sendBtnDisabled: {
        backgroundColor: '#E2E8F0',
    },
});
