import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { claimObserverInvite } from '@/utils/observers';
import ScreenLoader from '@/components/ScreenLoader';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import { GOLD, radius, space, text } from '@/constants/design';

export default function ObserverJoinScreen() {
    const { token } = useLocalSearchParams<{ token: string }>();
    const router = useRouter();
    const { user } = useAuth();
    const { t } = useLanguage();
    const c = usePremiumColors();
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
            <View style={[styles.container, { backgroundColor: c.bg }]}>
                <Text style={[styles.title, { color: c.textPrimary }]}>{t('viewOnlyAccess')}</Text>
                <Text style={[styles.sub, { color: c.textSecondary }]}>{t('signInToAcceptInvite')}</Text>
                <TouchableOpacity
                    style={styles.btn}
                    onPress={() => router.replace({ pathname: '/login', params: { redirect: returnUrl } })}
                >
                    <Text style={styles.btnText}>{t('signIn')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (status === 'error') {
        return (
            <View style={[styles.container, { backgroundColor: c.bg }]}>
                <Text style={[styles.title, { color: c.textPrimary }]}>{t('invalidOrExpiredLink')}</Text>
                <TouchableOpacity style={styles.btn} onPress={() => router.replace('/')}>
                    <Text style={styles.btnText}>{t('goHome')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return <ScreenLoader label={t('joiningProject')} />;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: space.xl,
    },
    title: { ...text.title, marginBottom: space.xs, textAlign: 'center' },
    sub: { ...text.footnote, marginBottom: space.lg, textAlign: 'center' },
    btn: {
        backgroundColor: GOLD,
        paddingHorizontal: space.lg,
        paddingVertical: space.sm,
        borderRadius: radius.lg,
    },
    btnText: { color: '#0A0F1A', ...text.footnote, fontWeight: '800' },
});
