import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Pressable,
    Animated,
    Easing,
    Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

type Props = {
    visible: boolean;
    onClose: () => void;
    onSignOut: () => void;
    name?: string | null;
    email?: string | null;
    roleLabel: string;
    photoUri?: string | null;
    onChangePhoto: (uri: string | null) => void;
};

export default function ProfileDrawer({
    visible,
    onClose,
    onSignOut,
    name,
    email,
    roleLabel,
    photoUri,
    onChangePhoto,
}: Props) {
    const slideAnim = useRef(new Animated.Value(400)).current;

    useEffect(() => {
        Animated.timing(slideAnim, {
            toValue: visible ? 0 : 400,
            duration: 250,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [visible, slideAnim]);

    const pickImage = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) return;

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
            allowsEditing: true,
        });

        if (!result.canceled && result.assets.length > 0) {
            onChangePhoto(result.assets[0].uri);
        }
    };

    if (!visible) return null;

    return (
        <Modal transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <Animated.View
                    style={[
                        styles.drawer,
                        { transform: [{ translateX: slideAnim }] }
                    ]}
                >
                    <View style={styles.header}>
                        <View style={styles.avatarWrap}>
                            {photoUri ? (
                                <Image source={{ uri: photoUri }} style={styles.avatar} />
                            ) : (
                                <View style={styles.avatarFallback}>
                                    <Ionicons name="person" size={28} color="#001F3F" />
                                </View>
                            )}
                            <Pressable style={styles.editBtn} onPress={pickImage}>
                                <Ionicons name="camera" size={16} color="#fff" />
                            </Pressable>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.name}>{name || 'Your profile'}</Text>
                            <Text style={styles.email}>{email || 'Add your email'}</Text>
                            <Text style={styles.role}>{roleLabel}</Text>
                        </View>
                        <Pressable onPress={onClose} style={styles.close}>
                            <Ionicons name="close" size={20} color="#0f172a" />
                        </Pressable>
                    </View>

                    <View style={styles.menu}>
                        {[
                            { icon: 'person-circle', label: 'Profile' },
                            { icon: 'chatbubbles', label: 'Messages' },
                            { icon: 'card', label: 'Financials' },
                            { icon: 'images', label: 'Gallery' },
                            { icon: 'settings', label: 'Settings' },
                        ].map(item => (
                            <Pressable key={item.label} style={styles.menuItem}>
                                <Ionicons name={item.icon as any} size={18} color="#0f172a" />
                                <Text style={styles.menuText}>{item.label}</Text>
                                <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                            </Pressable>
                        ))}
                    </View>

                    <Pressable style={styles.signOut} onPress={onSignOut}>
                        <Ionicons name="log-out-outline" size={18} color="#b91c1c" />
                        <Text style={styles.signOutText}>Sign out</Text>
                    </Pressable>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        alignItems: 'flex-end',
    },
    drawer: {
        width: '80%',
        maxWidth: 360,
        height: '100%',
        backgroundColor: '#fff',
        padding: 20,
        paddingTop: 50,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowOffset: { width: -4, height: 0 },
        shadowRadius: 16,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
    avatarWrap: { position: 'relative' },
    avatar: { width: 64, height: 64, borderRadius: 20 },
    avatarFallback: {
        width: 64,
        height: 64,
        borderRadius: 20,
        backgroundColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    editBtn: {
        position: 'absolute',
        bottom: -6,
        right: -6,
        backgroundColor: '#001F3F',
        borderRadius: 12,
        padding: 6,
    },
    name: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
    email: { color: '#475569', fontWeight: '400' },
    role: { color: '#0f172a', fontWeight: '600', marginTop: 4 },
    close: { padding: 8, backgroundColor: '#e2e8f0', borderRadius: 12 },
    menu: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#e2e8f0', paddingVertical: 10, marginTop: 6 },
    menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
    menuText: { flex: 1, color: '#0f172a', fontWeight: '600' },
    signOut: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14 },
    signOutText: { color: '#b91c1c', fontWeight: '700' },
});
