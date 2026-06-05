import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/context/LanguageContext';
import PremiumHeader from '@/components/PremiumHeader';
import { providerMenuItems } from '@/constants/premiumMenus';
import { FLOATING_TAB_BAR_HEIGHT, PREMIUM_BG } from '@/constants/layout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { z } from 'zod';
import { theme } from '@/constants/theme';
import { mediumFeedback, successFeedback } from '@/utils/haptics';

// --- VALIDATION SCHEMA ---
const payoutSchema = z.object({
    fullName: z.string().min(3, "Full name is required"),
    phoneNumber: z.string().regex(/^6[0-9]{8}$/, "Invalid Cameroon Number (Must start with 6, 9 digits)"),
    amount: z.number().min(1000, "Minimum withdrawal is 1,000 CFA"),
});

export default function PayoutSetupScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { t } = useLanguage();
    const { user } = useAuth();

    const [method, setMethod] = useState<'mtn' | 'orange'>('mtn');
    const [formData, setFormData] = useState({ fullName: '', phoneNumber: '', amount: '' });
    const [loading, setLoading] = useState(false);

    const handleWithdraw = async () => {
        mediumFeedback();

        // 1. ZOD VALIDATION (Format Check)
        const validation = payoutSchema.safeParse({
            fullName: formData.fullName,
            phoneNumber: formData.phoneNumber,
            amount: Number(formData.amount)
        });

        if (!validation.success) {
            Alert.alert("Invalid Input", validation.error.errors[0].message);
            return;
        }

        // --- 2. CARRIER PREFIX CHECK (Logic Check) ---
        // This prevents users from selecting MTN but typing an Orange number
        const prefix = formData.phoneNumber.substring(0, 2); // Get first 2 digits (e.g., "67")

        if (method === 'mtn') {
            // MTN typically starts with 65, 67, 68.
            // Orange starts with 69.
            if (prefix === '69') {
                Alert.alert("Carrier Mismatch", "You selected MTN, but entered an Orange number (starts with 69).");
                return;
            }
        } else if (method === 'orange') {
            // If they start with 67 or 68, it is definitely NOT Orange.
            if (prefix === '67' || prefix === '68') {
                Alert.alert("Carrier Mismatch", "You selected Orange, but entered an MTN number.");
                return;
            }
        }
        // ---------------------------------------------

        setLoading(true);

        try {
            const withdrawalAmount = Number(formData.amount);

            // 3. CHECK BALANCE
            const { data: transactions, error: txError } = await supabase
                .from('transactions')
                .select('amount')
                .eq('user_id', user?.id);

            if (txError) throw txError;

            const balance = transactions?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

            if (balance < withdrawalAmount) {
                throw new Error(`Insufficient funds. Your balance is ${balance.toLocaleString()} CFA.`);
            }

            // 4. CREATE WITHDRAWAL REQUEST
            const { error } = await supabase.from('withdrawals').insert({
                provider_id: user?.id,
                amount: withdrawalAmount,
                method: method === 'mtn' ? 'mtn_momo' : 'orange_money',
                phone_number: formData.phoneNumber,
                account_name: formData.fullName,
                status: 'pending'
            });

            if (error) throw error;

            // 5. DEDUCT FROM WALLET
            const { error: deductError } = await supabase.from('transactions').insert({
                user_id: user?.id,
                amount: -withdrawalAmount,
                description: `Withdrawal to ${method === 'mtn' ? 'MTN MoMo' : 'Orange Money'} (${formData.phoneNumber})`,
                type: 'withdrawal'
            });

            if (deductError) throw deductError;

            successFeedback();
            Alert.alert("Request Sent", "Your funds will be transferred within 24 hours.", [
                { text: "OK", onPress: () => router.replace('/provider/earnings') } // Updated route
            ]);

        } catch (e: any) {
            console.error("Withdrawal Error:", e);
            Alert.alert("Error", e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { backgroundColor: PREMIUM_BG }]}>
            <PremiumHeader
                title={t('payoutSetupTitle')}
                subtitle={t('walletTitle')}
                showBack
                fallbackRoute="/provider/earnings"
                menuItems={providerMenuItems(router, t)}
            />
            <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 88, paddingBottom: FLOATING_TAB_BAR_HEIGHT + 32, paddingHorizontal: 20 }]}>
                <Text style={styles.subTitle}>Select Method</Text>

                <View style={styles.methodRow}>
                    <TouchableOpacity
                        style={[styles.methodCard, method === 'mtn' && styles.mtnActive]}
                        onPress={() => setMethod('mtn')}
                    >
                        <View style={[styles.radio, method === 'mtn' && styles.radioActive]} />
                        <Text style={[styles.methodText, method === 'mtn' && styles.textBold]}>MTN MoMo</Text>
                        <View style={[styles.colorStrip, { backgroundColor: '#FFCC00' }]} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.methodCard, method === 'orange' && styles.orangeActive]}
                        onPress={() => setMethod('orange')}
                    >
                        <View style={[styles.radio, method === 'orange' && styles.radioActive]} />
                        <Text style={[styles.methodText, method === 'orange' && styles.textBold]}>Orange Money</Text>
                        <View style={[styles.colorStrip, { backgroundColor: '#FF6600' }]} />
                    </TouchableOpacity>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Amount (CFA)</Text>
                        <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            placeholder="e.g. 50000"
                            value={formData.amount}
                            onChangeText={t => setFormData({...formData, amount: t})}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Mobile Money Number</Text>
                        <TextInput
                            style={styles.input}
                            keyboardType="phone-pad"
                            placeholder="6XXXXXXXX"
                            value={formData.phoneNumber}
                            onChangeText={t => setFormData({...formData, phoneNumber: t})}
                            maxLength={9}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Account Name (For Verification)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Full Name on Account"
                            value={formData.fullName}
                            onChangeText={t => setFormData({...formData, fullName: t})}
                        />
                    </View>

                    <View style={styles.infoBox}>
                        <Ionicons name="information-circle" size={20} color="#64748B" />
                        <Text style={styles.infoText}>
                            Withdrawals are processed manually. Funds usually arrive in 2-24 hours.
                        </Text>
                    </View>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.submitBtn, loading && { opacity: 0.7 }]}
                    onPress={handleWithdraw}
                    disabled={loading}
                >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Confirm Withdrawal</Text>}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 15, backgroundColor: '#fff' },
    backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 15 },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
    content: { padding: 20 },
    subTitle: { fontSize: 16, fontWeight: '700', color: '#64748B', marginBottom: 15 },
    methodRow: { flexDirection: 'row', gap: 15, marginBottom: 30 },
    methodCard: { flex: 1, backgroundColor: '#fff', padding: 15, borderRadius: 16, borderWidth: 2, borderColor: '#F1F5F9', position: 'relative', overflow: 'hidden' },
    mtnActive: { borderColor: '#FFCC00', backgroundColor: '#FFFBEB' },
    orangeActive: { borderColor: '#FF6600', backgroundColor: '#FFF7ED' },
    colorStrip: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 4 },
    radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#CBD5E1', marginBottom: 10 },
    radioActive: { borderColor: '#0F172A', backgroundColor: '#0F172A' },
    methodText: { fontSize: 16, color: '#64748B' },
    textBold: { fontWeight: '700', color: '#0F172A' },
    form: { gap: 20 },
    inputGroup: { gap: 8 },
    label: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
    input: { backgroundColor: '#fff', height: 56, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 16, fontSize: 16, color: '#0F172A' },
    infoBox: { flexDirection: 'row', backgroundColor: '#F1F5F9', padding: 15, borderRadius: 12, gap: 10, alignItems: 'center', marginTop: 10 },
    infoText: { flex: 1, fontSize: 13, color: '#64748B', lineHeight: 20 },
    footer: { padding: 20, paddingBottom: 40, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    submitBtn: { backgroundColor: '#0F172A', height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '700' }
});