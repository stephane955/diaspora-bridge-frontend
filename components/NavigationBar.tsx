import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type Props = {
    title: string;
    subtitle?: string;
    onMenuPress?: () => void;
    onRefresh?: () => void;
    showBack?: boolean; // <--- New Prop
};

export default function NavigationBar({
                                          title,
                                          subtitle,
                                          onMenuPress,
                                          onRefresh,
                                          showBack = true // Default to true for sub-pages
                                      }: Props) {
    const router = useRouter();

    const goBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/');
        }
    };

    return (
        <View style={styles.container}>
            {/* Left Side: Back Button OR Placeholder */}
            {showBack ? (
                <Pressable style={styles.iconBtn} onPress={goBack}>
                    <Ionicons name="chevron-back" size={18} color="#0f172a" />
                </Pressable>
            ) : (
                // Empty view to keep the Title centered/aligned correctly if you prefer
                // Or you can render the Menu button here if you want "Left Menu" style
                <View style={{ width: 40 }} />
            )}

            <View style={styles.center}>
                <Text style={styles.title}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>

            <View style={styles.actions}>
                {onRefresh && (
                    <Pressable style={styles.iconBtn} onPress={onRefresh}>
                        <Ionicons name="refresh" size={18} color="#0f172a" />
                    </Pressable>
                )}
                <Pressable style={styles.iconBtn} onPress={onMenuPress || (() => router.replace('/diaspora'))}>
                    <Ionicons name="menu" size={18} color="#0f172a" />
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
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingTop: 50,
    },
    iconBtn: {
        width: 40,
        height: 40,
        borderRadius: 14,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    center: { flex: 1, paddingHorizontal: 12 },
    title: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
    subtitle: { color: '#64748B', fontSize: 12, marginTop: 2 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});