import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { claimObserverInvite } from '@/utils/observers';
import { theme } from '@/constants/theme';

export default function ObserverJoinScreen() {
    const { token } = useLocalSearchParams<{ token: string }>();
    const router = useRouter();
    const { user } = useAuth();
    const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'login'>('loading');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            return;
        }
        if (!user) {
            setStatus('login');
            return;
        }
        (async () => {
            const result = await claimObserverInvite(token, user.id);
            if (result) {
                setStatus('success');
                router.replace(`/diaspora/project/${result.projectId}`);
            } else {
                setStatus('error');
            }
        })();
    }, [token, user]);

    if (status === 'login') {
        const returnUrl = `/observer/join?token=${token}`;
        return (
            <View style={styles.container}>
                <Text style={styles.title}>View-only access</Text>
                <Text style={styles.sub}>Sign in to accept this invite and view the project.</Text>
                <TouchableOpacity
                    style={styles.btn}
                    onPress={() => router.replace({ pathname: '/login', params: { redirect: returnUrl } })}
                >
                    <Text style={styles.btnText}>Sign in</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (status === 'error') {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>Invalid or expired link</Text>
                <TouchableOpacity style={styles.btn} onPress={() => router.replace('/')}>
                    <Text style={styles.btnText}>Go home</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color={theme.colors.active} />
            <Text style={styles.sub}>Joining project...</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing.xl,
        backgroundColor: theme.colors.background,
    },
    title: { fontSize: 20, fontWeight: '800', color: theme.colors.text, marginBottom: 8 },
    sub: { fontSize: 15, color: theme.colors.textMuted, marginBottom: 24 },
    btn: {
        backgroundColor: theme.colors.active,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: theme.radii.sm,
    },
    btnText: { color: theme.colors.surface, fontWeight: '700', fontSize: 16 },
});
