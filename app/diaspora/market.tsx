import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';

export default function MarketScreen() {
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>Market</Text>
                <Text style={styles.placeholderSub}>Browse and discover projects here.</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    placeholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.xl,
    },
    placeholderText: {
        fontSize: 22,
        fontWeight: '800',
        color: theme.colors.text,
        marginBottom: theme.spacing.xs,
    },
    placeholderSub: {
        fontSize: 15,
        color: theme.colors.textMuted,
        textAlign: 'center',
    },
});
