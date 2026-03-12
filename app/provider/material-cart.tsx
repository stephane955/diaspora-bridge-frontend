import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
    Alert, ActivityIndicator, Modal, FlatList, Image
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import NavigationBar from '@/components/NavigationBar';
import ScreenGradient from '@/components/ScreenGradient';
import { theme } from '@/constants/theme';
import { mediumFeedback, successFeedback } from '@/utils/haptics';

type CartItem = { id: string; name: string; quantity: number; price: number };
type SupplierProfile = { id: string; full_name: string; avatar_url?: string; city?: string };

export default function BuildCartScreen() {
    const { projectId } = useLocalSearchParams<{ projectId: string }>();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { user } = useAuth();

    const [items, setItems] = useState<CartItem[]>([]);
    const [supplierId, setSupplierId] = useState<string | null>(null);
    const [supplierName, setSupplierName] = useState<string>('');
    const [suppliers, setSuppliers] = useState<SupplierProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showSupplierModal, setShowSupplierModal] = useState(false);
    const [supplierSearch, setSupplierSearch] = useState('');
    const [submittedCartId, setSubmittedCartId] = useState<string | null>(null);

    const pid = typeof projectId === 'string' ? projectId : projectId?.[0];

    const totalAmount = items.reduce((s, i) => s + i.quantity * i.price, 0);

    const fetchSuppliers = useCallback(async () => {
        const { data } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, city')
            .eq('role', 'supplier')
            .not('full_name', 'is', null);
        setSuppliers(data || []);
    }, []);

    useEffect(() => {
        fetchSuppliers();
        setLoading(false);
    }, [fetchSuppliers]);

    const addItem = () => {
        setItems(prev => [...prev, { id: Date.now().toString(), name: '', quantity: 1, price: 0 }]);
        mediumFeedback();
    };

    const updateItem = (id: string, field: keyof CartItem, value: string | number) => {
        setItems(prev => prev.map(i => {
            if (i.id !== id) return i;
            if (field === 'name') return { ...i, name: String(value) };
            if (field === 'quantity') return { ...i, quantity: Number(value) || 1 };
            if (field === 'price') return { ...i, price: Number(value) || 0 };
            return i;
        }));
    };

    const removeItem = (id: string) => {
        setItems(prev => prev.filter(i => i.id !== id));
        mediumFeedback();
    };

    const selectSupplier = (s: SupplierProfile) => {
        setSupplierId(s.id);
        setSupplierName(s.full_name || 'Unknown');
        setShowSupplierModal(false);
        setSupplierSearch('');
        successFeedback();
    };

    const handleSubmit = async () => {
        const validItems = items.filter(i => i.name.trim() && i.quantity > 0 && i.price >= 0);
        if (validItems.length === 0) {
            Alert.alert('Empty cart', 'Add at least one item with name, quantity, and price.');
            return;
        }
        if (!supplierId) {
            Alert.alert('Select store', 'Choose a Verified Store.');
            return;
        }
        if (!pid || !user?.id) {
            Alert.alert('Error', 'Missing project or user.');
            return;
        }

        setSaving(true);
        try {
            const payload = validItems.map(({ name, quantity, price }) => ({ name, quantity, price }));
            const { data, error } = await supabase
                .from('project_material_carts')
                .insert({
                    project_id: pid,
                    provider_id: user.id,
                    supplier_id: supplierId,
                    items: payload,
                    total_amount_cfa: totalAmount,
                    status: 'pending_approval',
                    payment_status: 'unpaid',
                    updated_at: new Date().toISOString(),
                })
                .select('id')
                .single();

            if (error) throw error;
            successFeedback();
            setSubmittedCartId(data.id);
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to submit cart.');
        } finally {
            setSaving(false);
        }
    };

    const filteredSuppliers = supplierSearch.trim()
        ? suppliers.filter(s => (s.full_name || '').toLowerCase().includes(supplierSearch.toLowerCase()))
        : suppliers;

    if (loading) {
        return (
            <ScreenGradient>
                <NavigationBar title="Build Material Cart" showBack dynamicColor={theme.colors.emerald} />
                <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.emerald} /></View>
            </ScreenGradient>
        );
    }

    if (submittedCartId) {
        return (
            <ScreenGradient>
                <NavigationBar title="Success" showBack onMenuPress={() => router.replace('/provider')} dynamicColor={theme.colors.emerald} />
                <LinearGradient colors={theme.gradient.emerald as [string, string]} style={styles.successCard}>
                    <View style={styles.successIcon}><Ionicons name="checkmark-circle" size={64} color="#fff" /></View>
                    <Text style={styles.successTitle}>Cart submitted</Text>
                    <Text style={styles.successSub}>Show this QR to the supplier for collection verification</Text>
                    <View style={styles.qrWrapper}>
                        <BlurView intensity={20} tint="light" style={styles.qrBlur}>
                            <QRCode value={submittedCartId} size={180} backgroundColor="transparent" color="#0F172A" />
                        </BlurView>
                    </View>
                    <Text style={styles.cartIdLabel}>Cart ID</Text>
                    <Text style={styles.cartIdValue} selectable>{submittedCartId}</Text>
                </LinearGradient>
            </ScreenGradient>
        );
    }

    return (
        <ScreenGradient>
            <NavigationBar title="Build Material Cart" showBack dynamicColor={theme.colors.emerald} />
            <ScrollView
                contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 120 }]}
                keyboardShouldPersistTaps="handled"
            >
                <BlurView intensity={30} tint="dark" style={styles.glass}>
                    <Text style={styles.glassTitle}>Material cart</Text>
                    <Text style={styles.glassSub}>Add items, select a verified store, and submit for client approval.</Text>
                </BlurView>

                <TouchableOpacity style={styles.supplierSelector} onPress={() => setShowSupplierModal(true)}>
                    <Ionicons name="storefront-outline" size={22} color={theme.colors.textMuted} />
                    <Text style={[styles.supplierText, !supplierId && styles.supplierPlaceholder]}>
                        {supplierName || 'Select Verified Store'}
                    </Text>
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
                </TouchableOpacity>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Items</Text>
                        <TouchableOpacity onPress={addItem} style={styles.addItemBtn}>
                            <Ionicons name="add-circle-outline" size={22} color={theme.colors.emerald} />
                            <Text style={styles.addItemText}>Add</Text>
                        </TouchableOpacity>
                    </View>
                    {items.map((item) => (
                        <View key={item.id} style={styles.itemRow}>
                            <TextInput
                                style={[styles.itemInput, { flex: 2 }]}
                                placeholder="Name"
                                value={item.name}
                                onChangeText={v => updateItem(item.id, 'name', v)}
                                placeholderTextColor={theme.colors.textMuted}
                            />
                            <TextInput
                                style={[styles.itemInput, { width: 56 }]}
                                placeholder="Qty"
                                keyboardType="numeric"
                                value={String(item.quantity)}
                                onChangeText={v => updateItem(item.id, 'quantity', v)}
                                placeholderTextColor={theme.colors.textMuted}
                            />
                            <TextInput
                                style={[styles.itemInput, { flex: 1 }]}
                                placeholder="Price"
                                keyboardType="numeric"
                                value={item.price ? String(item.price) : ''}
                                onChangeText={v => updateItem(item.id, 'price', v)}
                                placeholderTextColor={theme.colors.textMuted}
                            />
                            <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.removeBtn}>
                                <Ionicons name="close-circle" size={24} color={theme.colors.danger} />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>

                <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total (CFA)</Text>
                    <Text style={styles.totalValue}>{totalAmount.toLocaleString()}</Text>
                </View>

                <TouchableOpacity style={[styles.submitBtn, saving && styles.submitDisabled]} onPress={handleSubmit} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit for approval</Text>}
                </TouchableOpacity>
            </ScrollView>

            <Modal visible={showSupplierModal} animationType="slide" transparent>
                <View style={[styles.modalOverlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
                    <BlurView intensity={60} tint="dark" style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Verified Stores</Text>
                            <TouchableOpacity onPress={() => setShowSupplierModal(false)}><Ionicons name="close" size={28} color="#fff" /></TouchableOpacity>
                        </View>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search supplier..."
                            value={supplierSearch}
                            onChangeText={setSupplierSearch}
                            placeholderTextColor={theme.colors.textMuted}
                        />
                        <FlatList
                            data={filteredSuppliers}
                            keyExtractor={s => s.id}
                            ListEmptyComponent={<Text style={styles.emptySuppliers}>No verified stores found. Set profiles.role = 'supplier' to add suppliers.</Text>}
                            renderItem={({ item: s }) => (
                                <TouchableOpacity style={styles.supplierRow} onPress={() => selectSupplier(s)}>
                                    <Image source={{ uri: s.avatar_url || 'https://i.pravatar.cc/80' }} style={styles.supplierAvatar} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.supplierRowName}>{s.full_name || 'Supplier'}</Text>
                                        {s.city && <Text style={styles.supplierRowCity}>{s.city}</Text>}
                                    </View>
                                    {supplierId === s.id && <Ionicons name="checkmark-circle" size={24} color={theme.colors.emerald} />}
                                </TouchableOpacity>
                            )}
                        />
                    </BlurView>
                </View>
            </Modal>
        </ScreenGradient>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { padding: theme.spacing.lg },
    glass: { padding: theme.spacing.lg, borderRadius: theme.radii.lg, marginBottom: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border + '80' },
    glassTitle: { fontSize: 18, ...theme.typography.title, color: theme.colors.text },
    glassSub: { fontSize: 13, color: theme.colors.textMuted, marginTop: 4 },
    supplierSelector: { flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md, backgroundColor: theme.colors.surface, borderRadius: theme.radii.md, marginBottom: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border },
    supplierText: { flex: 1, fontSize: 16, color: theme.colors.text },
    supplierPlaceholder: { color: theme.colors.textMuted },
    section: { marginBottom: theme.spacing.lg },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.sm },
    sectionTitle: { fontSize: 16, ...theme.typography.label, color: theme.colors.textMuted },
    addItemBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    addItemText: { color: theme.colors.emerald, fontWeight: '600', fontSize: 14 },
    itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    itemInput: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.sm, padding: 12, fontSize: 14, color: theme.colors.text },
    removeBtn: { padding: 4 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing.lg, backgroundColor: theme.colors.warning + '15', borderRadius: theme.radii.lg, marginBottom: theme.spacing.lg },
    totalLabel: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
    totalValue: { fontSize: 20, fontWeight: '800', color: theme.colors.warning },
    submitBtn: { backgroundColor: theme.colors.primary, paddingVertical: 18, borderRadius: theme.radii.lg, alignItems: 'center', ...theme.shadow.glowEmerald },
    submitDisabled: { opacity: 0.7 },
    submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
    successCard: { margin: theme.spacing.lg, padding: theme.spacing.xl, borderRadius: theme.radii.xl, alignItems: 'center' },
    successIcon: { marginBottom: 12 },
    successTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
    successSub: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginBottom: 24 },
    qrWrapper: { padding: 16, backgroundColor: '#fff', borderRadius: theme.radii.lg, marginBottom: 16 },
    qrBlur: { padding: 12, borderRadius: theme.radii.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    cartIdLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
    cartIdValue: { fontSize: 11, color: '#fff', fontFamily: 'monospace' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: theme.spacing.lg, maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
    searchInput: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: theme.radii.md, padding: 14, fontSize: 16, color: '#fff', marginBottom: 12 },
    emptySuppliers: { padding: 24, color: theme.colors.textMuted, textAlign: 'center' },
    supplierRow: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: theme.radii.md, marginBottom: 8 },
    supplierAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
    supplierRowName: { fontSize: 16, fontWeight: '700', color: '#fff' },
    supplierRowCity: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
});
