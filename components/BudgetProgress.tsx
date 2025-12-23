import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function BudgetProgress({ totalBudget, spent }: { totalBudget: number, spent: number }) {
    const percentage = Math.min((spent / totalBudget) * 100, 100);

    return (
        <View style={styles.container}>
            <View style={styles.row}>
                <Text style={styles.label}>Budget Used</Text>
                <Text style={styles.value}>{percentage.toFixed(1)}%</Text>
            </View>

            {/* Progress Bar */}
            <View style={styles.barBackground}>
                <View style={[styles.barFill, { width: `${percentage}%` }]} />
            </View>

            <View style={styles.row}>
                <Text style={styles.subText}>{spent.toLocaleString()} CFA spent</Text>
                <Text style={styles.subText}>of {totalBudget.toLocaleString()} CFA</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { backgroundColor: '#fff', padding: 20, borderRadius: 20, marginVertical: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    label: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
    value: { fontSize: 14, fontWeight: '800', color: '#0EA5E9' },
    barBackground: { height: 10, backgroundColor: '#F1F5F9', borderRadius: 5, overflow: 'hidden', marginBottom: 8 },
    barFill: { height: '100%', backgroundColor: '#0EA5E9' },
    subText: { fontSize: 12, color: '#64748B', fontWeight: '500' }
});