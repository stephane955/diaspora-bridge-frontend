// app/signup.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SignupScreen() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const onSignup = async () => {
        if (!name || !email || !password) {
            setError('Please fill in all fields.');
            return;
        }

        // later: send to backend to create account
        await AsyncStorage.setItem('loggedIn', 'true');

        // go to role selection
        router.replace('/role');
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Join Diaspora Bridge</Text>

            <TextInput
                style={styles.input}
                placeholder="Full name"
                value={name}
                onChangeText={setName}
            />

            <TextInput
                style={styles.input}
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
            />

            <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity style={styles.button} onPress={onSignup}>
                <Text style={styles.buttonText}>Sign up</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/login')}>
                <Text style={styles.footerText}>Already have an account? Login</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', padding: 20, justifyContent: 'center' },
    title: { fontSize: 26, fontWeight: '700', marginBottom: 4 },
    subtitle: { color: '#6b7280', marginBottom: 18 },
    input: {
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 12,
    },
    button: {
        backgroundColor: '#2563eb',
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 4,
    },
    buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
    error: { color: 'red', marginBottom: 10 },
    footerText: {
        textAlign: 'center',
        marginTop: 14,
        color: '#2563eb',
        fontWeight: '500',
    },
});
