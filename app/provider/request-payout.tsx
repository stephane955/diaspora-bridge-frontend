import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import NavigationBar from '@/components/NavigationBar';
import { successFeedback } from '@/utils/haptics';

export default function RequestPayout() {
    const router = useRouter();
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('Materials');
    const [desc, setDesc] = useState('');

    const handleRequest = async () => {
        // Logic to insert into project_expenses with 'pending' status
        // and notify the Diaspora Client
        successFeedback();
        Alert.alert("Success", "Payout request sent to the client.");
        router.back();
    };

    return (
        <View style={styles.container}>
            <NavigationBar title="Request Payout" showBack={true} />
            <View style={styles.form}>
                <Text style={styles.label}>Amount (CFA)</Text>
                <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="500,000"
                    value={amount}
                    onChangeText={setAmount}
                />

                <Text style={styles.label}>Description</Text>
                <TextInput
                    style={[styles.input, { height: 100 }]}
                    multiline
                    placeholder="What is this payment for?"
                    value={desc}
                    onChangeText={setDesc}
                />

                <TouchableOpacity style={styles.btn} onPress={handleRequest}>
                    <Text style={styles.btnText}>Submit for Approval</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    form: { padding: 20 },
    label: { fontWeight: '700', color: '#1E293B', marginBottom: 8, marginTop: 15 },
    input: { backgroundColor: '#fff', borderRadius: 12, padding: 15, borderWidth: 1, borderColor: '#E2E8F0' },
    btn: { backgroundColor: '#0F172A', padding: 18, borderRadius: 15, marginTop: 30, alignItems: 'center' },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 16 }
});