import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ActivityIndicator, Alert, ImageBackground, Dimensions,
    KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    // If auto-detection fails, user can manually switch tab
    const [activeTab, setActiveTab] = useState<'diaspora' | 'provider'>('diaspora');

    const onLogin = async () => {
        if (!email || !password) return Alert.alert('Error', 'Please enter email and password.');

        setLoading(true);

        try {
            // 1. Sign In
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            // 2. Smart Redirect Logic
            const savedRole = data.user?.user_metadata?.role;

            // If the database knows your role, OBEY the database
            if (savedRole === 'provider') {
                router.replace('/provider');
            } else if (savedRole === 'client') {
                router.replace('/diaspora');
            } else {
                // 3. Fallback: If role is missing (old account), use the Manual Tab
                if (activeTab === 'provider') {
                    // Optional: Update their metadata so it works next time
                    await supabase.auth.updateUser({ data: { role: 'provider' }});
                    router.replace('/provider');
                } else {
                    await supabase.auth.updateUser({ data: { role: 'client' }});
                    router.replace('/diaspora');
                }
            }

        } catch (err: any) {
            Alert.alert('Login Failed', err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!email) {
            Alert.alert("Required", "Please enter your email address first.");
            return;
        }

        // This creates the correct link for your current environment
        const redirectUrl = Linking.createURL('reset-password');
        console.log("WHITELIST THIS IN SUPABASE:", redirectUrl);

        setLoading(true);
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: redirectUrl,
        });
        setLoading(false);

        if (error) {
            Alert.alert("Error", error.message);
        } else {
            Alert.alert("Check Email", "Password reset link sent to " + email);
        }
    };

    return (
        <ImageBackground
            source={{ uri: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop' }}
            style={styles.background}
        >
            <LinearGradient
                colors={['rgba(15, 23, 42, 0.6)', 'rgba(15, 23, 42, 0.9)']}
                style={styles.gradient}
            >
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={styles.scrollContent}>

                        {/* BRANDING */}
                        <View style={styles.header}>
                            <View style={styles.logoCircle}>
                                <Ionicons name="business" size={32} color="#0EA5E9" />
                            </View>
                            <Text style={styles.brandName}>Diaspora<Text style={{color: '#0EA5E9'}}>Bridge</Text></Text>
                            <Text style={styles.tagline}>Build home, from anywhere.</Text>
                        </View>

                        {/* GLASS CARD */}
                        <View style={styles.card}>
                            {/* PORTAL SWITCHER (Visual only, helps user intent) */}
                            <View style={styles.tabContainer}>
                                <TouchableOpacity
                                    style={[styles.tab, activeTab === 'diaspora' && styles.activeTab]}
                                    onPress={() => setActiveTab('diaspora')}
                                >
                                    <Text style={[styles.tabText, activeTab === 'diaspora' && styles.activeTabText]}>Client Portal</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.tab, activeTab === 'provider' && styles.activeTab]}
                                    onPress={() => setActiveTab('provider')}
                                >
                                    <Text style={[styles.tabText, activeTab === 'provider' && styles.activeTabText]}>Provider Login</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>Email</Text>
                                <View style={styles.inputWrapper}>
                                    <Ionicons name="mail-outline" size={20} color="#94A3B8" style={{marginLeft: 12}} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="name@example.com"
                                        placeholderTextColor="#94A3B8"
                                        autoCapitalize="none"
                                        value={email}
                                        onChangeText={setEmail}
                                    />
                                </View>
                            </View>

                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>Password</Text>
                                <View style={styles.inputWrapper}>
                                    <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={{marginLeft: 12}} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="••••••••"
                                        placeholderTextColor="#94A3B8"
                                        secureTextEntry
                                        value={password}
                                        onChangeText={setPassword}
                                    />
                                </View>
                            </View>

                            <TouchableOpacity
                                onPress={handleResetPassword}
                                style={styles.forgotBtn}
                            >
                                <Text style={styles.forgotText}>
                                    Forgot Password?
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.loginBtn}
                                onPress={onLogin}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.loginBtnText}>
                                        {activeTab === 'diaspora' ? 'Enter Dashboard' : 'Access Work Hub'}
                                    </Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => router.push('/signup')} style={{ marginTop: 20 }}>
                                <Text style={styles.footerText}>New here? <Text style={styles.link}>Create Account</Text></Text>
                            </TouchableOpacity>
                        </View>

                    </ScrollView>
                </KeyboardAvoidingView>
            </LinearGradient>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    background: { flex: 1, width: width, height: height },
    gradient: { flex: 1, justifyContent: 'center' },
    scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },

    header: { alignItems: 'center', marginBottom: 40 },
    logoCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    brandName: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -1 },
    tagline: { color: '#94A3B8', fontSize: 16, marginTop: 5 },

    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.3,
        shadowRadius: 30,
        elevation: 10
    },

    tabContainer: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4, marginBottom: 25 },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
    activeTab: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
    tabText: { fontWeight: '600', color: '#64748B', fontSize: 13 },
    activeTabText: { color: '#0F172A', fontWeight: '700' },

    inputContainer: { marginBottom: 16 },
    inputLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6, textTransform: 'uppercase' },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, height: 50 },
    input: { flex: 1, height: '100%', paddingHorizontal: 12, fontSize: 16, color: '#0F172A' },

    loginBtn: { height: 54, backgroundColor: '#0F172A', borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 10, shadowColor: '#0EA5E9', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10 },
    loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    footerText: { textAlign: 'center', color: '#64748B', fontSize: 14 },
    link: { color: '#0EA5E9', fontWeight: '700' },
    forgotBtn: {
        alignSelf: 'flex-end',
        marginBottom: 24,
        marginTop: 8
    },
    forgotText: {
        color: '#64748B',
        fontSize: 14,
        fontWeight: '600'
    },
});