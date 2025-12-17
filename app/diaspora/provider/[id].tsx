// Location: app/diaspora/provider/[id].tsx

import React from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons'; // Standard Expo icons

// 1. Fake Database (Matches the verified list data)
const PROVIDERS_DB: any = {
    '1': {
        id: '1',
        name: 'Buea Construction Ltd',
        city: 'Buea',
        service: 'Construction',
        rating: 4.8,
        jobs: 24,
        verified: true, // Has Blue Checkmark
        bio: 'We specialize in residential renovations and new builds. Our team consists of 5 experienced masons and 2 architects. We send daily WhatsApp video updates.',
        image: require('@/assets/images/logo.jpeg'), // Placeholder using your logo
        portfolio: [
            'https://via.placeholder.com/300/F97316/FFFFFF?text=Kitchen+Reno',
            'https://via.placeholder.com/300/2563EB/FFFFFF?text=House+Build',
            'https://via.placeholder.com/300/10B981/FFFFFF?text=Roofing',
        ]
    },
    'default': {
        id: '0',
        name: 'Standard Provider',
        city: 'Cameroon',
        service: 'General',
        rating: 4.0,
        jobs: 10,
        verified: false,
        bio: 'Experienced professional ready to work.',
        image: require('@/assets/images/logo.jpeg'),
        portfolio: ['https://via.placeholder.com/300/CCCCCC/000000?text=Work+Sample']
    }
};

export default function ProviderDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();

    // Load provider or fallback to default
    const provider = PROVIDERS_DB[id as string] || PROVIDERS_DB['default'];

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* HEADER: Cover Image + Back Button */}
                <View style={styles.header}>
                    <Image source={{ uri: 'https://via.placeholder.com/600/1e293b/FFFFFF?text=Service+Cover' }} style={styles.coverImage} />
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* PROFILE CARD: Overlapping the header */}
                <View style={styles.profileCard}>
                    <View style={styles.avatarContainer}>
                        <Image source={provider.image} style={styles.avatar} />
                        {/* TRUST FEATURE: Verified Badge */}
                        {provider.verified && (
                            <View style={styles.verifiedBadge}>
                                <Ionicons name="checkmark" size={12} color="#fff" />
                            </View>
                        )}
                    </View>

                    <Text style={styles.name}>{provider.name}</Text>
                    <Text style={styles.subtext}>{provider.service} • {provider.city}</Text>

                    {/* STATS ROW */}
                    <View style={styles.statsRow}>
                        <View style={styles.stat}>
                            <Text style={styles.statValue}>⭐ {provider.rating}</Text>
                            <Text style={styles.statLabel}>Rating</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.stat}>
                            <Text style={styles.statValue}>{provider.jobs}</Text>
                            <Text style={styles.statLabel}>Jobs Done</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.stat}>
                            <Text style={[styles.statValue, { color: provider.verified ? '#2563eb' : '#64748b' }]}>
                                {provider.verified ? 'Verified' : 'Unverified'}
                            </Text>
                            <Text style={styles.statLabel}>Status</Text>
                        </View>
                    </View>

                    {/* WOW FACTOR: Video Intro Button */}
                    <TouchableOpacity
                        style={styles.videoButton}
                        onPress={() => Alert.alert('Video Intro', 'This would play a 15s video of the provider introducing themselves.')}
                    >
                        <Ionicons name="play-circle-outline" size={20} color="#2563eb" />
                        <Text style={styles.videoButtonText}>Watch Video Introduction</Text>
                    </TouchableOpacity>
                </View>

                {/* DETAILS SECTION */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>About</Text>
                    <Text style={styles.bioText}>{provider.bio}</Text>
                </View>

                {/* PORTFOLIO SECTION */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Recent Work</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.portfolioScroll}>
                        {provider.portfolio.map((imgUrl: string, index: number) => (
                            <Image key={index} source={{ uri: imgUrl }} style={styles.portfolioImg} />
                        ))}
                    </ScrollView>
                </View>

                {/* Spacer for bottom bar */}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* BOTTOM ACTION BAR */}
            <View style={styles.bottomBar}>
                <View style={styles.priceContainer}>
                    <Text style={styles.priceLabel}>Starting from</Text>
                    <Text style={styles.priceValue}>50k CFA<Text style={styles.perDay}>/day</Text></Text>
                </View>
                <TouchableOpacity
                    style={styles.hireButton}
                    onPress={() => router.push('/diaspora/new')}
                >
                    <Text style={styles.hireButtonText}>Hire Now</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    scrollContent: { paddingBottom: 20 },

    header: { height: 180, width: '100%', position: 'relative' },
    coverImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    backButton: {
        position: 'absolute', top: 50, left: 20,
        backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 20
    },

    profileCard: {
        marginTop: -40, marginHorizontal: 20,
        backgroundColor: '#fff', borderRadius: 16,
        padding: 20, alignItems: 'center',
        shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5,
    },
    avatarContainer: { position: 'relative', marginBottom: 10 },
    avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#eee' },
    verifiedBadge: {
        position: 'absolute', bottom: 0, right: 0,
        backgroundColor: '#2563eb', padding: 4, borderRadius: 10, borderWidth: 2, borderColor: '#fff'
    },
    name: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
    subtext: { fontSize: 14, color: '#64748b', marginTop: 4 },

    statsRow: { flexDirection: 'row', marginTop: 20, alignItems: 'center' },
    stat: { alignItems: 'center', paddingHorizontal: 15 },
    statValue: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
    statLabel: { fontSize: 12, color: '#64748b' },
    divider: { width: 1, height: 24, backgroundColor: '#e2e8f0' },

    videoButton: {
        flexDirection: 'row', alignItems: 'center', marginTop: 16,
        paddingVertical: 8, paddingHorizontal: 16,
        backgroundColor: '#eff6ff', borderRadius: 20,
    },
    videoButtonText: { color: '#2563eb', fontWeight: '600', marginLeft: 6, fontSize: 13 },

    section: { padding: 20, paddingBottom: 0 },
    sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 10, color: '#1e293b' },
    bioText: { fontSize: 14, color: '#475569', lineHeight: 22 },

    portfolioScroll: { marginTop: 5 },
    portfolioImg: { width: 140, height: 100, borderRadius: 8, marginRight: 10, backgroundColor: '#ddd' },

    bottomBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: '#fff', padding: 16, paddingBottom: 30,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        borderTopWidth: 1, borderTopColor: '#f1f5f9',
        elevation: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10,
    },
    priceContainer: { flexDirection: 'column' },
    priceLabel: { fontSize: 12, color: '#64748b' },
    priceValue: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
    perDay: { fontSize: 12, fontWeight: '400', color: '#64748b' },

    hireButton: {
        backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 30,
        borderRadius: 30,
    },
    hireButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});