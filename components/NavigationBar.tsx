import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';

type Props = {
    title: string;
    subtitle?: string;
    onMenuPress?: () => void;
    onRefresh?: () => void;
    showBack?: boolean;
};

export default function NavigationBar({
    title,
    subtitle,
    onMenuPress,
    onRefresh,
    showBack = true,
}: Props) {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const goBack = () => {
        if (router.canGoBack()) router.back();
        else router.replace('/');
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top + theme.spacing.sm }]}>
            {showBack ? (
                <Pressable style={styles.iconBtn} onPress={goBack}>
                    <Ionicons name="chevron-back" size={18} color={theme.colors.text} />
                </Pressable>
            ) : (
                <View style={{ width: 40 }} />
            )}
            <View style={styles.center}>
                <Text style={styles.title}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <View style={styles.actions}>
                {onRefresh && (
                    <Pressable style={styles.iconBtn} onPress={onRefresh}>
                        <Ionicons name="refresh" size={18} color={theme.colors.text} />
                    </Pressable>
                )}
                <Pressable style={styles.iconBtn} onPress={onMenuPress || (() => router.replace('/diaspora'))}>
                    <Ionicons name="menu" size={18} color={theme.colors.text} />
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        backgroundColor: theme.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    iconBtn: {
        width: 40,
        height: 40,
        borderRadius: theme.radii.sm,
        backgroundColor: theme.colors.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    center: { flex: 1, paddingHorizontal: theme.spacing.sm },
    title: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
    subtitle: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
});
