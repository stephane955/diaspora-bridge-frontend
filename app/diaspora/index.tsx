// Location: app/diaspora/index.tsx
import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type ProjectCard = {
    id: string;
    title: string;
    city: string;
    provider: string;
    budgetUsed: number;
    budgetTotal: number;
    progress: number;
    latestPhoto: string;
    status: 'Active' | 'Pending' | 'Completed';
};

const PROJECTS: ProjectCard[] = [
    {
        id: '1',
        title: 'Duplex Foundation',
        city: 'Bonapriso, Douala',
        provider: 'Stephane M.',
        budgetUsed: 120000,
        budgetTotal: 200000,
        progress: 0.62,
        latestPhoto: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=60',
        status: 'Active',
    },
    {
        id: '2',
        title: 'Kitchen Remodel',
        city: 'Buea',
        provider: 'Buea Construction Ltd',
        budgetUsed: 45000,
        budgetTotal: 90000,
        progress: 0.48,
        latestPhoto: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=800&q=60',
        status: 'Pending',
    },
    {
        id: '3',
        title: 'Roofing Phase',
        city: 'Yaoundé',
        provider: 'Yaoundé ElectroFix',
        budgetUsed: 90000,
        budgetTotal: 110000,
        progress: 0.82,
        latestPhoto: 'https://images.unsplash.com/photo-1503389152951-9f343605f61e?auto=format&fit=crop&w=800&q=60',
        status: 'Active',
    },
];

export default function DiasporaHome() {
    const [search, setSearch] = useState('');
    const router = useRouter();

    const filtered = useMemo(
        () =>
            PROJECTS.filter(p =>
                `${p.title} ${p.city} ${p.provider}`.toLowerCase().includes(search.toLowerCase())
            ),
        [search]
    );

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.headerRow}>
                    <View>
                        <Text style={styles.kicker}>Diaspora Command Center</Text>
                        <Text style={styles.title}>Your projects, live</Text>
                    </View>
                    <Pressable style={styles.badge} onPress={() => router.push('/diaspora/projects')}>
                        <Ionicons name="albums" size={16} color="#0f172a" />
                        <Text style={styles.badgeText}>All</Text>
                    </Pressable>
                </View>

                <TextInput
                    style={styles.search}
                    placeholder="Search by city, provider, or title"
                    value={search}
                    onChangeText={setSearch}
                    placeholderTextColor="#94a3b8"
                />

                <View style={styles.cardGrid}>
                    {filtered.map(project => {
                        const percent = Math.round(project.progress * 100);
                        const budgetPct = project.budgetUsed / project.budgetTotal;
                        return (
                            <Pressable
                                key={project.id}
                                style={styles.card}
                                onPress={() => router.push('/diaspora/timeline')}
                            >
                                <ImageBackground
                                    source={{ uri: project.latestPhoto }}
                                    style={styles.image}
                                    imageStyle={{ borderTopLeftRadius: 18, borderTopRightRadius: 18 }}
                                >
                                    <View style={styles.overlay} />
                                    <View style={styles.statusRow}>
                                        <View style={[styles.statusPill, project.status === 'Active' ? styles.statusActive : styles.statusPending]}>
                                            <Text style={styles.statusText}>{project.status}</Text>
                                        </View>
                                        <View style={styles.progressPill}>
                                            <Ionicons name="time" size={14} color="#fff" />
                                            <Text style={styles.progressText}>{percent}%</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.cardTitle}>{project.title}</Text>
                                    <Text style={styles.cardMeta}>{project.city}</Text>
                                </ImageBackground>

                                <View style={styles.cardBody}>
                                    <View style={styles.rowBetween}>
                                        <View>
                                            <Text style={styles.label}>Provider</Text>
                                            <Text style={styles.value}>{project.provider}</Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={styles.label}>Budget</Text>
                                            <Text style={styles.value}>
                                                {project.budgetUsed.toLocaleString()} / {project.budgetTotal.toLocaleString()} CFA
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.progressBarBg}>
                                        <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
                                    </View>
                                    <View style={styles.rowBetween}>
                                        <Text style={styles.meta}>Spend {Math.round(budgetPct * 100)}% utilized</Text>
                                        <Pressable style={styles.secondaryBtn} onPress={() => router.push('/diaspora/provider/1')}>
                                            <Ionicons name="people" size={14} color="#0f172a" />
                                            <Text style={styles.secondaryText}>Team</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            </Pressable>
                        );
                    })}
                </View>

                <Pressable style={styles.primaryButton} onPress={() => router.push('/diaspora/new')}>
                    <Ionicons name="add-circle" size={20} color="#fff" />
                    <Text style={styles.primaryText}>Start a new project</Text>
                </Pressable>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f1f5f9' },
    scroll: { padding: 16, paddingBottom: 30 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    kicker: { color: '#0f172a', fontWeight: '600', fontSize: 12, letterSpacing: 0.3 },
    title: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#e2e8f0' },
    badgeText: { fontWeight: '700', color: '#0f172a', fontSize: 13 },
    search: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: '#fff',
        fontSize: 15,
        color: '#0f172a',
        marginBottom: 16,
    },
    cardGrid: { gap: 16 },
    card: {
        backgroundColor: '#fff',
        borderRadius: 18,
        shadowColor: '#0f172a',
        shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 16,
        elevation: 3,
        overflow: 'hidden',
    },
    image: { height: 170, justifyContent: 'flex-end', padding: 16 },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.35)' },
    statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
    statusActive: { backgroundColor: 'rgba(16,185,129,0.18)' },
    statusPending: { backgroundColor: 'rgba(234,179,8,0.16)' },
    statusText: { color: '#0f172a', fontWeight: '700', fontSize: 12 },
    progressPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(15,23,42,0.55)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
    progressText: { color: '#fff', fontWeight: '700', fontSize: 12 },
    cardTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
    cardMeta: { color: '#e2e8f0', marginTop: 2, fontSize: 13 },
    cardBody: { padding: 16, gap: 10 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    label: { color: '#475569', fontSize: 12, fontWeight: '600' },
    value: { color: '#0f172a', fontWeight: '800', fontSize: 15 },
    progressBarBg: { height: 10, borderRadius: 999, backgroundColor: '#e2e8f0', overflow: 'hidden', marginTop: 6 },
    progressBarFill: { height: '100%', backgroundColor: '#0ea5e9' },
    meta: { color: '#475569', fontSize: 12 },
    secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: '#e2e8f0' },
    secondaryText: { color: '#0f172a', fontWeight: '700', fontSize: 12 },
    primaryButton: { marginTop: 12, backgroundColor: '#0f172a', paddingVertical: 14, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
    primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
