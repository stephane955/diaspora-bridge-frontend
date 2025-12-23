import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// Reusing your components for consistency
import NavigationBar from '@/components/NavigationBar';
import GlassNavigation from '@/components/GlassNavigation';
import { lightFeedback, mediumFeedback } from '@/utils/haptics';

export default function WalletScreen() {
    const router = useRouter();
    const [filter, setFilter] = useState('All'); // 'All', 'In', 'Out'

    // Mock Data - In future, fetch from 'transactions' table
    const transactions = [
        { id: 1, title: 'Escrow Release: Foundation', date: 'Today, 10:23 AM', amount: '- 500,000 CFA', type: 'out', method: 'Orange Money' },
        { id: 2, title: 'Deposit via Stripe', date: 'Yesterday', amount: '+ 2,000,000 CFA', type: 'in', method: 'Visa •••• 4242' },
        { id: 3, title: 'Escrow Release: Materials', date: 'Dec 20, 2025', amount: '- 150,000 CFA', type: 'out', method: 'MTN Mobile Money' },
    ];

    return (
        <View style={styles.container}>
            <NavigationBar title="My Wallet" showBack={false} />

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* 1. The Master Card (Escrow Visualization) */}
                <LinearGradient
                    colors={['#0F172A', '#334155']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.masterCard}
                >
                    <View style={styles.cardHeader}>
                        <View>
                            <Text style={styles.cardLabel}>Escrow Balance (Safe)</Text>
                            <Text style={styles.cardAmount}>2,350,000 CFA</Text>
                            <Text style={styles.cardSub}>≈ €3,580.00 EUR</Text>
                        </View>
                        <Ionicons name="shield-checkmark" size={28} color="#4ADE80" />
                    </View>

                    <View style={styles.cardFooter}>
                        <View style={styles.cardStat}>
                            <Text style={styles.statLabel}>Released</Text>
                            <Text style={styles.statValue}>650,000 CFA</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.cardStat}>
                            <Text style={styles.statLabel}>Pending Work</Text>
                            <Text style={styles.statValue}>1,700,000 CFA</Text>
                        </View>
                    </View>
                </LinearGradient>

                {/* 2. Quick Actions */}
                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.actionBtn} onPress={mediumFeedback}>
                        <View style={[styles.iconCircle, { backgroundColor: '#F0F9FF' }]}>
                            <Ionicons name="add" size={24} color="#0EA5E9" />
                        </View>
                        <Text style={styles.actionText}>Top Up</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={mediumFeedback}>
                        <View style={[styles.iconCircle, { backgroundColor: '#F0FDF4' }]}>
                            <Ionicons name="arrow-up" size={24} color="#16A34A" />
                        </View>
                        <Text style={styles.actionText}>Release</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={mediumFeedback}>
                        <View style={[styles.iconCircle, { backgroundColor: '#FEF2F2' }]}>
                            <Ionicons name="document-text-outline" size={24} color="#DC2626" />
                        </View>
                        <Text style={styles.actionText}>Statement</Text>
                    </TouchableOpacity>
                </View>

                {/* 3. Transactions List */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Recent Activity</Text>
                    <TouchableOpacity><Text style={styles.seeAll}>Filter</Text></TouchableOpacity>
                </View>

                <View style={styles.listContainer}>
                    {transactions.map((t, i) => (
                        <TouchableOpacity key={t.id} style={styles.txnItem} onPress={lightFeedback}>
                            <View style={[styles.txnIcon, t.type === 'in' ? styles.inIcon : styles.outIcon]}>
                                <Ionicons
                                    name={t.type === 'in' ? "arrow-down" : "arrow-up"}
                                    size={18}
                                    color={t.type === 'in' ? "#16A34A" : "#DC2626"}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.txnTitle}>{t.title}</Text>
                                <Text style={styles.txnSub}>{t.date} • {t.method}</Text>
                            </View>
                            <Text style={[styles.txnAmount, t.type === 'in' ? styles.textGreen : styles.textRed]}>
                                {t.amount}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

            </ScrollView>

            {/* Floating Navigation (So they can get back to Dashboard) */}
            <GlassNavigation />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    scrollContent: { padding: 20, paddingBottom: 130 }, // Space for Glass Nav

    // Master Card
    masterCard: {
        width: '100%', height: 200, borderRadius: 24, padding: 24,
        justifyContent: 'space-between',
        shadowColor: "#0F172A", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
        marginBottom: 25,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    cardLabel: { color: '#94A3B8', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginBottom: 6 },
    cardAmount: { color: '#fff', fontSize: 32, fontWeight: '800' },
    cardSub: { color: '#CBD5E1', fontSize: 14, marginTop: 4 },

    cardFooter: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', padding: 12, borderRadius: 16 },
    cardStat: { flex: 1, alignItems: 'center' },
    divider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.2)' },
    statLabel: { color: '#94A3B8', fontSize: 11, marginBottom: 2 },
    statValue: { color: '#fff', fontWeight: '700', fontSize: 14 },

    // Actions
    actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
    actionBtn: { alignItems: 'center', gap: 8, width: '30%' },
    iconCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5 },
    actionText: { color: '#475569', fontWeight: '600', fontSize: 12 },

    // Transactions
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
    seeAll: { color: '#0EA5E9', fontWeight: '600' },

    listContainer: { backgroundColor: '#fff', borderRadius: 20, padding: 10 },
    txnItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 15 },
    txnIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    inIcon: { backgroundColor: '#F0FDF4' },
    outIcon: { backgroundColor: '#FEF2F2' },

    txnTitle: { color: '#0F172A', fontWeight: '700', fontSize: 14 },
    txnSub: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
    txnAmount: { fontWeight: '700', fontSize: 14 },
    textGreen: { color: '#16A34A' },
    textRed: { color: '#DC2626' },
});