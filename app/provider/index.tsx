import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function ProviderDashboard() {
    return (
        <ScrollView style={styles.container}>
            {/* Motivation Card */}
            <View style={styles.earningsCard}>
                <Text style={styles.label}>This Month's Earnings</Text>
                <Text style={styles.amount}>150,000 CFA</Text>
                <Text style={styles.subtext}>+25% from last month 🚀</Text>
            </View>

            {/* Quick Stats Grid */}
            <Text style={styles.sectionTitle}>Overview</Text>
            <View style={styles.statsContainer}>
                <View style={styles.statBox}>
                    <Text style={styles.statNumber}>4</Text>
                    <Text style={styles.statLabel}>Active Jobs</Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={styles.statNumber}>4.9</Text>
                    <Text style={styles.statLabel}>Rating ⭐</Text>
                </View>
            </View>

            {/* Recent Activity placeholder */}
            <View style={styles.recentSection}>
                <Text style={styles.sectionTitle}>Recent Payouts</Text>
                <View style={styles.listItem}>
                    <Text style={styles.listText}>Payment for Duplex (Phase 1)</Text>
                    <Text style={styles.listPrice}>+50,000 CFA</Text>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5', padding: 20 },
    earningsCard: {
        backgroundColor: '#4CAF50', // Money Green
        padding: 30,
        borderRadius: 20,
        alignItems: 'center',
        marginBottom: 25,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
    label: { color: 'rgba(255,255,255,0.9)', fontSize: 16, marginBottom: 5 },
    amount: { color: '#fff', fontSize: 36, fontWeight: 'bold' },
    subtext: { color: '#E8F5E9', fontWeight: '600', marginTop: 5 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 10 },
    statsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
    statBox: {
        backgroundColor: '#fff',
        width: '48%',
        padding: 20,
        borderRadius: 15,
        alignItems: 'center',
        elevation: 2
    },
    statNumber: { fontSize: 24, fontWeight: 'bold', color: '#333' },
    statLabel: { color: '#666', marginTop: 5 },
    recentSection: { marginTop: 0 },
    listItem: { backgroundColor: '#fff', padding: 15, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between' },
    listText: { color: '#333' },
    listPrice: { color: '#4CAF50', fontWeight: 'bold' }
});