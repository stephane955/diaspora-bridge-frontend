import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import NavigationBar from '@/components/NavigationBar';
import { Ionicons } from '@expo/vector-icons';

export default function ChatScreen() {
    const { id } = useLocalSearchParams();
    const { user } = useAuth();
    const [messages, setMessages] = useState<any[]>([]);
    const [text, setText] = useState('');

    useEffect(() => {
        fetchMessages();
        const subscription = supabase.channel(`project_${id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'project_messages' },
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
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <NavigationBar title="Project Chat" showBack={true} />
            <FlatList
                inverted
                data={messages}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={{ padding: 20 }}
                renderItem={({ item }) => (
                    <View style={[styles.msg, item.sender_id === user?.id ? styles.myMsg : styles.theirMsg]}>
                        <Text style={[styles.msgText, item.sender_id === user?.id ? styles.myText : styles.theirText]}>{item.text}</Text>
                    </View>
                )}
            />
            <View style={styles.inputContainer}>
                <TextInput style={styles.input} placeholder="Type a message..." value={text} onChangeText={setText} />
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
    inputContainer: { flexDirection: 'row', padding: 15, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F1F5F9', alignItems: 'center', gap: 10, paddingBottom: 35 },
    input: { flex: 1, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 24, fontSize: 15 },
    sendBtn: { backgroundColor: '#0EA5E9', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' }
});