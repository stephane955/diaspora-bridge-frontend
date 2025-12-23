import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

export default function SignupScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [city, setCity] = useState(''); // NEW: City Field
    const [role, setRole] = useState<'client' | 'provider'>('client');
    const [loading, setLoading] = useState(false);

    const onSignup = async () => {
        if (!email || !password || !fullName || !city) return Alert.alert('Error', 'Please fill all fields.');
        setLoading(true);

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    city: city, // Saving city to profile
                    role: role,
                },
            },
        });

        setLoading(false);

        if (error) {
            Alert.alert('Signup Failed', error.message);
        } else {
            if (role === 'provider') {
                router.replace('/provider');
            } else {
                router.replace('/diaspora');
            }
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.title}>Create Account</Text>
                    <Text style={styles.subtitle}>Join DiasporaBridge today.</Text>
                </View>

                {/* ROLE SELECTOR */}
                <Text style={styles.label}>I am a...</Text>
                <View style={styles.roleContainer}>
                    <TouchableOpacity style={[styles.roleBtn, role === 'client' && styles.roleActive]} onPress={() => setRole('client')}>
                        <Ionicons name="earth" size={24} color={role === 'client' ? '#fff' : '#64748B'} />
                        <Text style={[styles.roleText, role === 'client' && styles.textActive]}>Client</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.roleBtn, role === 'provider' && styles.roleActive]} onPress={() => setRole('provider')}>
                        <Ionicons name="hammer" size={24} color={role === 'provider' ? '#fff' : '#64748B'} />
                        <Text style={[styles.roleText, role === 'provider' && styles.textActive]}>Provider</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.form}>
                    <Text style={styles.label}>Full Name</Text>
                    <TextInput style={styles.input} placeholder="John Doe" value={fullName} onChangeText={setFullName} placeholderTextColor="#94A3B8" />

                    <Text style={styles.label}>Base City</Text>
                    <TextInput style={styles.input} placeholder="e.g. Douala" value={city} onChangeText={setCity} placeholderTextColor="#94A3B8" />

                    <Text style={styles.label}>Email Address</Text>
                    <TextInput style={styles.input} placeholder="you@example.com" autoCapitalize="none" value={email} onChangeText={setEmail} placeholderTextColor="#94A3B8" />

                    <Text style={styles.label}>Password</Text>
                    <TextInput style={styles.input} placeholder="At least 6 characters" secureTextEntry value={password} onChangeText={setPassword} placeholderTextColor="#94A3B8" />

                    <TouchableOpacity style={styles.signupBtn} onPress={onSignup} disabled={loading}>
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create Account</Text>}
                    </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Already have an account?</Text>
                    <TouchableOpacity onPress={() => router.push('/login')}><Text style={styles.linkText}>Sign In</Text></TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    content: { padding: 24, justifyContent: 'center', minHeight: '100%' },
    header: { marginBottom: 30 },
    title: { fontSize: 28, fontWeight: '800', color: '#0F172A' },
    subtitle: { fontSize: 16, color: '#64748B', marginTop: 4 },
    label: { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 8, marginTop: 16 },
    roleContainer: { flexDirection: 'row', gap: 12, marginBottom: 10 },
    roleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
    roleActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
    roleText: { fontSize: 16, fontWeight: '600', color: '#64748B' },
    textActive: { color: '#fff' },
    form: { marginTop: 10 },
    input: { height: 50, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, fontSize: 16, color: '#0F172A', backgroundColor: '#fff' },
    signupBtn: { height: 56, backgroundColor: '#0EA5E9', borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 30 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    footer: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 40 },
    footerText: { color: '#64748B' },
    linkText: { color: '#0F172A', fontWeight: '700' }
});