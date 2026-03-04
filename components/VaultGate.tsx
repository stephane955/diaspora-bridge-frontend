import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useVaultUnlock } from '@/hooks/useVaultUnlock';
import { mediumFeedback } from '@/utils/haptics';

type Props = {
    promptMessage: string;
    children: React.ReactNode;
    /** When true, re-lock when screen loses focus (user navigates away) */
    lockOnBlur?: boolean;
};

export default function VaultGate({ promptMessage, children, lockOnBlur = true }: Props) {
    const { theme } = useTheme();
    const { unlocked, error, authenticate, lock } = useVaultUnlock({
        promptMessage,
        onUnlock: () => {},
    });

    useFocusEffect(
        React.useCallback(() => {
            if (!lockOnBlur) return;
            return () => lock();
        }, [lockOnBlur, lock])
    );

    if (unlocked) {
        return <>{children}</>;
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.primary }]}>
            <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
                <View style={[styles.iconWrap, { backgroundColor: theme.colors.surfaceAlt }]}>
                    <Ionicons name="lock-closed" size={48} color={theme.colors.active} />
                </View>
                <Text style={[styles.title, { color: theme.colors.text }]}>Vault protected</Text>
                <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
                    {promptMessage}
                </Text>
                {error && error !== 'Cancelled' && (
                    <Text style={[styles.error, { color: theme.colors.danger }]}>{error}</Text>
                )}
                <TouchableOpacity
                    style={[styles.btn, { backgroundColor: theme.colors.active }]}
                    onPress={() => { mediumFeedback(); authenticate(); }}
                    activeOpacity={0.8}
                >
                    <Ionicons name="finger-print" size={24} color="#fff" />
                    <Text style={styles.btnText}>Unlock with Biometrics</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 24,
        padding: 28,
        alignItems: 'center',
    },
    iconWrap: {
        width: 88,
        height: 88,
        borderRadius: 44,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        marginBottom: 16,
        textAlign: 'center',
    },
    error: {
        fontSize: 12,
        marginBottom: 12,
    },
    btn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 14,
    },
    btnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});
