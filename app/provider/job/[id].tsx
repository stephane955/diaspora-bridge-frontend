import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, Image, ScrollView, TouchableOpacity,
    Alert, ActivityIndicator, Dimensions, StatusBar
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const { width } = Dimensions.get('window');

export default function JobDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuth();

    const [job, setJob] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [applying, setApplying] = useState(false);
    const [hasApplied, setHasApplied] = useState(false);
    const [isAssigned, setIsAssigned] = useState(false);

    useEffect(() => {
        const fetchJobData = async () => {
            if (!id || !user) return;

            try {
                // 1. Fetch Job Details
                const { data: jobData, error } = await supabase.from('projects').select('*').eq('id', id).single();
                if (error) throw error;
                setJob(jobData);

                // 2. Check if this specific user is the hired provider
                if (jobData.provider_id === user.id) {
                    setIsAssigned(true);
                }

                // 3. Check if already applied (if not hired)
                const { data: appData } = await supabase
                    .from('project_applications')
                    .select('*')
                    .eq('project_id', id)
                    .eq('provider_id', user.id)
                    .maybeSingle();

                if (appData) setHasApplied(true);
            } catch (err) {
                console.error("Error loading job details:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchJobData();
    }, [id, user]);

    const handleApply = async () => {
        if (isAssigned) {
            // This triggers when you click "Manage Project"
            router.push(`/provider/job/${id}`);
            return;
        }

        Alert.alert(
            "Submit Application",
            "The client will review your profile. You will be notified if accepted.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Apply Now",
                    onPress: async () => {
                        setApplying(true);
                        try {
                            const { error } = await supabase
                                .from('project_applications')
                                .insert({
                                    project_id: id,
                                    provider_id: user?.id,
                                    status: 'pending'
                                });

                            if (error) throw error;

                            setHasApplied(true);
                            Alert.alert("Success", "Application sent!");
                        } catch (error: any) {
                            Alert.alert("Error", error.message || "Could not send application.");
                        } finally {
                            setApplying(false);
                        }
                    }
                }
            ]
        );
    };

    if (loading) return (
        <View style={styles.center}><ActivityIndicator color="#0F172A" size="large" /></View>
    );

    if (!job) return (
        <View style={styles.center}><Text>Job not found</Text></View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            <ScrollView contentContainerStyle={{ paddingBottom: 150 }} bounces={false}>
                {/* HERO IMAGE */}
                <View style={styles.imageContainer}>
                    <Image
                        source={{ uri: job.image_url || 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5' }}
                        style={styles.image}
                    />
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.imageOverlay} />

                    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>

                    <View style={styles.titleContainer}>
                        <View style={[styles.tag, isAssigned && { backgroundColor: '#16A34A' }]}>
                            <Text style={styles.tagText}>{isAssigned ? "MY ACTIVE JOB" : "OPEN OPPORTUNITY"}</Text>
                        </View>
                        <Text style={styles.title}>{job.title}</Text>
                        <View style={styles.locationRow}>
                            <Ionicons name="location" size={16} color="#CBD5E1" />
                            <Text style={styles.location}>{job.city}</Text>
                        </View>
                    </View>
                </View>

                {/* DETAILS BODY */}
                <View style={styles.body}>
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>BUDGET</Text>
                            <Text style={styles.statValue}>{job.budget?.toLocaleString()} CFA</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statLabel}>STATUS</Text>
                            <Text style={styles.statValue}>{job.status?.toUpperCase()}</Text>
                        </View>
                    </View>

                    <Text style={styles.sectionTitle}>Scope of Work</Text>
                    <Text style={styles.description}>{job.description}</Text>

                    <Text style={styles.sectionTitle}>Client Requirements</Text>
                    <View style={styles.reqList}>
                        <View style={styles.reqItem}>
                            <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                            <Text style={styles.reqText}>Professional tools required</Text>
                        </View>
                        <View style={styles.reqItem}>
                            <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                            <Text style={styles.reqText}>Daily photo updates</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* FLOATING FOOTER ACTION */}
            <View style={styles.footer}>
                <View>
                    <Text style={styles.footerLabel}>Total Payout</Text>
                    <Text style={styles.footerPrice}>{job.budget?.toLocaleString()} CFA</Text>
                </View>

                <TouchableOpacity
                    style={[
                        styles.acceptBtn,
                        hasApplied && !isAssigned && { backgroundColor: '#94A3B8' },
                        isAssigned && { backgroundColor: '#0EA5E9' }
                    ]}
                    onPress={handleApply}
                    disabled={(hasApplied && !isAssigned) || applying}
                >
                    {isAssigned ? (
                        <>
                            <Text style={styles.btnText}>Manage Project</Text>
                            <Ionicons name="construct" size={20} color="#fff" />
                        </>
                    ) : hasApplied ? (
                        <>
                            <Ionicons name="checkmark-circle" size={20} color="#fff" />
                            <Text style={styles.btnText}>Application Sent</Text>
                        </>
                    ) : (
                        <>
                            <Text style={styles.btnText}>Request This Job</Text>
                            <Ionicons name="paper-plane" size={20} color="#fff" />
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    imageContainer: { height: 300, width: width, position: 'relative' },
    image: { width: '100%', height: '100%' },
    imageOverlay: { ...StyleSheet.absoluteFillObject },
    backBtn: { position: 'absolute', top: 50, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
    titleContainer: { position: 'absolute', bottom: 20, left: 20, right: 20 },
    tag: { backgroundColor: '#0EA5E9', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 8 },
    tagText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    title: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 4 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    location: { color: '#E2E8F0', fontSize: 16 },
    body: { padding: 24, backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, marginTop: -20 },
    statsRow: { flexDirection: 'row', backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, marginBottom: 30 },
    statItem: { flex: 1, alignItems: 'center' },
    divider: { width: 1, backgroundColor: '#E2E8F0' },
    statLabel: { fontSize: 12, color: '#64748B', fontWeight: '700', marginBottom: 4 },
    statValue: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 12, marginTop: 10 },
    description: { fontSize: 16, color: '#475569', lineHeight: 24, marginBottom: 30 },
    reqList: { gap: 12 },
    reqItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    reqText: { fontSize: 15, color: '#334155' },
    footer: { position: 'absolute', bottom: 90, left: 20, right: 20, borderRadius: 20, backgroundColor: '#fff', padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10, zIndex: 100 },
    footerLabel: { fontSize: 12, color: '#64748B' },
    footerPrice: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
    acceptBtn: { backgroundColor: '#0F172A', flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 14, gap: 8 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '700' }
});