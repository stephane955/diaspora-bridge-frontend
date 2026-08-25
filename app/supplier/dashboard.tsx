import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, FlatList,
    ActivityIndicator, Alert, RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { theme } from '@/constants/theme';
import { mediumFeedback } from '@/utils/haptics';

type CartItem = { name?: string; quantity?: number; price?: number };
type Cart = {
    id: string;
    project_id: string;
    total_amount_cfa: number;
    status: string;
    items: CartItem[] | null;
    projects?: { title?: string } | null;
};

const STATUS_COLORS = {
    pending_approval: theme.colors.warning,
    approved: theme.colors.active,
    collected: theme.colors.success,
};

export default function SupplierDashboard() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { user } = useAuth();
    const { t } = useLanguage();
    const [orders, setOrders] = useState<Cart[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filterReady, setFilterReady] = useState(true);

    const fetchOrders = useCallback(async () => {
        if (!user?.id) return;
        try {
            const { data, error } = await supabase
                .from('project_material_carts')
                .select('id, project_id, total_amount_cfa, status, items, projects(title)')
                .eq('supplier_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (e: any) {
            Alert.alert(t('error'), e.message || t('couldNotLoadOrders'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user?.id, t]);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    const filteredOrders = filterReady
        ? orders.filter(o => o.status === 'approved')
        : orders;

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <LinearGradient colors={theme.gradient.hero as [string, string]} style={styles.header}>
                <Text style={styles.headerTitle}>Supplier Dashboard</Text>
                <Text style={styles.headerSub}>Orders ready for collection</Text>
            </LinearGradient>

            <View style={styles.filterRow}>
                <TouchableOpacity
                    style={[styles.filterChip, filterReady && styles.filterChipActive]}
                    onPress={() => { setFilterReady(true); mediumFeedback(); }}
                >
                    <Ionicons name="checkmark-circle" size={18} color={filterReady ? '#fff' : theme.colors.textMuted} />
                    <Text style={[styles.filterText, filterReady && styles.filterTextActive]}>Ready for Collection</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterChip, !filterReady && styles.filterChipActive]}
                    onPress={() => { setFilterReady(false); mediumFeedback(); }}
                >
                    <Text style={[styles.filterText, !filterReady && styles.filterTextActive]}>All orders</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.active} /></View>
            ) : (
                <FlatList
                    data={filteredOrders}
                    keyExtractor={o => o.id}
                    contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrders(); }} tintColor={theme.colors.active} />}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="cart-outline" size={56} color={theme.colors.textMuted} />
                            <Text style={styles.emptyTitle}>{filterReady ? 'No orders ready' : 'No orders yet'}</Text>
                            <Text style={styles.emptySub}>{filterReady ? 'Approved orders will appear here.' : 'Orders will appear when providers add materials.'}</Text>
                        </View>
                    }
                    renderItem={({ item }) => {
                        const sc = STATUS_COLORS[item.status as keyof typeof STATUS_COLORS] || theme.colors.textMuted;
                        return (
                            <BlurView intensity={25} tint="light" style={[styles.card, { borderLeftColor: sc }]}>
                                <View style={styles.cardHeader}>
                                    <Text style={styles.cardTitle}>{item.projects?.title || 'Project'} • {Number(item.total_amount_cfa || 0).toLocaleString()} CFA</Text>
                                    <View style={[styles.statusBadge, { backgroundColor: sc + '25' }]}>
                                        <Text style={[styles.statusText, { color: sc }]}>{item.status === 'approved' ? 'Ready' : item.status}</Text>
                                    </View>
                                </View>
                                {item.status === 'approved' && (
                                    <TouchableOpacity
                                        style={styles.verifyBtn}
                                        onPress={() => { mediumFeedback(); router.push({ pathname: '/supplier/scanner', params: { cartId: item.id } }); }}
                                    >
                                        <Ionicons name="scan-outline" size={20} color="#fff" />
                                        <Text style={styles.verifyBtnText}>Verify Collection</Text>
                                    </TouchableOpacity>
                                )}
                            </BlurView>
                        );
                    }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { paddingHorizontal: theme.spacing.lg, paddingTop: 20, paddingBottom: 28, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
    headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
    headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
    filterRow: { flexDirection: 'row', padding: theme.spacing.md, gap: 8 },
    filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surfaceAlt },
    filterChipActive: { backgroundColor: theme.colors.active },
    filterText: { fontSize: 14, fontWeight: '600', color: theme.colors.textMuted },
    filterTextActive: { color: '#fff' },
    list: { padding: theme.spacing.lg },
    card: { padding: theme.spacing.lg, borderRadius: theme.radii.lg, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: theme.colors.border, backgroundColor: theme.colors.surface, ...theme.shadow.soft },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text, flex: 1 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radii.pill },
    statusText: { fontSize: 12, fontWeight: '700' },
    verifyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.colors.emerald, paddingVertical: 12, borderRadius: theme.radii.md, ...theme.shadow.glowEmerald },
    verifyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    empty: { alignItems: 'center', paddingVertical: 60 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text, marginTop: 12 },
    emptySub: { fontSize: 14, color: theme.colors.textMuted, marginTop: 8 },
});
