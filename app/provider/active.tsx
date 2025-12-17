import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// 1. DEFINE THE SHAPE OF YOUR DATA
// This tells TypeScript exactly what "item" contains.
type Project = {
    id: string;
    client: string;
    project: string;
    status: string;
    location: string;
    lastUpdate: string;
};

// 2. APPLY THE TYPE TO YOUR DATA
const activeProjects: Project[] = [
    {
        id: '1',
        client: 'Jean-Pierre',
        project: 'Duplex Foundation',
        status: 'In Progress',
        location: 'Douala',
        lastUpdate: '2 days ago'
    },
    {
        id: '2',
        client: 'Marie K.',
        project: 'Roofing Phase 1',
        status: 'Pending',
        location: 'Yaoundé',
        lastUpdate: 'Just now'
    },
];

export default function ActiveProjects() {
    const router = useRouter();

    const EmptyState = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="briefcase-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No Active Sites</Text>
            <Text style={styles.emptySub}>
                When you accept a job request, it will appear here so you can post updates.
            </Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={activeProjects}
                keyExtractor={(item) => item.id}
                contentContainerStyle={activeProjects.length === 0 ? styles.centerContent : styles.listContent}
                ListEmptyComponent={EmptyState}
                // TypeScript now knows "item" is a Project, so no errors here.
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        {/* Header: Project & Status */}
                        <View style={styles.cardHeader}>
                            <View>
                                <Text style={styles.projectTitle}>{item.project}</Text>
                                <View style={styles.metaRow}>
                                    <View style={styles.metaItem}>
                                        <Ionicons name="location-sharp" size={12} color="#888" />
                                        <Text style={styles.metaText}>{item.location}</Text>
                                    </View>
                                    {/* Time Context */}
                                    <View style={[styles.metaItem, { marginLeft: 12 }]}>
                                        <Ionicons name="time-outline" size={12} color="#888" />
                                        <Text style={styles.metaText}>{item.lastUpdate}</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Status Badge */}
                            <View style={[
                                styles.badge,
                                item.status === 'In Progress' ? styles.badgeActive : styles.badgePending
                            ]}>
                                <Text style={[
                                    styles.badgeText,
                                    item.status === 'In Progress' ? styles.textActive : styles.textPending
                                ]}>
                                    {item.status}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        {/* Footer: Client & Action */}
                        <View style={styles.cardFooter}>
                            {/* Client Avatar Look */}
                            <View style={styles.clientSection}>
                                <View style={styles.avatarCircle}>
                                    <Text style={styles.avatarText}>{item.client.charAt(0)}</Text>
                                </View>
                                <View>
                                    <Text style={styles.label}>Client</Text>
                                    <Text style={styles.clientName}>{item.client}</Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={styles.uploadBtn}
                                activeOpacity={0.8}
                                onPress={() => router.push('/provider/post_update')}
                            >
                                <Ionicons name="camera" size={20} color="#fff" style={{ marginRight: 6 }} />
                                <Text style={styles.btnText}>Post Update</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f4f6f8' },
    listContent: { padding: 20 },
    centerContent: { flex: 1, justifyContent: 'center', padding: 20 },

    emptyContainer: { alignItems: 'center', justifyContent: 'center' },
    emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginTop: 15 },
    emptySub: { textAlign: 'center', color: '#666', marginTop: 8, lineHeight: 22 },

    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.03)'
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    projectTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },

    metaRow: { flexDirection: 'row', alignItems: 'center' },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { color: '#888', fontSize: 13 },

    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    badgeActive: { backgroundColor: '#E8F5E9' },
    badgePending: { backgroundColor: '#FFF3E0' },
    badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    textActive: { color: '#2E7D32' },
    textPending: { color: '#EF6C00' },

    divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 15 },

    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

    clientSection: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatarCircle: {
        width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0f0f0',
        alignItems: 'center', justifyContent: 'center'
    },
    avatarText: { fontSize: 14, fontWeight: 'bold', color: '#666' },

    label: { fontSize: 10, color: '#999', textTransform: 'uppercase' },
    clientName: { fontSize: 14, fontWeight: '600', color: '#333' },

    uploadBtn: {
        backgroundColor: '#111',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 30,
    },
    btnText: { color: '#fff', fontSize: 13, fontWeight: '600' }
});