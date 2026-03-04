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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { theme } from '@/constants/theme';
import { mediumFeedback, lightFeedback } from '@/utils/haptics';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'diaspora' | 'provider'>('diaspora');

    const handleClose = () => {
        lightFeedback();
        router.replace('/');
    };

    const switchRole = (role: 'diaspora' | 'provider') => {
        mediumFeedback();
        setActiveTab(role);
    };

    const onLogin = async () => {
        if (!email || !password) return Alert.alert('Error', 'Please enter email and password.');

        mediumFeedback();
        setLoading(true);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;

            const savedRole = data.user?.user_metadata?.role;

            if (savedRole === 'provider') {
                router.replace('/provider');
            } else if (savedRole === 'client') {
                router.replace('/diaspora');
            } else {
                if (activeTab === 'provider') {
                    await supabase.auth.updateUser({ data: { role: 'provider' } });
                    router.replace('/provider');
                } else {
                    await supabase.auth.updateUser({ data: { role: 'client' } });
                    router.replace('/diaspora');
                }
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Login failed.';
            Alert.alert('Login Failed', message);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!email) {
            Alert.alert("Required", "Please enter your email address first.");
            return;
        }
        const redirectUrl = Linking.createURL('reset-password');
        setLoading(true);
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl });
        setLoading(false);

        if (error) Alert.alert("Error", error.message);
        else Alert.alert("Check Email", "Password reset link sent to " + email);
    };

    const isDiaspora = activeTab === 'diaspora';

    return (
        <ImageBackground
            source={{ uri: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop' }}
            style={styles.background}
        >
            <LinearGradient
                colors={['rgba(15, 23, 42, 0.5)', 'rgba(15, 23, 42, 0.92)']}
                style={styles.gradient}
            >
                <TouchableOpacity
                    style={[styles.closeBtn, { top: insets.top + 8 }]}
                    onPress={handleClose}
                    activeOpacity={0.7}
                >
                    <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>

                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}>
                        <View style={styles.header}>
                            <View style={styles.logoCircle}>
                                <Ionicons name="business" size={32} color={theme.colors.active} />
                            </View>
                            <Text style={styles.brandName}>Diaspora<Text style={{ color: theme.colors.active }}>Bridge</Text></Text>
                            <Text style={styles.tagline}>Build home, from anywhere.</Text>
                        </View>

                        <View style={styles.card}>
                            {/* Unmistakable Role Toggle */}
                            <View style={styles.roleToggleContainer}>
                                <TouchableOpacity
                                    style={[styles.roleCard, isDiaspora && styles.roleCardActive]}
                                    onPress={() => switchRole('diaspora')}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.roleIconCircle, isDiaspora && styles.roleIconActive]}>
                                        <Ionicons name="globe-outline" size={24} color={isDiaspora ? '#fff' : theme.colors.textMuted} />
                                    </View>
                                    <Text style={[styles.roleLabel, isDiaspora && styles.roleLabelActive]}>Client</Text>
                                    <Text style={[styles.roleDesc, isDiaspora && styles.roleDescActive]}>I hire talent</Text>
                                    {isDiaspora && <View style={styles.activeIndicator} />}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.roleCard, !isDiaspora && styles.roleCardActive]}
                                    onPress={() => switchRole('provider')}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.roleIconCircle, !isDiaspora && styles.roleIconActiveProvider]}>
                                        <Ionicons name="construct-outline" size={24} color={!isDiaspora ? '#fff' : theme.colors.textMuted} />
                                    </View>
                                    <Text style={[styles.roleLabel, !isDiaspora && styles.roleLabelActive]}>Provider</Text>
                                    <Text style={[styles.roleDesc, !isDiaspora && styles.roleDescActive]}>I find work</Text>
                                    {!isDiaspora && <View style={[styles.activeIndicator, { backgroundColor: theme.colors.emerald }]} />}
                                </TouchableOpacity>
                            </View>

                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>Email</Text>
                                <View style={styles.inputWrapper}>
                                    <Ionicons name="mail-outline" size={20} color={theme.colors.textSubtle} style={{ marginLeft: 12 }} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="name@example.com"
                                        placeholderTextColor={theme.colors.textSubtle}
                                        autoCapitalize="none"
                                        value={email}
                                        onChangeText={setEmail}
                                    />
                                </View>
                            </View>

                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>Password</Text>
                                <View style={styles.inputWrapper}>
                                    <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textSubtle} style={{ marginLeft: 12 }} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="••••••••"
                                        placeholderTextColor={theme.colors.textSubtle}
                                        secureTextEntry
                                        value={password}
                                        onChangeText={setPassword}
                                    />
                                </View>
                            </View>

                            <TouchableOpacity onPress={handleResetPassword} style={styles.forgotBtn} activeOpacity={0.7}>
                                <Text style={styles.forgotText}>Forgot Password?</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.loginBtn, !isDiaspora && styles.loginBtnProvider]}
                                onPress={onLogin}
                                disabled={loading}
                                activeOpacity={0.7}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.loginBtnText}>
                                        {isDiaspora ? 'Enter Dashboard' : 'Access Work Hub'}
                                    </Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => router.push('/signup')} style={{ marginTop: 20 }} activeOpacity={0.7}>
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
    background: { flex: 1, width, height },
    gradient: { flex: 1, justifyContent: 'center' },
    scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },

    closeBtn: {
        position: 'absolute',
        top: 60,
        left: 20,
        zIndex: 50,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    header: { alignItems: 'center', marginBottom: 32 },
    logoCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    brandName: { fontSize: 32, ...theme.typography.title, color: '#fff' },
    tagline: { color: theme.colors.textSubtle, fontSize: 16, marginTop: 5 },

    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.97)',
        borderRadius: theme.radii.xl,
        padding: 24,
        ...theme.shadow.soft,
        shadowOpacity: 0.3,
        shadowRadius: 30,
    },

    roleToggleContainer: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    roleCard: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 12,
        borderRadius: theme.radii.md,
        backgroundColor: theme.colors.surfaceAlt,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    roleCardActive: {
        backgroundColor: '#fff',
        borderColor: theme.colors.active,
        ...theme.shadow.glow,
    },
    roleIconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: theme.colors.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    roleIconActive: { backgroundColor: theme.colors.active },
    roleIconActiveProvider: { backgroundColor: theme.colors.emerald },
    roleLabel: { fontSize: 15, fontWeight: '800', color: theme.colors.textMuted },
    roleLabelActive: { color: theme.colors.text },
    roleDesc: { fontSize: 11, color: theme.colors.textSubtle, marginTop: 2 },
    roleDescActive: { color: theme.colors.textMuted },
    activeIndicator: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: theme.colors.active,
        marginTop: 8,
    },

    inputContainer: { marginBottom: 16 },
    inputLabel: { fontSize: 12, ...theme.typography.label, color: '#475569', marginBottom: 6 },
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.sm, height: 50 },
    input: { flex: 1, height: '100%', paddingHorizontal: 12, fontSize: 16, color: theme.colors.text },

    loginBtn: {
        height: 54,
        backgroundColor: theme.colors.primary,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        ...theme.shadow.glow,
    },
    loginBtnProvider: {
        backgroundColor: theme.colors.emerald,
        shadowColor: theme.colors.emerald,
    },
    loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    footerText: { textAlign: 'center', color: theme.colors.textMuted, fontSize: 14 },
    link: { color: theme.colors.active, fontWeight: '700' },
    forgotBtn: { alignSelf: 'flex-end', marginBottom: 24, marginTop: 8 },
    forgotText: { color: theme.colors.textMuted, fontSize: 14, fontWeight: '600' },
});
