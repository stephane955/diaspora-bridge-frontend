import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import NavigationBar from '@/components/NavigationBar';
import { successFeedback, mediumFeedback } from '@/utils/haptics';
import { useRouter } from 'expo-router';

export default function WithdrawScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const [amount, setAmount] = useState('');
    const [phone, setPhone] = useState('');
    const [method, setMethod] = useState<'MTN' | 'Orange'>('MTN');

    const handleWithdraw = async () => {
        if (!amount || !phone) return Alert.alert("Error", "Please fill all fields");

        mediumFeedback();
        const { error } = await supabase.from('withdrawals').insert({
            provider_id: user?.id,
            amount: parseInt(amount),
            method,
            phone_number: phone,
        });

        if (!error) {
            successFeedback();
            Alert.alert("Request Sent", "Your withdrawal is being processed. You will receive a notification soon.");
            router.back();
        }
    };

    return (
        <View style={styles.container}>
            <NavigationBar title="Withdraw Funds" showBack={true} />

            <View style={styles.content}>
                <Text style={styles.label}>Select Method</Text>
                <View style={styles.methodRow}>
                    {['MTN', 'Orange'].map((m) => (
                        <TouchableOpacity
                            key={m}
                            style={[styles.methodBtn, method === m && styles.activeMethod]}
                            onPress={() => setMethod(m as any)}
                        >
                            <Text style={[styles.methodText, method === m && styles.activeText]}>{m} Money</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                    style={styles.input}
                    placeholder="6xx xxx xxx"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                />

                <Text style={styles.label}>Amount (CFA)</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Minimum 5,000"
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={setAmount}
                />

                <TouchableOpacity style={styles.submitBtn} onPress={handleWithdraw}>
                    <Text style={styles.submitText}>Confirm Withdrawal</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    content: { padding: 20 },
    label: { fontSize: 14, fontWeight: '700', color: '#64748B', marginBottom: 10, marginTop: 20 },
    methodRow: { flexDirection: 'row', gap: 10 },
    methodBtn: { flex: 1, padding: 15, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
    activeMethod: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
    methodText: { fontWeight: '700', color: '#64748B' },
    activeText: { color: '#fff' },
    input: { backgroundColor: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 16 },
    submitBtn: { backgroundColor: '#0EA5E9', padding: 18, borderRadius: 15, marginTop: 40, alignItems: 'center' },
    submitText: { color: '#fff', fontWeight: '800', fontSize: 16 }
});