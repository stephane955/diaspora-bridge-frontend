import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { theme } from '@/constants/theme';
import { successFeedback, mediumFeedback } from '@/utils/haptics';

type CartItem = { name?: string; quantity?: number; price?: number };

type Props = {
    cart: {
        id: string;
        items: CartItem[] | null;
        total_amount_cfa?: number;
        status: string;
        payment_status?: string;
    };
    onApproved: () => void;
};

const STATUS_COLORS = {
    pending_approval: theme.colors.warning,
    approved: theme.colors.active,
    collected: theme.colors.success,
};

export default function ClientApprovalCard({ cart, onApproved }: Props) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);

    const items: CartItem[] = Array.isArray(cart.items) ? cart.items : [];
    const total = Number(cart.total_amount_cfa) || items.reduce((s, i) => s + (i.quantity || 0) * (i.price || 0), 0);
    const statusColor = STATUS_COLORS[cart.status as keyof typeof STATUS_COLORS] || theme.colors.textMuted;

    const handlePayAndApprove = async () => {
        mediumFeedback();
        setLoading(true);
        try {
            const { error } = await supabase
                .from('project_material_carts')
                .update({
                    status: 'approved',
                    payment_status: 'paid',
                    approved_at: new Date().toISOString(),
                    approved_by: user?.id,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', cart.id);

            if (error) throw error;
            successFeedback();
            setPaymentSuccess(true);
            onApproved();
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Could not approve cart.');
        } finally {
            setLoading(false);
        }
    };

    if (paymentSuccess) {
        return (
            <View style={[styles.card, { borderColor: theme.colors.active + '80' }]}>
                <LinearGradient colors={theme.gradient.active as [string, string]} style={styles.badge}>
                    <Ionicons name="checkmark-circle" size={24} color="#fff" />
                    <Text style={styles.badgeText}>Mobile Money Payment Success</Text>
                </LinearGradient>
            </View>
        );
    }

    if (cart.status !== 'pending_approval') {
        return (
            <View style={[styles.card, { borderColor: statusColor + '60' }]}>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + '25' }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>
                        {cart.status === 'approved' ? 'Approved / Paid' : cart.status === 'collected' ? 'Collected' : cart.status}
                    </Text>
                </View>
                <Text style={styles.totalLabel}>Total: {total.toLocaleString()} CFA</Text>
            </View>
        );
    }

    return (
        <View style={[styles.card, { borderColor: theme.colors.warning + '60' }]}>
            <View style={[styles.statusBadge, { backgroundColor: theme.colors.warning + '25' }]}>
                <Ionicons name="time" size={16} color={theme.colors.warning} />
                <Text style={[styles.statusText, { color: theme.colors.warning }]}>Pending approval</Text>
            </View>

            {items.length > 0 ? (
                <View style={styles.breakdown}>
                    <Text style={styles.breakdownTitle}>Itemized breakdown</Text>
                    {items.map((item, idx) => (
                        <View key={idx} style={styles.itemRow}>
                            <Text style={styles.itemName}>{item.name || 'Item'}</Text>
                            <Text style={styles.itemMeta}>×{item.quantity ?? 1} @ {(item.price ?? 0).toLocaleString()} CFA</Text>
                            <Text style={styles.itemTotal}>{((item.quantity ?? 1) * (item.price ?? 0)).toLocaleString()} CFA</Text>
                        </View>
                    ))}
                </View>
            ) : null}

            <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{total.toLocaleString()} CFA</Text>
            </View>

            <TouchableOpacity
                style={[styles.approveBtn, loading && styles.approveBtnDisabled]}
                onPress={handlePayAndApprove}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <>
                        <Ionicons name="card-outline" size={20} color="#fff" />
                        <Text style={styles.approveBtnText}>Pay & Approve</Text>
                    </>
                )}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        padding: theme.spacing.lg,
        borderRadius: theme.radii.lg,
        borderWidth: 1,
        backgroundColor: theme.colors.surface,
        ...theme.shadow.soft,
    },
    statusBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radii.pill, marginBottom: 12, gap: 6 },
    statusText: { fontSize: 13, fontWeight: '700' },
    breakdown: { marginBottom: 12 },
    breakdownTitle: { fontSize: 12, ...theme.typography.label, color: theme.colors.textMuted, marginBottom: 8 },
    itemRow: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    itemName: { flex: 1, fontSize: 14, color: theme.colors.text },
    itemMeta: { fontSize: 12, color: theme.colors.textMuted },
    itemTotal: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    totalLabel: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
    totalValue: { fontSize: 18, fontWeight: '800', color: theme.colors.emerald },
    approveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.colors.active, paddingVertical: 16, borderRadius: theme.radii.md, ...theme.shadow.glow },
    approveBtnDisabled: { opacity: 0.7 },
    approveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
    badge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: theme.radii.md },
    badgeText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
