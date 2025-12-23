import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import NavigationBar from '@/components/NavigationBar';
import BudgetProgress from '@/components/BudgetProgress';
import { successFeedback, mediumFeedback } from '@/utils/haptics';

export default function ProjectDetails() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [project, setProject] = useState<any>(null);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        if (!id) return;
        setLoading(true);

        const { data: proj } = await supabase
            .from('projects')
            .select('*')
            .eq('id', id)
            .single();

        const { data: exp } = await supabase
            .from('project_expenses')
            .select('*')
            .eq('project_id', id)
            .order('created_at', { ascending: false });

        if (proj) setProject(proj);
        if (exp) setExpenses(exp || []);
        setLoading(false);
    }, [id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleReleaseFunds = async (expenseId: number, amount: number) => {
        mediumFeedback();
        Alert.alert(
            "Release Escrow?",
            `You are about to release ${amount.toLocaleString()} CFA to the provider. This action is permanent.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Confirm Payment",
                    onPress: async () => {
                        const { error } = await supabase
                            .from('project_expenses')
                            .update({ status: 'approved' })
                            .eq('id', expenseId);

                        if (!error) {
                            successFeedback();
                            fetchData(); // Refresh list to show 'PAID'
                        }
                    }
                }
            ]
        );
    };

    if (loading) return (
        <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>
    );

    const totalSpent = expenses.reduce((sum, item) => sum + (item.status === 'approved' ? item.amount : 0), 0);

    return (
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
            <NavigationBar title="Project Details" showBack={true} />

            <ScrollView style={styles.container} bounces={false}>
                <Image
                    source={{ uri: project?.image_url || 'https://images.unsplash.com/photo-1503387762-592deb58ef4e' }}
                    style={styles.coverImage}
                />

                <View style={styles.content}>
                    <Text style={styles.title}>{project?.title}</Text>
                    <View style={styles.locationRow}>
                        <Ionicons name="location-sharp" size={16} color="#64748B" />
                        <Text style={styles.location}>{project?.city}</Text>
                    </View>

                    {/* Financial Summary */}
                    <BudgetProgress
                        totalBudget={project?.budget || 0}
                        spent={totalSpent}
                    />

                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Financial Requests</Text>
                        <Text style={styles.sectionSub}>Review and approve payments to workers</Text>
                    </View>

                    {expenses.length === 0 ? (
                        <View style={styles.emptyBox}>
                            <Ionicons name="receipt-outline" size={32} color="#CBD5E1" />
                            <Text style={styles.emptyText}>No payment requests yet.</Text>
                        </View>
                    ) : (
                        expenses.map((item) => (
                            <View key={item.id} style={[styles.expenseItem, item.status === 'pending' && styles.pendingItem]}>
                                <View style={styles.expenseIcon}>
                                    <Ionicons
                                        name={item.status === 'approved' ? "checkmark-circle" : "time"}
                                        size={22}
                                        color={item.status === 'approved' ? "#16A34A" : "#F59E0B"}
                                    />
                                </View>

                                <View style={{ flex: 1 }}>
                                    <Text style={styles.expenseTitle}>{item.category}</Text>
                                    <Text style={styles.expenseDesc} numberOfLines={1}>{item.description}</Text>
                                    <Text style={styles.expenseDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
                                </View>

                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={styles.expenseAmount}>{item.amount.toLocaleString()} CFA</Text>

                                    {item.status === 'pending' ? (
                                        <TouchableOpacity
                                            style={styles.releaseBtn}
                                            onPress={() => handleReleaseFunds(item.id, item.amount)}
                                        >
                                            <Text style={styles.releaseText}>Approve & Pay</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <View style={styles.paidBadge}>
                                            <Text style={styles.paidText}>PAID</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    coverImage: { width: '100%', height: 220 },
    content: { padding: 20, marginTop: -30, backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, minHeight: 600 },
    title: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 20 },
    location: { color: '#64748B', fontSize: 16 },

    sectionHeader: { marginTop: 10, marginBottom: 15 },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
    sectionSub: { fontSize: 13, color: '#94A3B8', marginTop: 2 },

    emptyBox: { padding: 40, backgroundColor: '#F8FAFC', borderRadius: 24, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E1', gap: 10 },
    emptyText: { color: '#94A3B8', fontWeight: '500' },

    expenseItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, backgroundColor: '#fff', marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' },
    pendingItem: { borderColor: '#E0F2FE', backgroundColor: '#F0F9FF' },
    expenseIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    expenseTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
    expenseDesc: { fontSize: 12, color: '#64748B', marginTop: 2 },
    expenseDate: { fontSize: 10, color: '#94A3B8', marginTop: 4 },
    expenseAmount: { fontSize: 15, fontWeight: '800', color: '#0F172A' },

    releaseBtn: { backgroundColor: '#0EA5E9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginTop: 8 },
    releaseText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    paidBadge: { backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginTop: 8 },
    paidText: { color: '#16A34A', fontSize: 10, fontWeight: '800' }
});