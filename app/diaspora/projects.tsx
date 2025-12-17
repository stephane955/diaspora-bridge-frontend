import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function MyProjectsScreen() {
    const router = useRouter();

    return (
        <View style={styles.container}>
            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Projects</Text>
                <View style={{ width: 40 }} /> {/* Spacer for balance */}
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* PROJECT CARD 1 */}
                <TouchableOpacity
                    style={styles.card}
                    activeOpacity={0.9}
                    onPress={() => router.push('/diaspora/timeline')}
                >
                    <View style={styles.cardHeader}>
                        <View style={styles.statusBadge}>
                            <Text style={styles.statusText}>IN PROGRESS</Text>
                        </View>
                        <Ionicons name="ellipsis-horizontal" size={20} color="#999" />
                    </View>

                    <View style={styles.projectInfo}>
                        <View style={styles.iconBox}>
                            <Ionicons name="home" size={24} color="#007AFF" />
                        </View>
                        <View>
                            <Text style={styles.projectTitle}>Duplex Foundation</Text>
                            <Text style={styles.projectLocation}>Bonapriso, Douala</Text>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.cardFooter}>
                        <View style={styles.footerItem}>
                            <Text style={styles.label}>Provider</Text>
                            <Text style={styles.value}>Stephane M.</Text>
                        </View>
                        <View style={styles.footerItem}>
                            <Text style={styles.label}>Next Milestone</Text>
                            <Text style={styles.value}>Pouring Concrete</Text>
                        </View>
                    </View>
                </TouchableOpacity>

                {/* ADD NEW PROJECT BUTTON (Visual only for now) */}
                <TouchableOpacity style={styles.addBtn}>
                    <Ionicons name="add" size={24} color="#ccc" />
                    <Text style={styles.addText}>Start New Project</Text>
                </TouchableOpacity>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa' },

    // Header
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: '#fff' },
    backBtn: { padding: 8, backgroundColor: '#f0f0f0', borderRadius: 20 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },

    content: { padding: 20 },

    // Card Styles
    card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 20, shadowColor: "#000", shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },

    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    statusBadge: { backgroundColor: '#E3F2FD', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusText: { color: '#007AFF', fontSize: 10, fontWeight: 'bold' },

    projectInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    iconBox: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#F5F5F7', alignItems: 'center', justifyContent: 'center', marginRight: 15 },
    projectTitle: { fontSize: 18, fontWeight: 'bold', color: '#000' },
    projectLocation: { fontSize: 14, color: '#666', marginTop: 2 },

    divider: { height: 1, backgroundColor: '#f0f0f0', marginBottom: 15 },

    cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
    footerItem: {},
    label: { fontSize: 11, color: '#999', marginBottom: 4 },
    value: { fontSize: 14, fontWeight: '600', color: '#333' },

    // Add Button
    addBtn: { borderWidth: 1, borderColor: '#e0e0e0', borderStyle: 'dashed', borderRadius: 20, height: 80, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
    addText: { color: '#999', fontWeight: '600' }
});