import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, FlatList,
    Alert, RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { mediumFeedback } from '@/utils/haptics';
import PremiumHeader from '@/components/PremiumHeader';
import PremiumEmptyState from '@/components/PremiumEmptyState';
import ScreenLoader from '@/components/ScreenLoader';
import { supplierMenuItems } from '@/constants/premiumMenus';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import { useScreenOffsets } from '@/hooks/useScreenOffsets';
import {
    ALPHA,
    GOLD,
    icon as iconSize,
    radius,
    shadow,
    space,
    SUCCESS,
    SUCCESS_DEEP,
    text,
    WARNING,
    withAlpha,
} from '@/constants/design';

type CartItem = { name?: string; quantity?: number; price?: number };
type Cart = {
    id: string;
    project_id: string;
    total_amount_cfa: number;
    status: string;
    items: CartItem[] | null;
    projects?: { title?: string | null } | null;
};

const STATUS_COLORS = {
    pending_approval: WARNING,
    approved: GOLD,
    collected: SUCCESS,
};

export default function SupplierDashboard() {
    const router = useRouter();
    const { user } = useAuth();
    const { t } = useLanguage();
    const c = usePremiumColors();
    const offsets = useScreenOffsets();
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
            const mapped: Cart[] = (data || []).map((row) => {
                const projectsRaw = row.projects;
                const projects = Array.isArray(projectsRaw)
                    ? projectsRaw[0] ?? null
                    : projectsRaw;
                const itemsRaw = row.items;
                let items: CartItem[] | null = null;
                if (Array.isArray(itemsRaw)) {
                    items = itemsRaw.map((it) => {
                        if (it && typeof it === 'object' && !Array.isArray(it)) {
                            const obj = it as Record<string, unknown>;
                            return {
                                name: typeof obj.name === 'string' ? obj.name : undefined,
                                quantity: typeof obj.quantity === 'number' ? obj.quantity : undefined,
                                price: typeof obj.price === 'number' ? obj.price : undefined,
                            };
                        }
                        return {};
                    });
                }
                return {
                    id: row.id,
                    project_id: row.project_id,
                    total_amount_cfa: row.total_amount_cfa,
                    status: row.status,
                    items,
                    projects,
                };
            });
            setOrders(mapped);
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
        <View style={[styles.container, { backgroundColor: c.bg }]}>
            <PremiumHeader
                title="Supplier Dashboard"
                subtitle="Orders ready for collection"
                menuItems={supplierMenuItems(router, t)}
                onNotificationsPress={() => router.push('/notifications')}
            />

            {loading ? (
                <ScreenLoader />
            ) : (
                <FlatList
                    data={filteredOrders}
                    keyExtractor={o => o.id}
                    contentContainerStyle={offsets.content}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => { setRefreshing(true); fetchOrders(); }}
                            tintColor={c.gold}
                        />
                    }
                    ListHeaderComponent={
                        <View style={styles.filterRow}>
                            <TouchableOpacity
                                style={[
                                    styles.filterChip,
                                    { backgroundColor: c.surfaceAlt },
                                    filterReady && { backgroundColor: c.gold },
                                ]}
                                onPress={() => { setFilterReady(true); mediumFeedback(); }}
                            >
                                <Ionicons
                                    name="checkmark-circle"
                                    size={iconSize.sm}
                                    color={filterReady ? '#0A0F1A' : c.textSecondary}
                                />
                                <Text
                                    style={[
                                        styles.filterText,
                                        { color: filterReady ? '#0A0F1A' : c.textSecondary },
                                    ]}
                                >
                                    Ready for Collection
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.filterChip,
                                    { backgroundColor: c.surfaceAlt },
                                    !filterReady && { backgroundColor: c.gold },
                                ]}
                                onPress={() => { setFilterReady(false); mediumFeedback(); }}
                            >
                                <Text
                                    style={[
                                        styles.filterText,
                                        { color: !filterReady ? '#0A0F1A' : c.textSecondary },
                                    ]}
                                >
                                    All orders
                                </Text>
                            </TouchableOpacity>
                        </View>
                    }
                    ListEmptyComponent={
                        <PremiumEmptyState
                            icon="cart-outline"
                            title={filterReady ? 'No orders ready' : 'No orders yet'}
                            subtitle={
                                filterReady
                                    ? 'Approved orders will appear here.'
                                    : 'Orders will appear when providers add materials.'
                            }
                        />
                    }
                    renderItem={({ item }) => {
                        const sc = STATUS_COLORS[item.status as keyof typeof STATUS_COLORS] || c.textSecondary;
                        return (
                            <View
                                style={[
                                    styles.card,
                                    { backgroundColor: c.surface, borderColor: c.border, borderLeftColor: sc },
                                ]}
                            >
                                <View style={styles.cardHeader}>
                                    <Text style={[styles.cardTitle, { color: c.textPrimary }]}>
                                        {item.projects?.title || 'Project'} • {Number(item.total_amount_cfa || 0).toLocaleString()} CFA
                                    </Text>
                                    <View
                                        style={[
                                            styles.statusBadge,
                                            { backgroundColor: withAlpha(sc, ALPHA.medium) },
                                        ]}
                                    >
                                        <Text style={[styles.statusText, { color: sc }]}>
                                            {item.status === 'approved' ? 'Ready' : item.status}
                                        </Text>
                                    </View>
                                </View>
                                {item.status === 'approved' && (
                                    <TouchableOpacity
                                        style={styles.verifyBtn}
                                        onPress={() => {
                                            mediumFeedback();
                                            router.push({ pathname: '/supplier/scanner', params: { cartId: item.id } });
                                        }}
                                    >
                                        <Ionicons name="scan-outline" size={iconSize.sm} color="#FFFFFF" />
                                        <Text style={styles.verifyBtnText}>Verify Collection</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        );
                    }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    filterRow: { flexDirection: 'row', gap: space.xs, marginBottom: space.md },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xxs,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        borderRadius: radius.pill,
    },
    filterText: text.footnote,
    card: {
        padding: space.lg,
        borderRadius: radius.lg,
        marginBottom: space.sm,
        borderWidth: 1,
        borderLeftWidth: 4,
        ...shadow.card,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: space.sm,
        gap: space.xs,
    },
    cardTitle: { ...text.body, flex: 1 },
    statusBadge: {
        paddingHorizontal: space.xs,
        paddingVertical: space.xxs,
        borderRadius: radius.pill,
    },
    statusText: { ...text.caption, fontWeight: '800' },
    verifyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.xs,
        backgroundColor: SUCCESS_DEEP,
        paddingVertical: space.sm,
        borderRadius: radius.lg,
    },
    verifyBtnText: { color: '#FFFFFF', ...text.footnote, fontWeight: '800' },
});
