import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/context/LanguageContext';
import PremiumHeader from '@/components/PremiumHeader';
import { providerMenuItems } from '@/constants/premiumMenus';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import { useScreenOffsets } from '@/hooks/useScreenOffsets';
import {
    ALPHA,
    CARRIER_MTN,
    CARRIER_ORANGE,
    GOLD,
    font,
    glow,
    icon as iconSize,
    radius,
    shadow,
    space,
    text,
    weight,
    withAlpha,
} from '@/constants/design';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { z } from 'zod';
import { mediumFeedback, successFeedback } from '@/utils/haptics';
import { P00_PAYOUT_UNAVAILABLE } from '@/constants/p00Security';

// --- VALIDATION SCHEMA ---
const payoutSchema = z.object({
    fullName: z.string().min(3, "Full name is required"),
    phoneNumber: z.string().regex(/^6[0-9]{8}$/, "Invalid Cameroon Number (Must start with 6, 9 digits)"),
    amount: z.number().min(1000, "Minimum withdrawal is 1,000 CFA"),
});

export default function PayoutSetupScreen() {
    const router = useRouter();
    const { t } = useLanguage();
    const { user } = useAuth();
    const c = usePremiumColors();
    const offsets = useScreenOffsets();

    const [method, setMethod] = useState<'mtn' | 'orange'>('mtn');
    const [formData, setFormData] = useState({ fullName: '', phoneNumber: '', amount: '' });
    const [loading, setLoading] = useState(false);

    const handleWithdraw = async () => {
        Alert.alert(t('error'), P00_PAYOUT_UNAVAILABLE);
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { backgroundColor: c.bg }]}>
            <PremiumHeader
                title={t('payoutSetupTitle')}
                subtitle={t('walletTitle')}
                showBack
                fallbackRoute="/provider/earnings"
                menuItems={providerMenuItems(router, t)}
            />
            <ScrollView contentContainerStyle={offsets.content}>
                <Text style={[styles.subTitle, { color: c.textSecondary }]}>{t('selectMethod')}</Text>

                <View style={styles.methodRow}>
                    <TouchableOpacity
                        style={[
                            styles.methodCard,
                            { backgroundColor: c.surface, borderColor: c.border },
                            method === 'mtn' && styles.mtnActive,
                        ]}
                        onPress={() => setMethod('mtn')}
                    >
                        <View
                            style={[
                                styles.radio,
                                { borderColor: c.border },
                                method === 'mtn' && styles.radioActive,
                            ]}
                        />
                        <Text
                            style={[
                                styles.methodText,
                                { color: c.textSecondary },
                                method === 'mtn' && [styles.textBold, { color: c.textPrimary }],
                            ]}
                        >
                            MTN MoMo
                        </Text>
                        <View style={[styles.colorStrip, { backgroundColor: CARRIER_MTN }]} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.methodCard,
                            { backgroundColor: c.surface, borderColor: c.border },
                            method === 'orange' && styles.orangeActive,
                        ]}
                        onPress={() => setMethod('orange')}
                    >
                        <View
                            style={[
                                styles.radio,
                                { borderColor: c.border },
                                method === 'orange' && styles.radioActive,
                            ]}
                        />
                        <Text
                            style={[
                                styles.methodText,
                                { color: c.textSecondary },
                                method === 'orange' && [styles.textBold, { color: c.textPrimary }],
                            ]}
                        >
                            Orange Money
                        </Text>
                        <View style={[styles.colorStrip, { backgroundColor: CARRIER_ORANGE }]} />
                    </TouchableOpacity>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: c.textPrimary }]}>{t('amountLabel')}</Text>
                        <TextInput
                            style={[
                                styles.input,
                                { backgroundColor: c.surface, borderColor: c.border, color: c.textPrimary },
                            ]}
                            keyboardType="numeric"
                            placeholder="e.g. 50000"
                            placeholderTextColor={c.muted}
                            value={formData.amount}
                            onChangeText={val => setFormData({...formData, amount: val})}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: c.textPrimary }]}>{t('momoNumberLabel')}</Text>
                        <TextInput
                            style={[
                                styles.input,
                                { backgroundColor: c.surface, borderColor: c.border, color: c.textPrimary },
                            ]}
                            keyboardType="phone-pad"
                            placeholder="6XXXXXXXX"
                            placeholderTextColor={c.muted}
                            value={formData.phoneNumber}
                            onChangeText={val => setFormData({...formData, phoneNumber: val})}
                            maxLength={9}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.label, { color: c.textPrimary }]}>{t('accountNameLabel')}</Text>
                        <TextInput
                            style={[
                                styles.input,
                                { backgroundColor: c.surface, borderColor: c.border, color: c.textPrimary },
                            ]}
                            placeholder="Full Name on Account"
                            placeholderTextColor={c.muted}
                            value={formData.fullName}
                            onChangeText={val => setFormData({...formData, fullName: val})}
                        />
                    </View>

                    <View style={[styles.infoBox, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
                        <Ionicons name="information-circle" size={iconSize.md} color={c.textSecondary} />
                        <Text style={[styles.infoText, { color: c.textSecondary }]}>
                            {t('withdrawInfo')}
                        </Text>
                    </View>
                </View>
            </ScrollView>

            <View
                style={[
                    styles.footer,
                    {
                        backgroundColor: c.surface,
                        borderTopColor: c.border,
                        paddingBottom: offsets.bottom,
                        paddingHorizontal: offsets.horizontal,
                    },
                ]}
            >
                <TouchableOpacity
                    style={[styles.submitBtn, loading && { opacity: 0.7 }]}
                    onPress={handleWithdraw}
                    disabled={loading}
                >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t('confirmWithdraw')}</Text>}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    subTitle: { ...text.body, marginBottom: space.md },
    methodRow: { flexDirection: 'row', gap: space.md, marginBottom: space.xxl },
    methodCard: {
        flex: 1,
        padding: space.md,
        borderRadius: radius.lg,
        borderWidth: 2,
        position: 'relative',
        overflow: 'hidden',
        ...shadow.card,
    },
    mtnActive: {
        borderColor: CARRIER_MTN,
        backgroundColor: withAlpha(CARRIER_MTN, ALPHA.medium),
    },
    orangeActive: {
        borderColor: CARRIER_ORANGE,
        backgroundColor: withAlpha(CARRIER_ORANGE, ALPHA.medium),
    },
    colorStrip: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 4 },
    radio: {
        width: 18,
        height: 18,
        borderRadius: radius.pill,
        borderWidth: 2,
        marginBottom: space.sm,
    },
    radioActive: { borderColor: GOLD, backgroundColor: GOLD },
    methodText: text.body,
    textBold: { fontWeight: weight.heavy },
    form: { gap: space.lg },
    inputGroup: { gap: space.xs },
    label: { ...text.footnote, fontWeight: weight.heavy },
    input: {
        height: 56,
        borderRadius: radius.lg,
        borderWidth: 1,
        paddingHorizontal: space.md,
        fontSize: font.body,
        fontWeight: weight.semibold,
    },
    infoBox: {
        flexDirection: 'row',
        padding: space.md,
        borderRadius: radius.md,
        borderWidth: 1,
        gap: space.sm,
        alignItems: 'center',
        marginTop: space.sm,
    },
    infoText: { flex: 1, ...text.caption, lineHeight: 20 },
    footer: {
        paddingTop: space.lg,
        borderTopWidth: 1,
    },
    submitBtn: {
        backgroundColor: GOLD,
        height: 56,
        borderRadius: radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        ...glow(GOLD),
    },
    btnText: { ...text.body, fontWeight: weight.heavy, color: '#0A0F1A' }
});
