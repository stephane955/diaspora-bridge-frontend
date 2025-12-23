import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import NavigationBar from '@/components/NavigationBar';

export default function ProjectTimeline() {
    const { id } = useLocalSearchParams();

    const [updates, setUpdates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchUpdates = useCallback(async () => {
        // Safety check: if no ID, stop loading immediately
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
            // ALWAYS run this, even if there was an error
            setLoading(false);
            setRefreshing(false);
        }
    }, [id]);

    useEffect(() => {
        fetchUpdates();
    }, [fetchUpdates]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchUpdates();
    };

    return (
        <View style={styles.container}>
            <NavigationBar title="Construction Log" subtitle="Real-time site updates" showBack={true} />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {loading ? (
                    <ActivityIndicator size="large" color="#0EA5E9" style={{ marginTop: 50 }} />
                ) : updates.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="construct-outline" size={48} color="#CBD5E1" />
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
                                                month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'
                                            })}
                                        </Text>

                                        <View style={styles.card}>
                                            {item.image_url && (
                                                <Image
                                                    source={{ uri: item.image_url }}
                                                    style={styles.updateImage}
                                                />
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
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    scrollContent: { padding: 20, paddingBottom: 50 },

    timelineContainer: { marginTop: 10 },
    itemWrapper: { flexDirection: 'row' },

    leftColumn: { alignItems: 'center', width: 30, marginRight: 12 },
    dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#0EA5E9', zIndex: 2, marginTop: 6, borderWidth: 2, borderColor: '#fff' },
    line: { width: 2, flex: 1, backgroundColor: '#E2E8F0', marginVertical: -2 },

    rightContent: { flex: 1, paddingBottom: 30 },
    date: { fontSize: 12, color: '#94A3B8', marginBottom: 6, fontWeight: '600' },

    card: { backgroundColor: '#fff', padding: 12, borderRadius: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    title: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
    desc: { fontSize: 14, color: '#334155', lineHeight: 22 },
    updateImage: { width: '100%', height: 180, borderRadius: 12, marginBottom: 12, backgroundColor: '#F1F5F9', resizeMode: 'cover' },

    emptyState: { alignItems: 'center', marginTop: 80, gap: 10 },
    emptyText: { fontSize: 18, fontWeight: '700', color: '#94A3B8' },
    emptySub: { color: '#CBD5E1', textAlign: 'center', paddingHorizontal: 40 },
});