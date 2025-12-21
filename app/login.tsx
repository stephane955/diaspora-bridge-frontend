// app/login.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [role, setRole] = useState<'diaspora' | 'provider' | null>(null);

    const onLogin = async () => {
        if (!email || !password) return setError('Enter email and password to continue.');
        if (!role) return setError('Choose a role to tailor your dashboard.');

        await AsyncStorage.setItem('loggedIn', 'true');

        // send users straight into their workspace
        router.replace(role === 'diaspora' ? '/diaspora' : '/provider');
    };

    return (
        <SafeAreaView style={styles.screen}>
            <View style={styles.header}>
                <View style={styles.brandBadge}>
                    <Ionicons name="shield-checkmark" size={18} color="#fff" />
                </View>
                <View>
                    <Text style={styles.appTitle}>Diaspora Bridge</Text>
                    <Text style={styles.appSubtitle}>Secure entry to your projects</Text>
                </View>
            </View>

            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View>
                        <Text style={styles.title}>Welcome back</Text>
                        <Text style={styles.subtitle}>Bank-grade sign in with real-time updates</Text>
                    </View>
                    <Ionicons name="lock-closed" size={22} color="#0f172a" />
                </View>

                <Text style={styles.label}>Email</Text>
                <TextInput
                    style={styles.input}
                    placeholder="you@example.com"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholderTextColor="#9ca3af"
                />

                <Text style={styles.label}>Password</Text>
                <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    placeholderTextColor="#9ca3af"
                />

                <Text style={[styles.label, { marginTop: 14 }]}>I am signing in as</Text>
                <View style={styles.roleRow}>
                    <Pressable
                        style={[styles.roleCard, role === 'diaspora' && styles.roleCardActive]}
                        onPress={() => setRole('diaspora')}
                    >
                        <View style={styles.roleIconCircle}>
                            <Ionicons name="planet" size={18} color={role === 'diaspora' ? '#0f172a' : '#0f172a'} />
                        </View>
                        <Text style={styles.roleTitle}>Diaspora</Text>
                        <Text style={styles.roleMeta}>Fund & track builds</Text>
                    </Pressable>
                    <Pressable
                        style={[styles.roleCard, role === 'provider' && styles.roleCardActive]}
                        onPress={() => setRole('provider')}
                    >
                        <View style={[styles.roleIconCircle, { backgroundColor: '#e0f2f1' }]}>
                            <Ionicons name="construct" size={18} color="#0f172a" />
                        </View>
                        <Text style={styles.roleTitle}>Provider</Text>
                        <Text style={styles.roleMeta}>Deliver and report</Text>
                    </Pressable>
                </View>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <Pressable style={styles.button} onPress={onLogin}>
                    <Ionicons name="log-in" size={18} color="#fff" />
                    <Text style={styles.buttonText}>Enter dashboard</Text>
                </Pressable>

                <Pressable onPress={() => router.push('/signup')} style={styles.secondary}>
                    <Text style={styles.secondaryText}>New here? Create an account</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#f1f5f9', padding: 20 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, marginBottom: 18 },
    brandBadge: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
    appTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
    appSubtitle: { color: '#475569', fontSize: 13 },

    card: {
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 20,
        gap: 10,
        shadowColor: '#0f172a',
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 12 },
        shadowRadius: 20,
        elevation: 4,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    title: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
    subtitle: { color: '#6b7280', marginTop: 2 },
    label: { fontSize: 13, fontWeight: '600', color: '#0f172a', marginTop: 6 },
    input: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: '#f8fafc',
        fontSize: 15,
        color: '#0f172a',
    },
    roleRow: { flexDirection: 'row', gap: 12, marginTop: 6 },
    roleCard: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        padding: 12,
        backgroundColor: '#f8fafc',
        gap: 6,
    },
    roleCardActive: {
        borderColor: '#0f172a',
        backgroundColor: '#e2e8f0',
        shadowColor: '#0f172a',
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 16,
        elevation: 3,
    },
    roleIconCircle: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#e0f2fe', alignItems: 'center', justifyContent: 'center' },
    roleTitle: { fontWeight: '700', color: '#0f172a', fontSize: 15 },
    roleMeta: { color: '#475569', fontSize: 12 },
    button: {
        marginTop: 10,
        backgroundColor: '#0f172a',
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    secondary: { paddingVertical: 10, alignItems: 'center' },
    secondaryText: { color: '#0f172a', fontWeight: '600' },
    error: { color: '#dc2626', marginTop: 8, fontWeight: '600' },
});
