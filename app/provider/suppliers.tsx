import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';
import PremiumHeader from '@/components/PremiumHeader';
import { providerMenuItems } from '@/constants/premiumMenus';
import PulseLoader from '@/components/PulseLoader';
import { theme } from '@/constants/theme';
import { mediumFeedback } from '@/utils/haptics';
import { FLOATING_TAB_BAR_HEIGHT, PREMIUM_BG } from '@/constants/layout';

export default function SuppliersScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { t } = useLanguage();
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchSuppliers = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('suppliers')
                .select('*')
                .order('name');
            if (error) throw error;
            setSuppliers(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    React.useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

    return (
        <View style={styles.screen}>
            <PremiumHeader
                title={t('partnerSuppliersTitle')}
                subtitle={t('materialCartTitle')}
                showBack
                fallbackRoute="/provider/active"
                menuItems={providerMenuItems(router, t)}
            />
            {loading ? (
                <View style={styles.center}><PulseLoader /></View>
            ) : (
                <FlatList
                    data={suppliers}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={[styles.list, { paddingTop: insets.top + 88, paddingBottom: FLOATING_TAB_BAR_HEIGHT + 40 }]}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSuppliers(); }} />
                    }
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="storefront-outline" size={56} color={theme.colors.border} />
                            <Text style={styles.emptyTitle}>No partner suppliers yet</Text>
                            <Text style={styles.emptySub}>Verified suppliers will appear here for zero-fraud material orders.</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.card}
                            activeOpacity={0.8}
                            onPress={() => mediumFeedback()}
                        >
                            <BlurView intensity={40} tint="dark" style={styles.glassCard}>
                                <View style={styles.cardRow}>
                                    <View style={[styles.verifiedBadge, item.verified && styles.verifiedBadgeOn]}>
                                        <Ionicons name={item.verified ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={item.verified ? theme.colors.emerald : theme.colors.textMuted} />
                                        <Text style={[styles.verifiedText, item.verified && styles.verifiedTextOn]}>{item.verified ? 'Verified' : 'Partner'}</Text>
                                    </View>
                                    <Text style={styles.supplierName}>{item.name}</Text>
                                    {item.city ? (
                                        <View style={styles.cityRow}>
                                            <Ionicons name="location" size={12} color={theme.colors.textMuted} />
                                            <Text style={styles.cityText}>{item.city}</Text>
                                        </View>
                                    ) : null}
                                </View>
                            </BlurView>
                        </TouchableOpacity>
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: PREMIUM_BG },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md },
    card: { marginBottom: theme.spacing.md, borderRadius: theme.radii.lg, overflow: 'hidden', ...theme.shadow.soft },
    glassCard: { padding: theme.spacing.lg, borderRadius: theme.radii.lg, borderWidth: 1, borderColor: theme.colors.border + '80' },
    cardRow: { gap: 6 },
    verifiedBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surfaceAlt },
    verifiedBadgeOn: { backgroundColor: theme.colors.emeraldSoft + '40' },
    verifiedText: { fontSize: 11, fontWeight: '700', color: theme.colors.textMuted },
    verifiedTextOn: { color: theme.colors.emerald },
    supplierName: { fontSize: 18, ...theme.typography.title, color: theme.colors.text },
    cityRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    cityText: { fontSize: 13, color: theme.colors.textMuted },
    empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
    emptyTitle: { fontSize: 18, ...theme.typography.title, color: theme.colors.text },
    emptySub: { fontSize: 14, color: theme.colors.textMuted, textAlign: 'center', paddingHorizontal: 40 },
});
