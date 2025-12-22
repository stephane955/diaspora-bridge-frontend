import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { lightFeedback } from '@/utils/haptics';

export default function ProjectStories() {
    const router = useRouter();
    const [stories, setStories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStories();
    }, []);

    const fetchStories = async () => {
        // Fetch the 5 most recent updates that have images
        const { data } = await supabase
            .from('project_updates')
            .select('id, title, image_url, created_at')
            .not('image_url', 'is', null) // Only get updates with photos
            .order('created_at', { ascending: false })
            .limit(5);

        if (data) setStories(data);
        setLoading(false);
    };

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.header}>Live Site Updates</Text>
                <TouchableOpacity onPress={() => router.push('/diaspora/timeline')}>
                    <Text style={styles.seeAll}>See All</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20 }}
                style={styles.scroll}
            >
                {/* The "Add New" Button (Static for now) */}
                <TouchableOpacity
                    style={styles.itemContainer}
                    onPress={lightFeedback}
                    activeOpacity={0.7}
                >
                    <View style={[styles.circle, styles.addBorder]}>
                        <Ionicons name="add" size={28} color="#94A3B8" />
                    </View>
                    <Text style={styles.label}>Add Update</Text>
                </TouchableOpacity>

                {loading ? (
                    <ActivityIndicator size="small" color="#0EA5E9" style={{ marginLeft: 20 }} />
                ) : (
                    stories.map((item, index) => (
                        <TouchableOpacity
                            key={item.id}
                            style={styles.itemContainer}
                            onPress={() => {
                                lightFeedback();
                                router.push('/diaspora/timeline');
                            }}
                        >
                            {/* Gradient Ring logic: First item is "New" (Orange/Red), others are "Seen" (Gray) */}
                            <LinearGradient
                                colors={index === 0 ? ['#F59E0B', '#EF4444'] : ['#E2E8F0', '#CBD5E1']}
                                start={{ x: 0, y: 1 }}
                                end={{ x: 1, y: 0 }}
                                style={[styles.ring, { padding: index === 0 ? 3 : 2 }]}
                            >
                                <Image
                                    source={{ uri: item.image_url }}
                                    style={styles.storyImage}
                                />
                            </LinearGradient>
                            <Text numberOfLines={1} style={[styles.label, index === 0 && styles.boldLabel]}>
                                {item.title.split(' ')[0]} {/* Show only first word for clean UI */}
                            </Text>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { marginTop: 20, marginBottom: 10 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, alignItems: 'center', marginBottom: 15 },
    header: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
    seeAll: { color: '#0EA5E9', fontSize: 13, fontWeight: '600' },
    scroll: { paddingLeft: 0 },
    itemContainer: { marginRight: 16, alignItems: 'center', gap: 6, maxWidth: 70 },
    circle: { width: 68, height: 68, borderRadius: 34, justifyContent: 'center', alignItems: 'center' },
    addBorder: { borderWidth: 2, borderColor: '#CBD5E1', borderStyle: 'dashed' },
    ring: { borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
    storyImage: { width: 60, height: 60, borderRadius: 30, borderWidth: 3, borderColor: '#fff' },
    label: { fontSize: 12, color: '#64748B', fontWeight: '500', textAlign: 'center' },
    boldLabel: { color: '#0F172A', fontWeight: '700' },
});