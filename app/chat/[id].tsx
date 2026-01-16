import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Image, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import NavigationBar from '@/components/NavigationBar';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/context/LanguageContext';

export default function ChatScreen() {
    const { id } = useLocalSearchParams();
    const { user } = useAuth();
    const { t } = useLanguage();
    const [messages, setMessages] = useState<any[]>([]);
    const [text, setText] = useState('');
    const [uploading, setUploading] = useState(false);
    const [otherTyping, setOtherTyping] = useState(false);
    const [presenceChannel, setPresenceChannel] = useState<any>(null);

    useEffect(() => {
        fetchMessages();
        const subscription = supabase.channel(`project_${id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'project_messages', filter: `project_id=eq.${id}` },
                payload => setMessages(prev => [payload.new, ...prev]))
            .subscribe();

        return () => { supabase.removeChannel(subscription); };
    }, [id]);

    const fetchMessages = async () => {
        const { data } = await supabase.from('project_messages').select('*').eq('project_id', id).order('created_at', { ascending: false });
        if (data) setMessages(data);
    };

    const sendMessage = async () => {
        if (!text.trim()) return;
        await supabase.from('project_messages').insert({ project_id: id, sender_id: user?.id, text });
        setText('');
        if (presenceChannel) {
            presenceChannel.track({ typing: false });
        }
    };

    const pickImage = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert(t('permissionNeededTitle'), t('photoAccessBody'));
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7
        });

        if (result.canceled) return;

        try {
            setUploading(true);
            const asset = result.assets[0];
            const ext = asset.uri.split('.').pop() || 'jpg';
            const path = `${id}/${user?.id || 'user'}-${Date.now()}.${ext}`;

            const response = await fetch(asset.uri);
            const arrayBuffer = await response.arrayBuffer();
            const { error: uploadError } = await supabase.storage
                .from('chat-images')
                .upload(path, arrayBuffer, { contentType: asset.mimeType || 'image/jpeg' });

            if (uploadError) throw uploadError;

            const { data: publicData } = supabase.storage.from('chat-images').getPublicUrl(path);

            await supabase.from('project_messages').insert({
                project_id: id,
                sender_id: user?.id,
                text: text.trim() || null,
                image_url: publicData.publicUrl
            });

            setText('');
        } catch (error: any) {
            Alert.alert(t('uploadFailedTitle'), error.message || t('uploadFailedBody'));
        } finally {
            setUploading(false);
        }
    };

    const handleTypingChange = (value: string) => {
        setText(value);
        const typingNow = value.trim().length > 0;
        if (presenceChannel?.state === 'joined') {
            presenceChannel.track({ typing: typingNow });
        }
    };

    useEffect(() => {
        const channel = supabase.channel(`chat-presence-${id}`, {
            config: { presence: { key: user?.id || 'anon' } }
        });

        channel.on('presence', { event: 'sync' }, () => {
            const state = channel.presenceState();
            const someoneTyping = Object.entries(state).some(([key, list]: any) => {
                if (key === user?.id) return false;
                return list.some((entry: any) => entry.typing);
            });
            setOtherTyping(someoneTyping);
        });

        channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                channel.track({ typing: false });
            }
        });

        setPresenceChannel(channel);

        return () => {
            supabase.removeChannel(channel);
        };
    }, [id, user?.id]);

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <NavigationBar title={t('projectChatTitle')} showBack={true} />
            <FlatList
                inverted
                data={messages}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={{ padding: 20 }}
                renderItem={({ item }) => (
                    <View style={[styles.msg, item.sender_id === user?.id ? styles.myMsg : styles.theirMsg]}>
                        {!!item.image_url && (
                            <Image source={{ uri: item.image_url }} style={styles.msgImage} />
                        )}
                        {!!item.text && (
                            <Text style={[styles.msgText, item.sender_id === user?.id ? styles.myText : styles.theirText]}>{item.text}</Text>
                        )}
                    </View>
                )}
            />
            {otherTyping && (
                <View style={styles.typingBanner}>
                    <Ionicons name="ellipse" size={8} color="#0EA5E9" />
                    <Text style={styles.typingText}>{t('providerTyping')}</Text>
                </View>
            )}
            <View style={styles.inputContainer}>
                <TouchableOpacity onPress={pickImage} disabled={uploading}>
                    <Ionicons name="camera" size={24} color={uploading ? '#94A3B8' : '#0EA5E9'} />
                </TouchableOpacity>
                <TextInput style={styles.input} placeholder={t('typeMessage')} value={text} onChangeText={handleTypingChange} />
                <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
                    <Ionicons name="send" size={20} color="#fff" />
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    msg: { maxWidth: '80%', padding: 12, borderRadius: 18, marginBottom: 10 },
    myMsg: { alignSelf: 'flex-end', backgroundColor: '#0EA5E9' },
    theirMsg: { alignSelf: 'flex-start', backgroundColor: '#F1F5F9' },
    msgText: { fontSize: 15 },
    myText: { color: '#fff' },
    theirText: { color: '#0F172A' },
    msgImage: { width: 180, height: 160, borderRadius: 14, marginBottom: 6, backgroundColor: '#0f172a10' },
    typingBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#E0F2FE' },
    typingText: { color: '#0EA5E9', fontWeight: '700', fontSize: 12 },
    inputContainer: { flexDirection: 'row', padding: 15, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F1F5F9', alignItems: 'center', gap: 10, paddingBottom: 35 },
    input: { flex: 1, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 24, fontSize: 15 },
    sendBtn: { backgroundColor: '#0EA5E9', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' }
});
