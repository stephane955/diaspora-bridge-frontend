import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// 1. DEFINE THE DATA TYPE
type Request = {
    id: string;
    client: string;
    project: string;
    budget: string;
    location: string;
    distance: string;
    expiresIn: string;
    isVerified: boolean;
};

// 2. MOCK DATA
const requests: Request[] = [
    {
        id: '1',
        client: 'Jean-Pierre',
        project: 'Duplex Foundation',
        budget: '200,000 CFA',
        location: 'Douala, Bonapriso',
        distance: '2.5 km away',
        expiresIn: '4 hours',
        isVerified: true
    },
    {
        id: '2',
        client: 'Sarah M.',
        project: 'Kitchen Tiling',
        budget: '85,000 CFA',
        location: 'Douala, Akwa',
        distance: '5.0 km away',
        expiresIn: '12 hours',
        isVerified: false
    },
];

export default function RequestsScreen() {

    const renderItem = ({ item }: { item: Request }) => (
        <View style={styles.ticketContainer}>
            {/* LEFT SIDE: The "Offer" */}
            <View style={styles.ticketMain}>

                {/* Header: Urgency & Trust */}
                <View style={styles.ticketHeader}>
                    <View style={styles.tagContainer}>
                        <Ionicons name="time" size={12} color="#D32F2F" />
                        <Text style={styles.urgencyText}>Expires in {item.expiresIn}</Text>
                    </View>
                    {item.isVerified && (
                        <View style={styles.verifiedBadge}>
                            <Ionicons name="checkmark-circle" size={12} color="#007AFF" />
                            <Text style={styles.verifiedText}>Verified</Text>
                        </View>
                    )}
                </View>

                {/* The Money Shot */}
                <Text style={styles.budget}>{item.budget}</Text>
                <Text style={styles.projectTitle}>{item.project}</Text>

                {/* Location Details */}
                <View style={styles.locationRow}>
                    <View style={styles.iconBox}>
                        <Ionicons name="location" size={14} color="#555" />
                    </View>
                    <View>
                        <Text style={styles.locationTitle}>{item.location}</Text>
                        <Text style={styles.distance}>{item.distance}</Text>
                    </View>
                </View>
            </View>

            {/* SEPARATOR (The "Perforated Line" Look) */}
            <View style={styles.separator}>
                <View style={styles.circleTop} />
                <View style={styles.line} />
                <View style={styles.circleBottom} />
            </View>

            {/* RIGHT SIDE: The Actions */}
            <View style={styles.ticketActions}>
                <View style={styles.clientAvatar}>
                    <Text style={styles.avatarText}>{item.client.charAt(0)}</Text>
                </View>
                <Text style={styles.clientName}>{item.client}</Text>

                <TouchableOpacity style={styles.acceptBtn} activeOpacity={0.8}>
                    <Text style={styles.acceptText}>ACCEPT</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.declineBtn}>
                    <Text style={styles.declineText}>Decline</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.pageTitle}>New Opportunities ({requests.length})</Text>
            <FlatList
                data={requests}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={{ paddingBottom: 20 }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f4f6f8', padding: 20 },
    pageTitle: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginBottom: 20 },

    // Ticket Container
    ticketContainer: { flexDirection: 'row', height: 190, marginBottom: 20,
        // Shadow
        shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5
    },

    // LEFT SIDE
    ticketMain: { flex: 2, backgroundColor: '#fff', borderTopLeftRadius: 16, borderBottomLeftRadius: 16, padding: 16, justifyContent: 'space-between' },
    ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

    tagContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFEBEE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
    urgencyText: { color: '#D32F2F', fontSize: 10, fontWeight: '700' },

    verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    verifiedText: { color: '#007AFF', fontSize: 10, fontWeight: '700' },

    budget: { fontSize: 26, fontWeight: '900', color: '#2E7D32', letterSpacing: -0.5 },
    projectTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginTop: -5 },

    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    iconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
    locationTitle: { fontSize: 12, fontWeight: '700', color: '#333' },
    distance: { fontSize: 11, color: '#888' },

    // SEPARATOR
    separator: { width: 20, backgroundColor: '#f4f6f8', alignItems: 'center', justifyContent: 'center' },
    line: { width: 1, height: '80%', borderStyle: 'dashed', borderWidth: 1, borderColor: '#ccc' },
    circleTop: { position: 'absolute', top: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: '#f4f6f8' }, // Matches background to cut corner
    circleBottom: { position: 'absolute', bottom: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: '#f4f6f8' },

    // RIGHT SIDE
    ticketActions: { flex: 1, backgroundColor: '#fff', borderTopRightRadius: 16, borderBottomRightRadius: 16, padding: 12, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: '#f0f0f0' },

    clientAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
    clientName: { fontSize: 12, color: '#666', marginBottom: 12, textAlign: 'center' },

    acceptBtn: { backgroundColor: '#000', width: '100%', paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginBottom: 8 },
    acceptText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },

    declineBtn: { width: '100%', paddingVertical: 6, alignItems: 'center' },
    declineText: { color: '#999', fontSize: 11, fontWeight: '600' }
});