import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase'; //
import { useAuth } from '@/context/AuthContext'; //

export default function WithdrawScreen() {
    const router = useRouter();
    const { user } = useAuth();

    const [amount, setAmount] = useState('');
    const [phone, setPhone] = useState('');
    const [method, setMethod] = useState<'MOMO' | 'OM'>('MOMO');
    const [loading, setLoading] = useState(false);

    const handleConfirm = async () => {
        if (!amount || !phone) return Alert.alert("Missing Info", "Enter amount and phone number.");
        if (isNaN(Number(amount)) || Number(amount) < 500) return Alert.alert("Invalid Amount", "Minimum withdrawal is 500 CFA.");

        setLoading(true);

        const { error } = await supabase.from('withdrawals').insert({
            provider_id: user?.id,
            amount: Number(amount),
            method: method,
            phone_number: phone,
            status: 'pending'
        });

        setLoading(false);

        if (error) {
            Alert.alert("Error", error.message);
        } else {
            Alert.alert("Request Sent", "Your withdrawal is being processed.", [
                { text: "Back to Wallet", onPress: () => router.back() }
            ]);
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="close" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.title}>Withdraw Funds</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                <Text style={styles.label}>Select Method</Text>
                <View style={styles.methodRow}>
                    <TouchableOpacity
                        style={[styles.methodCard, method === 'MOMO' && styles.activeCard]}
                        onPress={() => setMethod('MOMO')}
                    >
                        <Text style={[styles.methodText, method === 'MOMO' && styles.activeText]}>MTN MoMo</Text>
                        {method === 'MOMO' && <Ionicons name="checkmark-circle" size={20} color="#0EA5E9" />}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.methodCard, method === 'OM' && styles.activeCard]}
                        onPress={() => setMethod('OM')}
                    >
                        <Text style={[styles.methodText, method === 'OM' && styles.activeText]}>Orange Money</Text>
                        {method === 'OM' && <Ionicons name="checkmark-circle" size={20} color="#F97316" />}
                    </TouchableOpacity>
                </View>

                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                    style={styles.input}
                    placeholder="670 00 00 00"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                />

                <Text style={styles.label}>Amount (CFA)</Text>
                <TextInput
                    style={[styles.input, styles.amountInput]}
                    placeholder="0"
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={setAmount}
                />

                <Text style={styles.hint}>Processing time: Instant to 24 hours.</Text>
            </View>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.confirmBtn}
                    onPress={handleConfirm}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.btnText}>Confirm Withdrawal</Text>
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    backBtn: { padding: 8 },
    title: { fontSize: 18, fontWeight: '800', color: '#0F172A' },

    content: { padding: 24, flex: 1 },
    label: { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 12, marginTop: 20 },

    methodRow: { flexDirection: 'row', gap: 12 },
    methodCard: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
    activeCard: { borderColor: '#0EA5E9', backgroundColor: '#F0F9FF' },
    methodText: { fontWeight: '600', color: '#64748B' },
    activeText: { color: '#0F172A' },

    input: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12, fontSize: 16, color: '#0F172A', borderWidth: 1, borderColor: '#E2E8F0' },
    amountInput: { fontSize: 24, fontWeight: '700', color: '#0EA5E9' },
    hint: { marginTop: 12, color: '#94A3B8', fontSize: 12 },

    footer: { padding: 24, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    confirmBtn: { backgroundColor: '#0F172A', padding: 18, borderRadius: 16, alignItems: 'center' },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '700' }
});