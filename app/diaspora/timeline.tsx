import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, ActivityIndicator, ImageBackground } from 'react-native';
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
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#0f172a" />
                </Pressable>
                <View style={{ flex: 1 }}>
                    <Text style={styles.projectTitle}>Duplex Foundation</Text>
                    <Text style={styles.projectSub}>Bonapriso, Douala</Text>
                </View>
                <View style={styles.budgetBadge}>
                    <Text style={styles.budgetLabel}>Budget</Text>
                    <Text style={styles.budgetText}>200k CFA</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.sectionTitle}>Progress Timeline</Text>

                <View style={styles.timelineContainer}>
                    <View style={styles.verticalLine} />
                    {events.map((event, index) => {
                        const showLine = index !== events.length - 1;
                        return (
                            <View key={event.id} style={styles.timelineItem}>
                                <View style={styles.dotWrapper}>
                                    <View style={[
                                        styles.dot,
                                        event.isLatest ? styles.dotActive : styles.dotPast
                                    ]}>
                                        {event.status === 'approved' && <Ionicons name="checkmark" size={12} color="#fff" />}
                                    </View>
                                    {showLine && <View style={styles.connector} />}
                                </View>

                                <View style={styles.cardShell}>
                                    <View style={styles.cardHeaderRow}>
                                        <Text style={styles.dateText}>{event.date}</Text>
                                        {event.isLatest && <View style={styles.newBadge}><Text style={styles.newText}>LIVE</Text></View>}
                                    </View>

                                    <Text style={styles.eventTitle}>{event.title}</Text>
                                    <Text style={styles.description}>{event.description}</Text>

                                    {event.image && (
                                        <ImageBackground source={{ uri: event.image }} style={styles.imageContainer} imageStyle={styles.imageBg}>
                                            <View style={styles.imageOverlay} />
                                            <Pressable style={styles.previewChip}>
                                                <Ionicons name="image" size={16} color="#fff" />
                                                <Text style={styles.previewText}>Site proof</Text>
                                            </Pressable>
                                        </ImageBackground>
                                    )}

                                    {event.status === 'pending_approval' && (
                                        <View style={styles.actionContainer}>
                                            <Text style={styles.actionLabel}>Release funds for this milestone</Text>

                                            <Pressable
                                                style={[styles.approveBtn, loading && styles.approveBtnDisabled]}
                                                onPress={handleApprove}
                                                disabled={loading}
                                            >
                                                {loading ? (
                                                    <ActivityIndicator color="#fff" />
                                                ) : (
                                                    <>
                                                        <Ionicons name="lock-closed" size={18} color="#fff" />
                                                        <Text style={styles.approveText}>Approve & Release 50,000 CFA</Text>
                                                        <Ionicons name="arrow-forward" size={18} color="#fff" />
                                                    </>
                                                )}
                                            </Pressable>
                                        </View>
                                    )}
                                </View>
                            </View>
                        );
                    })}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f1f5f9' },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: '#fff', width: '80%', padding: 30, borderRadius: 20, alignItems: 'center', elevation: 10 },
    successIcon: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#4CAF50', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
    modalText: { textAlign: 'center', color: '#666', marginBottom: 20, lineHeight: 22 },
    closeBtn: { backgroundColor: '#000', paddingVertical: 12, paddingHorizontal: 40, borderRadius: 30 },
    closeText: { color: '#fff', fontWeight: 'bold' },

    // Header
    header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#fff' },
    backBtn: { padding: 10, marginRight: 12, backgroundColor: '#e2e8f0', borderRadius: 14 },
    projectTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
    projectSub: { fontSize: 13, color: '#475569' },
    budgetBadge: { backgroundColor: '#e0f2f1', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, alignItems: 'flex-end' },
    budgetLabel: { fontSize: 11, color: '#0f172a', fontWeight: '700' },
    budgetText: { color: '#0f172a', fontWeight: '800', fontSize: 14 },

    scrollContent: { padding: 20 },
    sectionTitle: { fontSize: 20, fontWeight: '800', marginBottom: 20, color: '#0f172a' },

    // Timeline
    timelineContainer: { paddingLeft: 12, position: 'relative' },
    verticalLine: { position: 'absolute', top: 0, left: 12, width: 2, height: '100%', backgroundColor: '#cbd5e1' },
    timelineItem: { flexDirection: 'row', minHeight: 120, marginBottom: 20 },
    dotWrapper: { width: 30, alignItems: 'center', position: 'relative' },
    connector: { position: 'absolute', top: 28, left: 13, width: 2, height: '100%', backgroundColor: '#cbd5e1' },
    dot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', zIndex: 2, borderWidth: 3, borderColor: '#e2e8f0' },
    dotActive: { backgroundColor: '#0f172a' },
    dotPast: { backgroundColor: '#10b981' },

    cardShell: {
        flex: 1,
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#0f172a',
        shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 18,
        elevation: 3,
    },
    cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    dateText: { fontSize: 12, color: '#475569', fontWeight: '700' },
    newBadge: { backgroundColor: '#0f172a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
    newText: { color: '#fff', fontSize: 10, fontWeight: '800' },

    eventTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginTop: 8 },
    description: { fontSize: 14, color: '#475569', lineHeight: 22, marginTop: 6 },
    imageContainer: { height: 240, borderRadius: 16, overflow: 'hidden', marginTop: 14, marginBottom: 12, justifyContent: 'flex-end' },
    imageBg: { borderRadius: 16 },
    imageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.25)' },
    previewChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(15,23,42,0.6)', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, margin: 12, alignSelf: 'flex-start' },
    previewText: { color: '#fff', fontWeight: '700' },

    // Action Button
    actionContainer: { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 12, marginTop: 8 },
    actionLabel: { fontSize: 12, color: '#0f172a', marginBottom: 10, textAlign: 'center', fontWeight: '700' },
    approveBtn: { backgroundColor: '#0f172a', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 14, gap: 10 },
    approveBtnDisabled: { backgroundColor: '#1f2937' },
    approveText: { color: '#fff', fontWeight: '800', fontSize: 14 }
});
