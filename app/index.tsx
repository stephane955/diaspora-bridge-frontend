// app/index.tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
    const router = useRouter();

    // stage 1: logo + title
    const heroOpacity = useRef(new Animated.Value(0)).current;
    const heroTranslate = useRef(new Animated.Value(30)).current;

    // stage 2: buttons
    const buttonsOpacity = useRef(new Animated.Value(0)).current;
    const buttonsTranslate = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        // animate hero a bit slower
        Animated.parallel([
            Animated.timing(heroOpacity, {
                toValue: 1,
                duration: 700,              // was 400
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(heroTranslate, {
                toValue: 0,
                duration: 700,              // was 400
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start(() => {
            // then show buttons
            Animated.parallel([
                Animated.timing(buttonsOpacity, {
                    toValue: 1,
                    duration: 350,
                    useNativeDriver: true,
                }),
                Animated.timing(buttonsTranslate, {
                    toValue: 0,
                    duration: 350,
                    useNativeDriver: true,
                }),
            ]).start();
        });
    }, [heroOpacity, heroTranslate, buttonsOpacity, buttonsTranslate]);

    return (
        <View style={styles.container}>
            <Image source={require('@/assets/images/bg.jpeg')} style={styles.bg} resizeMode="cover" />
            <View style={styles.overlay} />

            <View style={styles.center}>
                <Animated.View
                    style={{
                        alignItems: 'center',
                        opacity: heroOpacity,
                        transform: [{ translateY: heroTranslate }],
                    }}
                >
                    <Image
                        source={require('@/assets/images/logo.jpeg')}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                    <Text style={styles.appName}>Diaspora Bridge</Text>
                    <Text style={styles.tagline}>
                        Connect diaspora to trusted services in Cameroon.
                    </Text>
                </Animated.View>

                <Animated.View
                    style={{
                        width: '100%',
                        alignItems: 'center',
                        opacity: buttonsOpacity,
                        transform: [{ translateY: buttonsTranslate }],
                        marginTop: 28,
                    }}
                >
                    <TouchableOpacity
                        activeOpacity={0.8}
                        style={styles.primaryButton}
                        onPress={() => router.push('/login')}
                    >
                        <Text style={styles.primaryText}>Login</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        activeOpacity={0.8}
                        style={styles.secondaryButton}
                        onPress={() => router.push('/signup')}
                    >
                        <Text style={styles.secondaryText}>Sign up</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    bg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    logo: { width: 140, height: 100, marginBottom: 16 },
    appName: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 4,
        textAlign: 'center',
    },
    tagline: {
        fontSize: 14,
        color: '#e2e8f0',
        textAlign: 'center',
        lineHeight: 20,
    },
    primaryButton: {
        backgroundColor: '#f97316',
        width: '70%',
        paddingVertical: 12,
        borderRadius: 999,
        alignItems: 'center',
        marginBottom: 12,
    },
    primaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
    secondaryButton: {
        borderWidth: 1,
        borderColor: '#ffffffaa',
        width: '70%',
        paddingVertical: 12,
        borderRadius: 999,
        alignItems: 'center',
    },
    secondaryText: { color: '#fff', fontWeight: '500', fontSize: 15 },
});
