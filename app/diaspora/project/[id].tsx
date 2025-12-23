import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, Image, ScrollView, TouchableOpacity,
    ActivityIndicator, Dimensions, StatusBar, Alert, RefreshControl
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import NavigationBar from '@/components/NavigationBar';
import BudgetProgress from '@/components/BudgetProgress'; // Ensure you have this
import { mediumFeedback, successFeedback } from '@/utils/haptics';

const { width } = Dimensions.get('window');

export default function ProjectDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();

    const [project, setProject] = useState<any>(null);
    const [expenses, setExpenses] = useState<any[]>([]);
    // NEW: State for applications
    const [applications, setApplications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async () => {
        if (!id) {
            setLoading(false);
            return;
        }

        try {
            // 1. Fetch Project Data
            const { data: projectData, error: projError } = await supabase
                .from('projects')
                .select('*')
                .eq('id', id)
                .single();

            if (projError) throw projError;

            // 2. Fetch Expenses
            const { data: expData, error: expError } = await supabase
                .from('project_expenses')
                .select('*')
                .eq('project_id', id)
                .order('created_at', { ascending: false });

            // 3. Fetch Applications (Pending requests from providers)
            const { data: appData } = await supabase
                .from('project_applications')
                .select('*, provider:provider_id(email)') // Fetch provider email/details if possible
                .eq('project_id', id)
                .eq('status', 'pending');

            setProject(projectData);
            setExpenses(expData || []);
            setApplications(appData || []);

        } catch (e: any) {
            console.error("Error loading project:", e.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    // --- HIRE LOGIC ---
    const handleHireProvider = async (providerId: string, applicationId: number) => {
        mediumFeedback();
        Alert.alert(
            "Hire this Provider?",
            "This will assign them to the project and start the work.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Hire Now",
                    onPress: async () => {
                        setLoading(true);
                        // 1. Update Project: Set Status to 'In Progress' & Assign Provider
                        const { error: projError } = await supabase
                            .from('projects')
                            .update({ provider_id: providerId, status: 'In Progress' })
                            .eq('id', id);

                        // 2. Update Application: Mark as Accepted
                        const { error: appError } = await supabase
                            .from('project_applications')
                            .update({ status: 'accepted' })
                            .eq('id', applicationId);

                        if (!projError && !appError) {
                            successFeedback();
                            Alert.alert("Success", "Provider hired! Project is now active.");
                            fetchData(); // Refresh page
                        } else {
                            Alert.alert("Error", "Could not hire provider.");
                        }
                        setLoading(false);
                    }
                }
            ]
        );
    };

    // --- DELETE LOGIC ---
    const handleDeleteProject = async () => {
        if (!project) return;
        Alert.alert("Delete Project?", "This cannot be undone.", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: 'destructive',
                onPress: async () => {
                    await supabase.from('projects').delete().eq('id', id);
                    router.replace('/diaspora');
                }
            }
        ]);
    };

    // Helper to determine active step
    const getStatusStep = () => {
        if (!project) return 0;
        if (project.status === 'Pending') return 0;
        if (project.status === 'In Progress') return 1;
        if (project.status === 'Completed') return 2;
        return 0;
    };

    const totalSpent = expenses.reduce((sum, item) => sum + (item.status === 'approved' ? item.amount : 0), 0);

    if (loading) return (
        <View style={styles.center}><ActivityIndicator size="large" color="#0F172A" /></View>
    );

    if (!project) return (
        <View style={styles.center}><Text>Project not found.</Text></View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <NavigationBar title="Project Hub" showBack={true} />

            <ScrollView
                contentContainerStyle={{ paddingBottom: 60 }}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* 1. HERO HEADER */}
                <View style={styles.imageHeader}>
                    <Image
                        source={{ uri: project.image_url || 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5' }}
                        style={styles.heroImage}
                    />
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.gradientOverlay}>
                        <View style={styles.headerContent}>
                            <View style={styles.tag}>
                                <Text style={styles.tagText}>{project.status?.toUpperCase()}</Text>
                            </View>
                            <Text style={styles.title}>{project.title}</Text>
                            <Text style={styles.location}>
                                <Ionicons name="location" size={16} color="#CBD5E1" /> {project.city}
                            </Text>
                        </View>
                    </LinearGradient>
                </View>

                <View style={styles.body}>

                    {/* 2. PROGRESS STEPPER */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Project Status</Text>
                        <View style={styles.stepperContainer}>
                            {['Pending', 'Active', 'Done'].map((step, index) => {
                                const activeStep = getStatusStep();
                                const isActive = index <= activeStep;
                                return (
                                    <View key={index} style={styles.stepWrapper}>
                                        <View style={[styles.stepCircle, isActive && styles.stepActive]}>
                                            {index < activeStep ? (
                                                <Ionicons name="checkmark" size={14} color="#fff" />
                                            ) : (
                                                <Text style={[styles.stepNum, isActive && { color: '#fff' }]}>{index + 1}</Text>
                                            )}
                                        </View>
                                        <Text style={[styles.stepLabel, isActive && styles.labelActive]}>{step}</Text>
                                        {index < 2 && <View style={[styles.stepLine, index < activeStep && styles.lineActive]} />}
                                    </View>
                                );
                            })}
                        </View>
                    </View>

                    {/* 3. MONEY HUB */}
                    <BudgetProgress totalBudget={project.budget || 0} spent={totalSpent} />

                    {/* 4. ACTIONS ROW */}
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: id } })}
                        >
                            <Ionicons name="chatbubbles" size={20} color="#0EA5E9" />
                            <Text style={styles.actionText}>Chat</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => router.push({ pathname: '/diaspora/timeline', params: { id: id } })}
                        >
                            <Ionicons name="images" size={20} color="#0EA5E9" />
                            <Text style={styles.actionText}>Photos</Text>
                        </TouchableOpacity>
                    </View>

                    {/* 5. PROVIDER APPLICATIONS SECTION (Crucial Fix) */}
                    {project.status === 'Pending' && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Provider Requests</Text>
                            {applications.length === 0 ? (
                                <View style={styles.waitingCard}>
                                    <Ionicons name="hourglass-outline" size={24} color="#64748B" />
                                    <Text style={styles.waitingText}>Waiting for providers...</Text>
                                </View>
                            ) : (
                                applications.map((app) => (
                                    <View key={app.id} style={styles.appCard}>
                                        <View style={{flex: 1}}>
                                            <Text style={styles.appName}>New Application</Text>
                                            <Text style={styles.appDate}>{new Date(app.created_at).toLocaleDateString()}</Text>
                                        </View>
                                        <TouchableOpacity
                                            style={styles.hireBtn}
                                            onPress={() => handleHireProvider(app.provider_id, app.id)}
                                        >
                                            <Text style={styles.hireText}>HIRE</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))
                            )}
                        </View>
                    )}

                    {/* 6. ASSIGNED PROVIDER (If Active) */}
                    {project.status !== 'Pending' && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Assigned Provider</Text>
                            <View style={styles.providerCard}>
                                <Image source={{ uri: 'https://i.pravatar.cc/150?u=provider' }} style={styles.providerImg} />
                                <View>
                                    <Text style={styles.providerName}>Contractor Active</Text>
                                    <Text style={styles.providerSub}>Work in progress</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* 7. DELETE BUTTON (Only if Pending) */}
                    {project.status === 'Pending' && (
                        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteProject}>
                            <Ionicons name="trash-outline" size={20} color="#EF4444" />
                            <Text style={styles.deleteText}>Delete Project</Text>
                        </TouchableOpacity>
                    )}

                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Header
    imageHeader: { height: 250, width: '100%', position: 'relative' },
    heroImage: { width: '100%', height: '100%' },
    gradientOverlay: { position: 'absolute', bottom: 0, width: '100%', height: '100%', justifyContent: 'flex-end', padding: 24 },
    headerContent: { marginBottom: 10 },
    tag: { backgroundColor: '#0EA5E9', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 10 },
    tagText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    title: { color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 4 },
    location: { color: '#E2E8F0', fontSize: 16, fontWeight: '500' },

    // Body
    body: { padding: 24, marginTop: -20, backgroundColor: '#F8FAFC', borderTopLeftRadius: 30, borderTopRightRadius: 30 },
    section: { marginBottom: 30 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 16 },

    // Stepper
    stepperContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10 },
    stepWrapper: { alignItems: 'center', flex: 1, position: 'relative' },
    stepCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', marginBottom: 8, zIndex: 2 },
    stepActive: { backgroundColor: '#0EA5E9' },
    stepNum: { fontSize: 12, fontWeight: '700', color: '#64748B' },
    stepLabel: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
    labelActive: { color: '#0F172A' },
    stepLine: { position: 'absolute', top: 16, left: '50%', width: '100%', height: 2, backgroundColor: '#E2E8F0', zIndex: 1 },
    lineActive: { backgroundColor: '#0EA5E9' },

    // Actions
    actionRow: { flexDirection: 'row', gap: 12, marginBottom: 30 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', paddingVertical: 12, borderRadius: 14, gap: 8, borderWidth: 1, borderColor: '#E2E8F0' },
    actionText: { color: '#0F172A', fontWeight: '700', fontSize: 14 },

    // Provider / App Cards
    waitingCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, backgroundColor: '#F1F5F9', borderRadius: 16 },
    waitingText: { color: '#64748B', fontWeight: '600' },

    appCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    appName: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
    appDate: { fontSize: 12, color: '#64748B' },
    hireBtn: { backgroundColor: '#16A34A', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    hireText: { color: '#fff', fontWeight: '700', fontSize: 12 },

    providerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' },
    providerImg: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
    providerName: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
    providerSub: { fontSize: 12, color: '#64748B' },

    // Delete
    deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, padding: 15, borderRadius: 14, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FEE2E2' },
    deleteText: { color: '#EF4444', fontWeight: '700', fontSize: 14 }
});