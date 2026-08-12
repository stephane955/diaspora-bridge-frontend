import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';
import PremiumHeader from '@/components/PremiumHeader';
import { providerMenuItems } from '@/constants/premiumMenus';
import { useAuth } from '@/context/AuthContext';
import { theme } from '@/constants/theme';
import { FLOATING_TAB_BAR_HEIGHT, PREMIUM_BG } from '@/constants/layout';

export default function RequestPayout() {
    const insets = useSafeAreaInsets();
    const { projectId } = useLocalSearchParams();
    const { user } = useAuth();
    const router = useRouter();
    const { t } = useLanguage();
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
        <View style={[styles.container, { backgroundColor: PREMIUM_BG }]}>
            <PremiumHeader
                title={t('requestPayoutTitle')}
                subtitle={t('walletTitle')}
                showBack
                fallbackRoute="/provider/earnings"
                menuItems={providerMenuItems(router, t)}
            />
            <View style={[styles.form, { paddingTop: insets.top + 88, paddingBottom: FLOATING_TAB_BAR_HEIGHT + 40 }]}>
            <Text style={styles.title}>Request Payment</Text>
            <Text style={styles.label}>Amount (CFA)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={amount} onChangeText={setAmount} placeholder="e.g. 500000" />
            <Text style={styles.label}>Description</Text>
            <TextInput style={styles.input} value={desc} onChangeText={setDesc} placeholder="e.g. Foundation completion" />
            <TouchableOpacity style={styles.btn} onPress={handleSubmit}><Text style={styles.btnText}>Send Request</Text></TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    form: { paddingHorizontal: 20, paddingTop: 16 },
    title: { fontSize: 24, fontWeight: '800', marginBottom: 30 },
    label: { fontWeight: '700', marginBottom: 8 },
    input: { borderWidth: 1, borderColor: '#E2E8F0', padding: 16, borderRadius: 12, marginBottom: 20, fontSize: 16 },
    btn: { backgroundColor: '#0F172A', height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 16 }
});