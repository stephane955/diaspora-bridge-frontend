import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useGlobal } from '@/context/GlobalContext';

export default function ProjectTimeline() {
    const router = useRouter();
    const { events } = useGlobal();

    // NEW: States for the "Payment Flow"
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const handleApprove = () => {
        // 1. Start "Bank Processing" simulation
        setLoading(true);

        // 2. Wait 2 seconds, then show Success
        setTimeout(() => {
            setLoading(false);
            setShowSuccess(true);
        }, 2000);
    };

    const closeSuccess = () => {
        setShowSuccess(false);
        // Optional: Navigate back or refresh
    };

    return (
        <View style={styles.container}>
            {/* --- SUCCESS MODAL (The "Nice" Part) --- */}
            <Modal visible={showSuccess} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.successIcon}>
                            <Ionicons name="checkmark" size={40} color="#fff" />
                        </View>
                        <Text style={styles.modalTitle}>Payment Sent!</Text>
                        <Text style={styles.modalText}>
                            You have successfully released <Text style={{fontWeight: 'bold'}}>50,000 CFA</Text> to the provider.
                        </Text>
                        <TouchableOpacity style={styles.closeBtn} onPress={closeSuccess}>
                            <Text style={styles.closeText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.projectTitle}>Duplex Foundation</Text>
                    <Text style={styles.projectSub}>Bonapriso, Douala</Text>
                </View>
                <View style={styles.budgetBadge}>
                    <Text style={styles.budgetText}>200k CFA</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.sectionTitle}>Progress Timeline</Text>

                <View style={styles.timelineContainer}>
                    {events.map((event, index) => (
                        <View key={event.id} style={styles.timelineItem}>

                            <View style={styles.leftColumn}>
                                <View style={[
                                    styles.dot,
                                    event.isLatest ? styles.dotActive : styles.dotPast
                                ]}>
                                    {event.status === 'approved' && <Ionicons name="checkmark" size={12} color="#fff" />}
                                </View>
                                {index !== events.length - 1 && <View style={styles.line} />}
                            </View>

                            <View style={styles.rightColumn}>
                                <Text style={styles.dateText}>{event.date}</Text>

                                <View style={[
                                    styles.eventCard,
                                    event.isLatest ? styles.cardActive : styles.cardPast
                                ]}>
                                    <View style={styles.eventHeader}>
                                        <Text style={styles.eventTitle}>{event.title}</Text>
                                        {event.isLatest && <View style={styles.newBadge}><Text style={styles.newText}>NEW</Text></View>}
                                    </View>

                                    <Text style={styles.description}>{event.description}</Text>

                                    {event.image && (
                                        <View style={styles.imageContainer}>
                                            <Image source={{ uri: event.image }} style={styles.proofImage} />
                                        </View>
                                    )}

                                    {/* APPROVAL ACTION */}
                                    {event.status === 'pending_approval' && (
                                        <View style={styles.actionContainer}>
                                            <Text style={styles.actionLabel}>Satisfied with the work?</Text>

                                            <TouchableOpacity
                                                style={[styles.approveBtn, loading && styles.approveBtnDisabled]}
                                                onPress={handleApprove}
                                                disabled={loading}
                                            >
                                                {loading ? (
                                                    <ActivityIndicator color="#fff" />
                                                ) : (
                                                    <>
                                                        <Text style={styles.approveText}>Approve & Release Funds</Text>
                                                        <Ionicons name="arrow-forward" size={18} color="#fff" />
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: '#fff', width: '80%', padding: 30, borderRadius: 20, alignItems: 'center', elevation: 10 },
    successIcon: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#4CAF50', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
    modalText: { textAlign: 'center', color: '#666', marginBottom: 20, lineHeight: 22 },
    closeBtn: { backgroundColor: '#000', paddingVertical: 12, paddingHorizontal: 40, borderRadius: 30 },
    closeText: { color: '#fff', fontWeight: 'bold' },

    // Header
    header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    backBtn: { padding: 8, marginRight: 10, backgroundColor: '#f5f5f5', borderRadius: 20 },
    projectTitle: { fontSize: 18, fontWeight: 'bold', color: '#000' },
    projectSub: { fontSize: 13, color: '#666' },
    budgetBadge: { marginLeft: 'auto', backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    budgetText: { color: '#2E7D32', fontWeight: 'bold', fontSize: 12 },

    scrollContent: { padding: 20 },
    sectionTitle: { fontSize: 20, fontWeight: '800', marginBottom: 20, color: '#1a1a1a' },

    // Timeline
    timelineContainer: { paddingLeft: 10 },
    timelineItem: { flexDirection: 'row', minHeight: 100 },
    leftColumn: { alignItems: 'center', width: 30, marginRight: 15 },
    line: { flex: 1, width: 2, backgroundColor: '#e0e0e0', marginVertical: 4 },
    dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
    dotActive: { backgroundColor: '#007AFF', borderWidth: 4, borderColor: '#D1E5FF' },
    dotPast: { backgroundColor: '#4CAF50' },

    rightColumn: { flex: 1, paddingBottom: 30 },
    dateText: { fontSize: 12, color: '#999', marginBottom: 6, fontWeight: '600' },

    eventCard: { padding: 16, borderRadius: 16, borderWidth: 1 },
    cardActive: { backgroundColor: '#fff', borderColor: '#007AFF', shadowColor: "#007AFF", shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
    cardPast: { backgroundColor: '#f9f9f9', borderColor: 'transparent' },

    eventHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    eventTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
    newBadge: { backgroundColor: '#FF3B30', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    newText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

    description: { fontSize: 14, color: '#555', lineHeight: 20, marginBottom: 12 },
    imageContainer: { height: 160, borderRadius: 12, overflow: 'hidden', marginBottom: 15, position: 'relative' },
    proofImage: { width: '100%', height: '100%' },

    // Action Button
    actionContainer: { borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12 },
    actionLabel: { fontSize: 12, color: '#888', marginBottom: 8, textAlign: 'center' },
    approveBtn: { backgroundColor: '#000', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 10, gap: 8 },
    approveBtnDisabled: { backgroundColor: '#999' },
    approveText: { color: '#fff', fontWeight: 'bold', fontSize: 14 }
});