import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native'; //
import { successFeedback } from '@/utils/haptics';
import { LinearGradient } from 'expo-linear-gradient';

export default function AvailableProjectCard({ project, onAccept }: any) {
    const [isAccepted, setIsAccepted] = useState(false);
    const animationRef = useRef<LottieView>(null); //

    const handleAccept = async () => {
        // Use a function reference to prevent auto-execution
        console.log("Accepting project:", project.title);
        successFeedback();
        setIsAccepted(true);

        // Play animation programmatically
        animationRef.current?.reset();
        animationRef.current?.play();

        // Delay the parent logic so the user sees the "Success" animation
        setTimeout(() => {
            if (onAccept) onAccept(project);
        }, 1800);
    };

    return (
        <View style={styles.oppCard}>
            {/* 1. Background Image must come FIRST in JSX */}
            <Image source={{ uri: project.image_url }} style={styles.oppImage} />
            <LinearGradient
                colors={['transparent', 'rgba(15, 23, 42, 0.95)']}
                style={styles.oppGradient}
            />

            {/* 2. Content Container */}
            <View style={styles.oppContent}>
                <View style={styles.oppHeader}>
                    <Text style={styles.oppBudget}>
                        {project.budget?.toLocaleString()} <Text style={styles.cfa}>CFA</Text>
                    </Text>
                </View>

                <Text style={styles.oppTitle} numberOfLines={1}>{project.title}</Text>

                <View style={styles.oppFooter}>
                    <View style={styles.oppLoc}>
                        <Ionicons name="location" size={14} color="#38BDF8" />
                        <Text style={styles.oppLocText}>{project.city}</Text>
                    </View>

                    {/* 3. The Interactive Button (Higher zIndex ensures it's clickable) */}
                    <TouchableOpacity
                        style={[styles.oppBtn, isAccepted && styles.btnSuccess]}
                        onPress={handleAccept}
                        activeOpacity={0.7}
                        disabled={isAccepted}
                    >
                        {isAccepted ? (
                            <LottieView
                                ref={animationRef}
                                // Ensure this file exists in your assets
                                source={require('@/assets/animations/success-check.json')}
                                style={styles.lottie}
                                loop={false}
                                autoPlay={false} // Trigger manually via ref
                            />
                        ) : (
                            <Text style={styles.oppBtnText}>Accept Project</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    oppCard: {
        height: 220,
        borderRadius: 28,
        backgroundColor: '#0F172A',
        overflow: 'hidden',
        marginBottom: 20,
        elevation: 5 // Shadow for Android
    },
    oppImage: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
        height: '100%',
        opacity: 0.7
    },
    oppGradient: {
        ...StyleSheet.absoluteFillObject
    },
    oppContent: {
        flex: 1,
        justifyContent: 'flex-end',
        padding: 20,
        zIndex: 10 // Content stays above background
    },
    oppBudget: {
        color: '#38BDF8',
        fontSize: 24,
        fontWeight: '900'
    },
    cfa: {
        fontSize: 14,
        fontWeight: '600'
    },
    oppTitle: {
        color: '#fff',
        fontSize: 19,
        fontWeight: '800',
        marginBottom: 12
    },
    oppFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    oppLoc: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    oppLocText: {
        color: '#CBD5E1',
        fontSize: 14,
        fontWeight: '600'
    },
    oppBtn: {
        backgroundColor: '#fff',
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 15,
        minWidth: 130,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100 // Highest priority for touch
    },
    btnSuccess: {
        backgroundColor: '#10B981'
    },
    oppBtnText: {
        color: '#0F172A',
        fontWeight: '900',
        fontSize: 14
    },
    lottie: {
        width: 45,
        height: 45
    } // Explicit pixels required for v6+
});