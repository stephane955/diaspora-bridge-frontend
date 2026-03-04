import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import NavigationBar from '@/components/NavigationBar';
import { theme } from '@/constants/theme';

export default function ProjectTimeline() {
    const insets = useSafeAreaInsets();
    const { id } = useLocalSearchParams();

    const [updates, setUpdates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchUpdates = useCallback(async () => {
        if (!id) {
            setLoading(false);
            setRefreshing(false);
            return;
        }
        try {
            const { data, error } = await supabase
                .from('project_updates')
                .select('*')
                .eq('project_id', id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            if (data) setUpdates(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [id]);

    useEffect(() => { fetchUpdates(); }, [fetchUpdates]);
    const onRefresh = () => { setRefreshing(true); fetchUpdates(); };

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <NavigationBar title="Timeline" showBack dynamicColor={theme.colors.active} />
            <ScrollView
                contentContainerStyle={[styles.scrollContent, { paddingBottom: 120, paddingHorizontal: theme.spacing.lg }]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {loading ? (
                    <ActivityIndicator size="large" color={theme.colors.active} style={{ marginTop: 50 }} />
                ) : updates.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="construct-outline" size={48} color={theme.colors.textSubtle} />
                        <Text style={styles.emptyText}>No updates yet</Text>
                        <Text style={styles.emptySub}>
                            When the provider posts photos, they will appear here.
                        </Text>
                    </View>
                ) : (
                    <View style={styles.timelineContainer}>
                        {updates.map((item, index) => {
                            const isLast = index === updates.length - 1;
                            return (
                                <View key={item.id} style={styles.itemWrapper}>
                                    <View style={styles.leftColumn}>
                                        <View style={styles.dot} />
                                        {!isLast && <View style={styles.line} />}
                                    </View>
                                    <View style={styles.rightContent}>
                                        <Text style={styles.date}>
                                            {new Date(item.created_at).toLocaleDateString(undefined, {
                                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                                            })}
                                        </Text>
                                        <View style={styles.card}>
                                            {item.image_url && (
                                                <Image source={{ uri: item.image_url }} style={styles.updateImage} />
                                            )}
                                            <Text style={styles.title}>{item.title}</Text>
                                            <Text style={styles.desc}>{item.description}</Text>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scrollContent: { paddingTop: theme.spacing.md },
    timelineContainer: { marginTop: theme.spacing.sm },
    itemWrapper: { flexDirection: 'row' },
    leftColumn: { alignItems: 'center', width: 30, marginRight: 12 },
    dot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: theme.colors.active,
        zIndex: 2,
        marginTop: 6,
        borderWidth: 2,
        borderColor: theme.colors.surface,
    },
    line: { width: 2, flex: 1, backgroundColor: theme.colors.border, marginVertical: -2 },
    rightContent: { flex: 1, paddingBottom: 30 },
    date: {
        fontSize: 12,
        color: theme.colors.textMuted,
        marginBottom: 6,
        fontWeight: '600',
    },
    card: {
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.sm,
        borderRadius: theme.radii.md,
        ...theme.shadow.soft,
    },
    title: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
    desc: { fontSize: 14, color: theme.colors.textMuted, lineHeight: 22 },
    updateImage: {
        width: '100%',
        height: 180,
        borderRadius: theme.radii.sm,
        marginBottom: theme.spacing.sm,
        backgroundColor: theme.colors.background,
        resizeMode: 'cover',
    },
    emptyState: { alignItems: 'center', marginTop: 80, gap: 10 },
    emptyText: { fontSize: 18, fontWeight: '700', color: theme.colors.textSubtle },
    emptySub: { color: theme.colors.textSubtle, textAlign: 'center', paddingHorizontal: 40 },
});
