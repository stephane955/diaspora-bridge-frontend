// app/signup.tsx
import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    StyleSheet,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
    ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

export default function SignupScreen() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [role, setRole] = useState<'client' | 'provider' | null>(null);
    const [focused, setFocused] = useState<string | null>(null);

    const onSignup = async () => {
        if (!name || !email || !password) return setError('Complete all fields to continue.');
        if (!role) return setError('Select your role so we can tailor onboarding.');

        await AsyncStorage.setItem('loggedIn', 'true');

        router.replace(role === 'client' ? '/diaspora' : '/provider');
    };

    return (
        <SafeAreaView style={styles.screen}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.header}>
                        <View style={styles.brandBadge}>
                            <Ionicons name="shield-checkmark" size={18} color="#fff" />
                        </View>
                        <View>
                            <Text style={styles.heroTitle}>Welcome to Diaspora Bridge</Text>
                            <Text style={styles.heroSubtitle}>Secure, transparent, premium builds</Text>
                        </View>
                    </View>

                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View>
                                <Text style={styles.title}>Create your account</Text>
                                <Text style={styles.subtitle}>American Express calm with construction grit</Text>
                            </View>
                            <Ionicons name="key" size={22} color="#001F3F" />
                        </View>

                        <Text style={styles.label}>Full name</Text>
                        <TextInput
                            style={[styles.input, focused === 'name' && styles.inputFocused]}
                            placeholder="Amaka N."
                            value={name}
                            onChangeText={setName}
                            placeholderTextColor="#8a8f9b"
                            onFocus={() => setFocused('name')}
                            onBlur={() => setFocused(null)}
                        />

                        <Text style={styles.label}>Email</Text>
                        <TextInput
                            style={[styles.input, focused === 'email' && styles.inputFocused]}
                            placeholder="you@example.com"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            placeholderTextColor="#8a8f9b"
                            onFocus={() => setFocused('email')}
                            onBlur={() => setFocused(null)}
                        />

                        <Text style={styles.label}>Password</Text>
                        <TextInput
                            style={[styles.input, focused === 'password' && styles.inputFocused]}
                            placeholder="Create a strong password"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            placeholderTextColor="#8a8f9b"
                            onFocus={() => setFocused('password')}
                            onBlur={() => setFocused(null)}
                        />

                        <Text style={[styles.label, { marginTop: 16 }]}>I am joining as</Text>
                        <View style={styles.roleRow}>
                            <Pressable
                                style={[styles.identityCard, role === 'client' && styles.identityActive]}
                                onPress={() => setRole('client')}
                            >
                                <View style={styles.identityIconWrap}>
                                    <Ionicons name="briefcase" size={20} color="#001F3F" />
                                </View>
                                <Text style={styles.identityTitle}>Client</Text>
                                <Text style={styles.identityMeta}>Fund, track, approve</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.identityCard, role === 'provider' && styles.identityActive]}
                                onPress={() => setRole('provider')}
                            >
                                <View style={styles.identityIconWrap}>
                                    <Ionicons name="hammer" size={20} color="#001F3F" />
                                </View>
                                <Text style={styles.identityTitle}>Provider</Text>
                                <Text style={styles.identityMeta}>Build and report</Text>
                            </Pressable>
                        </View>

                        {error ? <Text style={styles.error}>{error}</Text> : null}

                        <Pressable style={styles.button} onPress={onSignup}>
                            <Ionicons name="person-add" size={18} color="#fff" />
                            <Text style={styles.buttonText}>Sign Up Securely</Text>
                        </Pressable>

                        <Pressable onPress={() => router.push('/login')} style={styles.secondary}>
                            <Text style={styles.secondaryText}>Already have an account? Log in</Text>
                        </Pressable>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#ECEFF3' },
    scroll: { padding: 20, paddingBottom: 32 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6, marginBottom: 16 },
    brandBadge: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#001F3F', alignItems: 'center', justifyContent: 'center' },
    heroTitle: { fontSize: 24, fontWeight: '700', color: '#001F3F' },
    heroSubtitle: { color: '#4B5563', fontSize: 14, fontWeight: '400' },

    card: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        gap: 12,
        shadowColor: '#001F3F',
        shadowOpacity: 0.12,
        shadowOffset: { width: 0, height: 16 },
        shadowRadius: 24,
        elevation: 5,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    title: { fontSize: 22, fontWeight: '700', color: '#001F3F' },
    subtitle: { color: '#6B7280', marginTop: 2, fontWeight: '400' },
    label: { fontSize: 13, fontWeight: '700', color: '#001F3F', marginTop: 4 },
    input: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 13,
        backgroundColor: '#F5F5F7',
        fontSize: 15,
        fontWeight: '400',
        color: '#0B1222',
    },
    inputFocused: {
        borderColor: '#001F3F',
        shadowColor: '#001F3F',
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 10,
        elevation: 3,
    },
    roleRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
    identityCard: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 18,
        padding: 14,
        backgroundColor: '#F8FAFC',
        gap: 8,
        shadowColor: 'transparent',
    },
    identityActive: {
        borderColor: '#10B981',
        backgroundColor: '#ECFDF3',
        shadowColor: '#10B981',
        shadowOpacity: 0.25,
        shadowOffset: { width: 0, height: 14 },
        shadowRadius: 20,
        elevation: 5,
    },
    identityIconWrap: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
    identityTitle: { fontWeight: '700', color: '#001F3F', fontSize: 16 },
    identityMeta: { color: '#4B5563', fontWeight: '400', fontSize: 13 },
    button: {
        marginTop: 8,
        backgroundColor: '#001F3F',
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        shadowColor: '#001F3F',
        shadowOpacity: 0.3,
        shadowOffset: { width: 0, height: 12 },
        shadowRadius: 20,
        elevation: 5,
    },
    buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
    secondary: { paddingVertical: 12, alignItems: 'center' },
    secondaryText: { color: '#001F3F', fontWeight: '600', fontSize: 14 },
    error: { color: '#DC2626', marginTop: 10, fontWeight: '700' },
});
