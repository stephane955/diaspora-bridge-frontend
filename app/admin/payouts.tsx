import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    Alert, ActivityIndicator, Pressable
} from 'react-native';
import * as Clipboard from 'expo-clipboard'; // Make sure to install: npx expo install expo-clipboard
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';
import { mediumFeedback, successFeedback } from '@/utils/haptics';
import PremiumHeader from '@/components/PremiumHeader';
import PremiumEmptyState from '@/components/PremiumEmptyState';
import ScreenLoader from '@/components/ScreenLoader';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import { useScreenOffsets } from '@/hooks/useScreenOffsets';
import {
    ALPHA,
    CARRIER_MTN,
    CARRIER_ORANGE,
    ICON_BUTTON_SIZE,
    icon as iconSize,
    radius,
    shadow,
    space,
    text,
    tint,
    withAlpha,
} from '@/constants/design';
import { P00_ADMIN_PAYOUT_UNAVAILABLE } from '@/constants/p00Security';

export default function AdminPayoutsScreen() {
    const { t } = useLanguage();
    const c = usePremiumColors();
    const offsets = useScreenOffsets({ tabBar: false });
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<number | null>(null);

    const fetchRequests = async () => {
        setLoading(true);
        // Fetch all 'pending' requests + the user's name/avatar
        const { data, error } = await supabase
            .from('withdrawals')
            .select('*, profiles:provider_id(full_name, avatar_url)')
            .eq('status', 'pending')
            .order('created_at', { ascending: true }); // Oldest requests first

        if (error) {
            console.error("Fetch Error:", error);
            Alert.alert(t('error'), t('couldNotLoadPayouts'));
        }
        setRequests(data || []);
        setLoading(false);
    };

    useEffect(() => { fetchRequests(); }, []);

    const copyToClipboard = async (value: string) => {
        await Clipboard.setStringAsync(value);
        mediumFeedback();
        Alert.alert(t('copied'), t('readyToPaste', { text: value }));
    };

    const markAsPaid = async (_item: any) => {
        Alert.alert(t('error'), P00_ADMIN_PAYOUT_UNAVAILABLE);
    };

    const renderItem = ({ item }: { item: any }) => (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            {/* Header: Name & Date */}
            <View style={styles.row}>
                <Text style={[styles.name, { color: c.textPrimary }]}>
                    {item.profiles?.full_name || "Unknown User"}
                </Text>
                <Text style={[styles.date, { color: c.muted }]}>
                    {new Date(item.created_at).toLocaleDateString()}
                </Text>
            </View>

            {/* Amount & Method Badge */}
            <View style={styles.row}>
                <Text style={[styles.amount, { color: c.textPrimary }]}>
                    {item.amount.toLocaleString()} CFA
                </Text>
                <View
                    style={[
                        styles.badge,
                        tint(item.method === 'mtn_momo' ? CARRIER_MTN : CARRIER_ORANGE),
                    ]}
                >
                    <Text style={[styles.badgeText, { color: c.textPrimary }]}>
                        {item.method === 'mtn_momo' ? 'MTN' : 'ORANGE'}
                    </Text>
                </View>
            </View>

            {/* Account Details (Click to Copy) */}
            <View style={[styles.detailsBox, { backgroundColor: c.surfaceAlt }]}>
                <TouchableOpacity onPress={() => copyToClipboard(item.phone_number)} style={styles.detailRow}>
                    <Text style={[styles.label, { color: c.textSecondary }]}>Phone:</Text>
                    <Text style={[styles.value, { color: c.textPrimary }]}>{item.phone_number}</Text>
                    <Ionicons name="copy-outline" size={iconSize.xs} color={c.gold} />
                </TouchableOpacity>
                <View style={styles.detailRow}>
                    <Text style={[styles.label, { color: c.textSecondary }]}>Name:</Text>
                    <Text style={[styles.value, { color: c.textPrimary }]}>
                        {item.account_name || "Not provided"}
                    </Text>
                </View>
            </View>

            {/* Action Button */}
            <TouchableOpacity
                style={[styles.payBtn, { backgroundColor: c.gold }]}
                onPress={() => markAsPaid(item)}
                disabled={!!processingId}
            >
                {processingId === item.id ? (
                    <ActivityIndicator color="#0A0F1A" />
                ) : (
                    <Text style={styles.payText}>Mark as PAID</Text>
                )}
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: c.bg }]}>
            <PremiumHeader
                title="Admin Payouts"
                showBack
                fallbackRoute="/"
                rightSlot={
                    <Pressable
                        onPress={fetchRequests}
                        hitSlop={10}
                        style={[
                            styles.iconBtn,
                            { backgroundColor: withAlpha(c.isDark ? '#FFFFFF' : '#0F172A', ALPHA.faint) },
                        ]}
                    >
                        <Ionicons name="refresh" size={iconSize.md} color={c.textPrimary} />
                    </Pressable>
                }
            />

            {loading ? (
                <ScreenLoader />
            ) : (
                <FlatList
                    data={requests}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={offsets.content}
                    ListEmptyComponent={
                        <PremiumEmptyState
                            icon="checkmark-done-outline"
                            title="All caught up"
                            subtitle="No pending payouts are waiting for approval."
                        />
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    iconBtn: {
        width: ICON_BUTTON_SIZE,
        height: ICON_BUTTON_SIZE,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
    },

    card: {
        padding: space.lg,
        borderRadius: radius.lg,
        marginBottom: space.md,
        borderWidth: 1,
        ...shadow.card,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: space.sm,
    },
    name: text.body,
    date: text.caption,
    amount: text.display,

    badge: {
        paddingHorizontal: space.xs,
        paddingVertical: space.xxs,
        borderRadius: radius.sm,
    },
    badgeText: { ...text.micro, fontWeight: '800' },

    detailsBox: {
        padding: space.sm,
        borderRadius: radius.lg,
        marginBottom: space.md,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        marginBottom: space.xxs,
    },
    label: { ...text.caption, width: 52 },
    value: text.footnote,

    payBtn: {
        height: 50,
        borderRadius: radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    payText: { color: '#0A0F1A', ...text.body, fontWeight: '800' },
});
