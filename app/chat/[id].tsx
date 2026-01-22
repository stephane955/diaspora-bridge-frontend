import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
    KeyboardAvoidingView, Platform, Image, Alert, ActivityIndicator, SafeAreaView
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Message, Project } from '@/types/models';

export default function ChatScreen() {
    const { id } = useLocalSearchParams(); // Project ID
    const { user } = useAuth();
    const { t } = useLanguage();
    const router = useRouter();

    const [messages, setMessages] = useState<Message[]>([]);
    const [text, setText] = useState('');
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [projectTitle, setProjectTitle] = useState('');

    const flatListRef = useRef<FlatList<Message>>(null);

    // 1. Load Initial Data
    useEffect(() => {
        const projectId = typeof id === 'string' ? id : id?.[0];
        if (!projectId) return;

        // Fetch Project Title
        supabase.from<Project>('projects').select('title').eq('id', projectId).single()
            .then(({ data }) => { if(data) setProjectTitle(data.title); });

        // Fetch History
        fetchMessages();

        // 2. Realtime Subscription
        const channel = supabase.channel(`chat:${projectId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages', filter: `project_id=eq.${projectId}` },
                (payload) => {
                    setMessages(prev => [payload.new as Message, ...prev]);
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [id]);

    const fetchMessages = async () => {
        const projectId = typeof id === 'string' ? id : id?.[0];
        if (!projectId) return;
        const { data } = await supabase
            .from<Message>('messages')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false }); // Newest first for inverted list

        if (data) setMessages(data);
        setLoading(false);
    };

    const sendMessage = async () => {
        if (!text.trim()) return;

        const messageContent = text.trim();
        setText(''); // Clear UI immediately

        const projectId = typeof id === 'string' ? id : id?.[0];
        if (!projectId) return;
        const { error } = await supabase.from<Message>('messages').insert({
            project_id: projectId,
            sender_id: user?.id,
            content: messageContent // Matches DB column 'content'
        });

        if (error) {
            Alert.alert("Error", "Failed to send message");
            console.error(error);
        }
    };

    const pickImage = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert(t('permissionNeededTitle'), "We need access to your photos to send images.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.5, // Optimize for chat speed
        });

        if (result.canceled) return;

        try {
            setUploading(true);
            const asset = result.assets[0];
            const ext = asset.uri.split('.').pop() || 'jpg';
            const projectId = typeof id === 'string' ? id : id?.[0];
            if (!projectId) return;
            const path = `${projectId}/${Date.now()}.${ext}`;

            // Upload
            const response = await fetch(asset.uri);
            const arrayBuffer = await response.arrayBuffer();
            const { error: uploadError } = await supabase.storage
                .from('chat-images')
                .upload(path, arrayBuffer, { contentType: asset.mimeType || 'image/jpeg' });

            if (uploadError) throw uploadError;

            // Get URL
            const { data: publicData } = supabase.storage.from('chat-images').getPublicUrl(path);

            // Send Message
            await supabase.from<Message>('messages').insert({
                project_id: projectId,
                sender_id: user?.id,
                content: '📷 Image', // Fallback text
                image_url: publicData.publicUrl
            });

        } catch (error) {
            const message = error instanceof Error ? error.message : "Upload failed.";
            Alert.alert("Upload Failed", message);
        } finally {
            setUploading(false);
        }
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const isMe = item.sender_id === user?.id;
        return (
            <View style={[styles.msgWrapper, isMe ? styles.myMsgWrapper : styles.theirMsgWrapper]}>

                {/* Image Bubble */}
                {!!item.image_url && (
                    <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble, { padding: 4 }]}>
                        <Image source={{ uri: item.image_url }} style={styles.msgImage} />
                    </View>
                )}

                {/* Text Bubble (only if not just an image, or if it has content) */}
                {(!item.image_url || (item.content && item.content !== '📷 Image')) && (
                    <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
                        <Text style={[styles.msgText, isMe ? styles.myText : styles.theirText]}>
                            {item.content}
                        </Text>
                    </View>
                )}

                {/* Timestamp */}
                <Text style={styles.timeText}>
                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <View style={{flex: 1, alignItems: 'center'}}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{projectTitle || 'Chat'}</Text>
                    <Text style={styles.headerSub}>{t('projectHubTitle') || 'Project Discussion'}</Text>
                </View>
                <TouchableOpacity style={styles.backBtn}>
                    <Ionicons name="ellipsis-horizontal" size={24} color="#0F172A" />
                </TouchableOpacity>
            </View>

            {/* Chat List */}
            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    inverted // Scroll from bottom
                    keyExtractor={item => item.id}
                    renderItem={renderMessage}
                    contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
                    keyboardShouldPersistTaps="handled"
                />
            )}

            {/* Input Area */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <View style={styles.inputContainer}>
                    <TouchableOpacity onPress={pickImage} disabled={uploading} style={styles.iconBtn}>
                        {uploading ? (
                            <ActivityIndicator size="small" color="#94A3B8" />
                        ) : (
                            <Ionicons name="camera-outline" size={24} color="#64748B" />
                        )}
                    </TouchableOpacity>

                    <TextInput
                        style={styles.input}
                        placeholder={t('typeMessage') || "Type a message..."}
                        placeholderTextColor="#94A3B8"
                        value={text}
                        onChangeText={setText}
                        multiline
                        maxLength={500}
                    />

                    <TouchableOpacity
                        style={[styles.sendBtn, !text.trim() && { backgroundColor: '#E2E8F0' }]}
                        onPress={sendMessage}
                        disabled={!text.trim()}
                    >
                        <Ionicons name="arrow-up" size={20} color={text.trim() ? "#fff" : "#94A3B8"} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingTop: Platform.OS === 'android' ? 40 : 10 },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', maxWidth: 200 },
    headerSub: { fontSize: 11, color: '#64748B' },

    msgWrapper: { marginBottom: 16, maxWidth: '80%' },
    myMsgWrapper: { alignSelf: 'flex-end', alignItems: 'flex-end' },
    theirMsgWrapper: { alignSelf: 'flex-start', alignItems: 'flex-start' },

    bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
    myBubble: { backgroundColor: '#0EA5E9', borderBottomRightRadius: 4 },
    theirBubble: { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 2, shadowOffset: {width:0, height:1} },

    msgText: { fontSize: 15, lineHeight: 22 },
    myText: { color: '#fff' },
    theirText: { color: '#0F172A' },

    msgImage: { width: 200, height: 150, borderRadius: 14, backgroundColor: '#E2E8F0' },

    timeText: { fontSize: 10, color: '#94A3B8', marginTop: 4, marginHorizontal: 4 },

    inputContainer: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F1F5F9', gap: 10 },
    input: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100, borderWidth: 1, borderColor: '#E2E8F0', color: '#0F172A' },
    iconBtn: { padding: 10, paddingBottom: 12 },
    sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0EA5E9', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
});
