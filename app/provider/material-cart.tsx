import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
    Alert, ActivityIndicator
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import NavigationBar from '@/components/NavigationBar';
import ScreenGradient from '@/components/ScreenGradient';
import { theme } from '@/constants/theme';
import { mediumFeedback, successFeedback } from '@/utils/haptics';

export default function MaterialCartScreen() {
    const { projectId } = useLocalSearchParams<{ projectId: string }>();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { user } = useAuth();

    const [cart, setCart] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [laborAmount, setLaborAmount] = useState('');
    const [newItemSupplier, setNewItemSupplier] = useState('');
    const [newItemDesc, setNewItemDesc] = useState('');
    const [newItemQty, setNewItemQty] = useState('1');
    const [newItemPrice, setNewItemPrice] = useState('');

    const pid = typeof projectId === 'string' ? projectId : projectId?.[0];

    const fetchData = useCallback(async () => {
        if (!pid || !user?.id) return;
        try {
            const { data: cartData } = await supabase
                .from('project_material_carts')
                .select('*')
                .eq('project_id', pid)
                .maybeSingle();
            setCart(cartData || null);

            if (cartData?.id) {
                const { data: itemsData } = await supabase
                    .from('project_material_cart_items')
                    .select('*, suppliers:supplier_id(name)')
                    .eq('cart_id', cartData.id);
                setItems(itemsData || []);
            } else {
                setItems([]);
            }

            const { data: supData } = await supabase.from('suppliers').select('*').order('name');
            setSuppliers(supData || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [pid, user?.id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const totalMaterials = items.reduce((s, i) => s + (Number(i.total_cfa) || Number(i.quantity) * Number(i.unit_price_cfa) || 0), 0);

    const ensureCart = async () => {
        if (cart?.id) return cart.id;
        const { data: inserted, error } = await supabase
            .from('project_material_carts')
            .insert({ project_id: pid, provider_id: user?.id, total_materials_cfa: 0 })
            .select('id')
            .single();
        if (error) throw error;
        setCart(inserted);
        return inserted.id;
    };

    const addItem = async () => {
        const supplierId = newItemSupplier;
        const qty = parseFloat(newItemQty) || 1;
        const price = parseFloat(newItemPrice) || 0;
        if (!supplierId || !newItemDesc.trim() || price <= 0) {
            Alert.alert('Missing fields', 'Select supplier, enter description and unit price.');
            return;
        }
        setSaving(true);
        try {
            const cid = await ensureCart();
            await supabase.from('project_material_cart_items').insert({
                cart_id: cid,
                supplier_id: supplierId,
                description: newItemDesc.trim(),
                quantity: qty,
                unit_price_cfa: price,
            });
            setNewItemDesc('');
            setNewItemQty('1');
            setNewItemPrice('');
            successFeedback();
            fetchData();
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setSaving(false);
        }
    };

    const submitForApproval = async () => {
        if (!cart?.id || items.length === 0) {
            Alert.alert('Empty cart', 'Add at least one material item.');
            return;
        }
        const labor = laborAmount.trim() ? parseFloat(laborAmount) : null;
        if (labor != null && labor < 0) {
            Alert.alert('Invalid labor', 'Labor amount must be positive.');
            return;
        }
        setSaving(true);
        try {
            await supabase
                .from('project_material_carts')
                .update({
                    status: 'pending_approval',
                    total_materials_cfa: totalMaterials,
                    labor_amount_cfa: labor,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', cart.id);
            successFeedback();
            Alert.alert('Sent', 'Material cart sent for client approval. Funds will go to suppliers (materials) and you (labor) once approved.');
            fetchData();
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <ScreenGradient>
                <NavigationBar title="Material Cart" showBack dynamicColor={theme.colors.emerald} />
                <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.emerald} /></View>
            </ScreenGradient>
        );
    }

    const canEdit = cart?.status === 'draft' || !cart;
    const isPending = cart?.status === 'pending_approval';

    return (
        <ScreenGradient>
            <NavigationBar title="Material Cart" showBack dynamicColor={theme.colors.emerald} />
            <ScrollView
                contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
                keyboardShouldPersistTaps="handled"
            >
                <BlurView intensity={30} tint="dark" style={styles.glass}>
                    <Text style={styles.glassTitle}>Zero-fraud materials</Text>
                    <Text style={styles.glassSub}>Client pays suppliers directly; you receive labor only after approval.</Text>
                </BlurView>

                {items.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Items</Text>
                        {items.map((i) => (
                            <View key={i.id} style={styles.itemRow}>
                                <Text style={styles.itemDesc}>{i.description}</Text>
                                <Text style={styles.itemMeta}>×{i.quantity} @ {Number(i.unit_price_cfa).toLocaleString()} CFA</Text>
                                <Text style={styles.itemTotal}>{((Number(i.quantity) || 0) * (Number(i.unit_price_cfa) || 0)).toLocaleString()} CFA</Text>
                            </View>
                        ))}
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Materials total</Text>
                            <Text style={styles.totalValue}>{totalMaterials.toLocaleString()} CFA</Text>
                        </View>
                    </View>
                )}

                {canEdit && (
                    <>
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Add item</Text>
                            <Text style={styles.label}>Supplier</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                                {suppliers.map((s) => (
                                    <TouchableOpacity
                                        key={s.id}
                                        style={[styles.chip, newItemSupplier === s.id && styles.chipActive]}
                                        onPress={() => { setNewItemSupplier(s.id); mediumFeedback(); }}
                                    >
                                        <Text style={[styles.chipText, newItemSupplier === s.id && styles.chipTextActive]}>{s.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            <Text style={styles.label}>Description</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Cement bags"
                                value={newItemDesc}
                                onChangeText={setNewItemDesc}
                                placeholderTextColor={theme.colors.textMuted}
                            />
                            <View style={styles.row}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Qty</Text>
                                    <TextInput style={styles.input} keyboardType="numeric" value={newItemQty} onChangeText={setNewItemQty} placeholderTextColor={theme.colors.textMuted} />
                                </View>
                                <View style={{ flex: 1, marginLeft: theme.spacing.sm }}>
                                    <Text style={styles.label}>Unit price (CFA)</Text>
                                    <TextInput style={styles.input} keyboardType="numeric" value={newItemPrice} onChangeText={setNewItemPrice} placeholder="0" placeholderTextColor={theme.colors.textMuted} />
                                </View>
                            </View>
                            <TouchableOpacity style={styles.addBtn} onPress={addItem} disabled={saving}>
                                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.addBtnText}>Add item</Text>}
                            </TouchableOpacity>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.label}>Labor amount (CFA) – you receive this after approval</Text>
                            <TextInput
                                style={styles.input}
                                keyboardType="numeric"
                                value={laborAmount}
                                onChangeText={setLaborAmount}
                                placeholder="e.g. 50000"
                                placeholderTextColor={theme.colors.textMuted}
                            />
                        </View>

                        {items.length > 0 && (
                            <TouchableOpacity style={styles.submitBtn} onPress={submitForApproval} disabled={saving}>
                                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit for client approval</Text>}
                            </TouchableOpacity>
                        )}
                    </>
                )}

                {isPending && (
                    <View style={styles.pendingBadge}>
                        <Ionicons name="time" size={18} color={theme.colors.warning} />
                        <Text style={styles.pendingText}>Pending client approval</Text>
                    </View>
                )}
            </ScrollView>
        </ScreenGradient>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { padding: theme.spacing.lg },
    glass: { padding: theme.spacing.lg, borderRadius: theme.radii.lg, marginBottom: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border + '80' },
    glassTitle: { fontSize: 18, ...theme.typography.title, color: theme.colors.text },
    glassSub: { fontSize: 13, color: theme.colors.textMuted, marginTop: 4 },
    section: { marginBottom: theme.spacing.xl },
    sectionTitle: { fontSize: 16, ...theme.typography.label, color: theme.colors.textMuted, marginBottom: theme.spacing.sm },
    itemRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    itemDesc: { flex: 1, fontSize: 14, color: theme.colors.text },
    itemMeta: { fontSize: 12, color: theme.colors.textMuted },
    itemTotal: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8 },
    totalLabel: { fontSize: 14, fontWeight: '700', color: theme.colors.textMuted },
    totalValue: { fontSize: 18, fontWeight: '800', color: theme.colors.emerald },
    label: { fontSize: 12, ...theme.typography.label, color: theme.colors.textMuted, marginBottom: 6 },
    input: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.md, padding: 14, fontSize: 16, color: theme.colors.text },
    row: { flexDirection: 'row' },
    chipScroll: { marginBottom: 12 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surfaceAlt, marginRight: 8 },
    chipActive: { backgroundColor: theme.colors.emeraldSoft, borderWidth: 1, borderColor: theme.colors.emerald },
    chipText: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted },
    chipTextActive: { color: theme.colors.emerald },
    addBtn: { backgroundColor: theme.colors.emerald, paddingVertical: 14, borderRadius: theme.radii.md, alignItems: 'center', marginTop: 12 },
    addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    submitBtn: { backgroundColor: theme.colors.primary, paddingVertical: 16, borderRadius: theme.radii.lg, alignItems: 'center', ...theme.shadow.glowEmerald },
    submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
    pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: theme.spacing.md, backgroundColor: theme.colors.warning + '20', borderRadius: theme.radii.md },
    pendingText: { fontSize: 14, fontWeight: '700', color: theme.colors.warning },
});
