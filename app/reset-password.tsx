import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordScreen() {
    const router = useRouter();
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [recoveryReady, setRecoveryReady] = useState(false);

    const handleDeepLink = useCallback(async (url?: string | null) => {
        if (!url) return;
        if (!url.includes('type=recovery')) return;

        try {
            setLoading(true);
            const { error } = await supabase.auth.exchangeCodeForSession(url);
            if (error) throw error;
            setRecoveryReady(true);
        } catch (err: any) {
            Alert.alert('Link Error', err.message || 'Could not restore session from reset link.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        Linking.getInitialURL().then(initial => handleDeepLink(initial));
        const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
        return () => sub.remove();
    }, [handleDeepLink]);

    const handleReset = async () => {
        if (!newPassword || newPassword.length < 6) {
            Alert.alert('Password too short', 'Please choose at least 6 characters.');
            return;
        }
        setLoading(true);
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        setLoading(false);

        if (error) {
            Alert.alert('Reset failed', error.message);
            return;
        }

        Alert.alert('Success', 'Password updated. Please log in again.', [
            { text: 'OK', onPress: async () => { await supabase.auth.signOut(); router.replace('/login'); } }
        ]);
    };

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.card}>
                <View style={styles.iconWrap}>
                    <Ionicons name="lock-closed-outline" size={28} color="#0EA5E9" />
                </View>
                <Text style={styles.title}>Reset Password</Text>
                <Text style={styles.subtitle}>
                    Open the reset link from your email on this device. We will capture the deep link and let you set a new password.
                </Text>

                <View style={styles.statusRow}>
                    <View style={[styles.dot, recoveryReady ? styles.dotReady : styles.dotWaiting]} />
                    <Text style={styles.statusText}>
                        {recoveryReady ? 'Link detected. Enter a new password.' : 'Waiting for Supabase recovery link...'}
                    </Text>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>New Password</Text>
                    <View style={styles.inputWrapper}>
                        <Ionicons name="key-outline" size={18} color="#94A3B8" />
                        <TextInput
                            style={styles.input}
                            placeholder="••••••••"
                            placeholderTextColor="#94A3B8"
                            secureTextEntry
                            value={newPassword}
                            onChangeText={setNewPassword}
                            editable={recoveryReady}
                        />
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.button, !recoveryReady && { opacity: 0.6 }]}
                    onPress={handleReset}
                    disabled={!recoveryReady || loading}
                >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save & Sign In</Text>}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.replace('/login')} style={styles.backLink}>
                    <Text style={styles.backText}>Back to Log In</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', padding: 20 },
    card: { backgroundColor: '#fff', padding: 24, borderRadius: 20, width: '100%', gap: 14 },
    iconWrap: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
    subtitle: { color: '#475569', fontSize: 14, lineHeight: 20 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
    dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#CBD5E1' },
    dotWaiting: { backgroundColor: '#F59E0B' },
    dotReady: { backgroundColor: '#22C55E' },
    statusText: { color: '#0F172A', fontWeight: '700', fontSize: 13 },
    inputGroup: { gap: 8 },
    label: { color: '#0F172A', fontWeight: '700', fontSize: 13 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    input: { flex: 1, color: '#0F172A', fontSize: 16 },
    button: { marginTop: 6, backgroundColor: '#0EA5E9', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
    buttonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
    backLink: { alignItems: 'center', paddingVertical: 6 },
    backText: { color: '#0EA5E9', fontWeight: '700' }
});
