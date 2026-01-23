import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function RequestPayout() {
    const { projectId } = useLocalSearchParams();
    const { user } = useAuth();
    const router = useRouter();
    const [amount, setAmount] = useState('');
    const [desc, setDesc] = useState('');

    const handleSubmit = async () => {
        const { error } = await supabase.from('project_expenses').insert({
            project_id: projectId,
            provider_id: user?.id,
            amount: parseInt(amount),
            description: desc,
            category: 'Milestone',
            status: 'pending'
        });

        if (!error) {
            Alert.alert("Success", "Request sent to client!");
            router.back();
        } else {
            Alert.alert("Error", "Failed to send request.");
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Request Payment</Text>
            <Text style={styles.label}>Amount (CFA)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={amount} onChangeText={setAmount} placeholder="e.g. 500000" />
            <Text style={styles.label}>Description</Text>
            <TextInput style={styles.input} value={desc} onChangeText={setDesc} placeholder="e.g. Foundation completion" />
            <TouchableOpacity style={styles.btn} onPress={handleSubmit}><Text style={styles.btnText}>Send Request</Text></TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: '#fff' },
    title: { fontSize: 24, fontWeight: '800', marginBottom: 30 },
    label: { fontWeight: '700', marginBottom: 8 },
    input: { borderWidth: 1, borderColor: '#E2E8F0', padding: 16, borderRadius: 12, marginBottom: 20, fontSize: 16 },
    btn: { backgroundColor: '#0F172A', padding: 18, borderRadius: 14, alignItems: 'center' },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 16 }
});