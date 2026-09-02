import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';
import PremiumHeader from '@/components/PremiumHeader';
import PremiumEmptyState from '@/components/PremiumEmptyState';
import ScreenLoader from '@/components/ScreenLoader';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import { useScreenOffsets } from '@/hooks/useScreenOffsets';
import { DANGER, radius, space, SUCCESS_DEEP, text } from '@/constants/design';

export default function AdminVerifyScreen() {
    const { t } = useLanguage();
    const c = usePremiumColors();
    const offsets = useScreenOffsets({ tabBar: false });
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchPending = async () => {
        setLoading(true);
        // Get profiles that are pending, including their ID doc link from the 'verifications' table
        const { data, error } = await supabase
            .from('profiles')
            .select(`
                id, full_name, city, verification_status,
                verifications ( document_url )
            `)
            .eq('verification_status', 'pending');

        if (data) setRequests(data);
        setLoading(false);
    };

    useEffect(() => { fetchPending(); }, []);

    const handleAction = async (userId: string, action: 'verified' | 'rejected') => {
        const { error } = await supabase
            .from('profiles')
            .update({
                verification_status: action,
                is_verified: action === 'verified'
            })
            .eq('id', userId);

        if (!error) {
            Alert.alert(t('success'), t('userActionSuccess', { action }));
            setRequests(prev => prev.filter(r => r.id !== userId));
        }
    };

    const renderRequest = ({ item }: { item: any }) => {
        // Since the bucket is private, we'd normally need a signed URL.
        // For simplicity in the dashboard, you can view the path.
        const docPath = item.verifications?.[0]?.document_url;

        return (
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Text style={[styles.name, { color: c.textPrimary }]}>{item.full_name}</Text>
                <Text style={[styles.sub, { color: c.textSecondary }]}>{item.city}</Text>

                <Text style={[styles.pathLabel, { color: c.muted }]}>Document Path: {docPath}</Text>

                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.btn, styles.rejectBtn]}
                        onPress={() => handleAction(item.id, 'rejected')}
                    >
                        <Text style={styles.btnText}>Reject</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.btn, styles.approveBtn]}
                        onPress={() => handleAction(item.id, 'verified')}
                    >
                        <Text style={styles.btnText}>Approve</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: c.bg }]}>
            <PremiumHeader title="Pending Verifications" showBack fallbackRoute="/" hideMenu />
            {loading ? (
                <ScreenLoader />
            ) : (
                <FlatList
                    data={requests}
                    keyExtractor={item => item.id}
                    renderItem={renderRequest}
                    contentContainerStyle={offsets.content}
                    ListEmptyComponent={
                        <PremiumEmptyState
                            icon="shield-checkmark-outline"
                            title="No pending requests"
                            subtitle="Verification submissions will appear here as providers send them."
                        />
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    card: {
        padding: space.md,
        borderRadius: radius.lg,
        marginBottom: space.md,
        borderWidth: 1,
    },
    name: text.subtitle,
    sub: { ...text.footnote, marginBottom: space.xs },
    pathLabel: { ...text.caption, marginBottom: space.md },
    actions: { flexDirection: 'row', gap: space.sm },
    btn: {
        flex: 1,
        paddingVertical: space.sm,
        borderRadius: radius.lg,
        alignItems: 'center',
    },
    approveBtn: { backgroundColor: SUCCESS_DEEP },
    rejectBtn: { backgroundColor: DANGER },
    btnText: { color: '#FFFFFF', ...text.footnote, fontWeight: '800' },
});
