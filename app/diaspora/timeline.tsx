import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

// New Navigation Bar
import NavigationBar from '@/components/NavigationBar';

export default function ProjectTimeline() {
    const router = useRouter();
    // In a real app, you would pass the project ID: router.push({ pathname: 'timeline', params: { id: 123 }})
    // For now, we'll fetch updates for *any* project owned by the user or just the latest ones
    const [updates, setUpdates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchUpdates();
    }, []);

    const fetchUpdates = async () => {
        const { data, error } = await supabase
            .from('project_updates')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) setUpdates(data);
        setLoading(false);
    };

    const renderTimelineItem = (item: any, index: number) => {
        const isLast = index === updates.length - 1;

        return (
            <View key={item.id} style={styles.itemWrapper}>
                {/* 1. The Left Timeline Line */}
                <View style={styles.leftColumn}>
                    <View style={[styles.dot, item.update_type === 'milestone' && styles.milestoneDot]}>
                        {item.update_type === 'milestone' && <Ionicons name="star" size={10} color="#fff" />}
                    </View>
                    {!isLast && <View style={styles.line} />}
                </View>

                {/* 2. The Right Content Card */}
                <View style={styles.rightContent}>
                    <Text style={styles.date}>
                        {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                    </Text>

                    <View style={styles.card}>
                        <Text style={styles.title}>{item.title}</Text>
                        {item.description && <Text style={styles.desc}>{item.description}</Text>}

                        {item.image_url && (
                            <Image
                                source={{ uri: item.image_url }}
                                style={styles.updateImage}
                            />
                        )}

                        {item.update_type === 'milestone' && (
                            <View style={styles.milestoneBadge}>
                                <Text style={styles.milestoneText}>Milestone Reached 🚀</Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <NavigationBar title="Project History" showBack={true} />

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Construction Log</Text>
                    <Text style={styles.headerSub}>Real-time site updates</Text>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#0EA5E9" style={{ marginTop: 50 }} />
                ) : updates.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="construct-outline" size={48} color="#CBD5E1" />
                        <Text style={styles.emptyText}>No updates yet</Text>
                        <Text style={styles.emptySub}>When the provider posts updates, they will appear here.</Text>
                    </View>
                ) : (
                    <View style={styles.timelineContainer}>
                        {updates.map((item, index) => renderTimelineItem(item, index))}
                    </View>
                )}
            </ScrollView>

            {/* Floating Action Button to Add Update (Simulation for Provider) */}
            <TouchableOpacity style={styles.fab} onPress={() => {
                // In future: navigate to an "Add Update" screen
                alert('This feature is for Providers!');
            }}>
                <Ionicons name="camera" size={28} color="#fff" />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    scrollContent: { padding: 20, paddingBottom: 100 },

    header: { marginBottom: 30 },
    headerTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
    headerSub: { color: '#64748B', fontSize: 16 },

    timelineContainer: { marginTop: 10 },
    itemWrapper: { flexDirection: 'row', marginBottom: 0 },

    // Left Column (Line + Dot)
    leftColumn: { alignItems: 'center', width: 40, marginRight: 10 },
    dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#CBD5E1', zIndex: 2, marginTop: 6 },
    milestoneDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#0EA5E9', alignItems: 'center', justifyContent: 'center', marginTop: 3 },
    line: { width: 2, flex: 1, backgroundColor: '#E2E8F0', marginVertical: 4 },

    // Right Column
    rightContent: { flex: 1, paddingBottom: 40 },
    date: { fontSize: 12, color: '#94A3B8', marginBottom: 8, fontWeight: '600' },
    card: { backgroundColor: '#fff', padding: 16, borderRadius: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },

    title: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 6 },
    desc: { fontSize: 14, color: '#475569', lineHeight: 20, marginBottom: 12 },
    updateImage: { width: '100%', height: 180, borderRadius: 12, marginBottom: 10 },

    milestoneBadge: { backgroundColor: '#F0F9FF', padding: 8, borderRadius: 8, alignSelf: 'flex-start' },
    milestoneText: { color: '#0EA5E9', fontWeight: '700', fontSize: 12 },

    emptyState: { alignItems: 'center', marginTop: 60, gap: 10 },
    emptyText: { fontSize: 18, fontWeight: '700', color: '#94A3B8' },
    emptySub: { color: '#CBD5E1' },

    fab: { position: 'absolute', bottom: 30, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 10, elevation: 10 },
});