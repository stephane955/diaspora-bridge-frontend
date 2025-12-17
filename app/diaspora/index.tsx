// Location: app/diaspora/index.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// 1. Clean Data Structure
const FAKE_PROVIDERS = [
    { id: '1', name: 'Buea Construction Ltd', city: 'Buea', service: 'Construction', rating: 4.8 },
    { id: '2', name: 'Yaoundé ElectroFix', city: 'Yaoundé', service: 'Electrician', rating: 4.5 },
    { id: '3', name: 'Douala Plumbing Co', city: 'Douala', service: 'Plumber', rating: 4.2 },
    { id: '4', name: 'Bamenda Tutor Sarah', city: 'Bamenda', service: 'Education', rating: 4.9 },
    { id: '5', name: 'Legal Connect 237', city: 'Yaoundé', service: 'Legal', rating: 4.4 },
];

export default function DiasporaHome() {
    const [search, setSearch] = useState('');
    const router = useRouter();

    const filtered = FAKE_PROVIDERS.filter(
        p =>
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.city.toLowerCase().includes(search.toLowerCase()) ||
            p.service.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <View style={styles.container}>
            {/* HEADER ROW with "My Projects" Button */}
            <View style={styles.headerRow}>
                <Text style={styles.title}>Find Providers</Text>
                <TouchableOpacity onPress={() => router.push('/diaspora/projects')}>
                    <Text style={styles.myProjectsLink}>My Projects ›</Text>
                </TouchableOpacity>
            </View>

            <TextInput
                style={styles.search}
                placeholder="Search by city or service..."
                value={search}
                onChangeText={setSearch}
            />

            <FlatList
                data={filtered}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.card}
                        onPress={() => router.push(`/diaspora/provider/${item.id}` as any)}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                            <Text style={styles.name}>{item.name}</Text>
                        </View>
                        <Text style={styles.meta}>{item.service} • {item.city}</Text>
                        <Text style={styles.rating}>⭐ {item.rating}</Text>
                    </TouchableOpacity>
                )}
                contentContainerStyle={{ paddingBottom: 20 }}
            />

            <TouchableOpacity style={styles.newProjectBtn} onPress={() => router.push('/diaspora/new')}>
                <Text style={styles.newProjectText}>+ New project</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: '#fff' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    title: { fontSize: 22, fontWeight: '700' },
    myProjectsLink: { color: '#2563eb', fontWeight: '600', fontSize: 14 },

    search: {
        borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
        paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14,
    },
    card: {
        backgroundColor: '#f8fafc', borderRadius: 12, padding: 14,
        marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0',
    },
    name: { fontSize: 16, fontWeight: '600' },
    meta: { color: '#475569', marginTop: 2 },
    rating: { marginTop: 6, color: '#f97316', fontWeight: '500' },
    newProjectBtn: {
        backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 999,
        alignItems: 'center', position: 'absolute', bottom: 20, right: 20, left: 20,
    },
    newProjectText: { color: '#fff', fontWeight: '600' },
});