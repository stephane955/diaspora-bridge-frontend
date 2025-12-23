import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase'; //
import { useAuth } from '@/context/AuthContext'; //

export default function DebugDashboard() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(false);

    // 1. FORCE LOGOUT (Clears "Auth Session Missing" error)
    const handleForceLogout = async () => {
        await supabase.auth.signOut();
        router.replace('/login');
    };

    // 2. FORCE ROLE SWITCH (Fixes "Stuck on Client Dashboard")
    const handleBecomeProvider = async () => {
        if (!user) {
            Alert.alert("Error", "You are not logged in. Click 'Force Logout' first.");
            return;
        }

        setLoading(true);
        console.log("Updating user metadata...");

        const { error } = await supabase.auth.updateUser({
            data: { role: 'provider' }
        });

        if (error) {
            Alert.alert("Update Failed", error.message);
        } else {
            Alert.alert("Success", "Role updated to Provider. Redirecting now...", [
                {
                    text: "GO!",
                    onPress: () => router.replace('/provider')
                }
            ]);
        }
        setLoading(false);
    };

    if (authLoading) return <View style={styles.center}><ActivityIndicator size="large" color="#000" /></View>;

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <Ionicons name="warning" size={50} color="#F59E0B" style={{ marginBottom: 10 }} />
                <Text style={styles.title}>Account Repair Mode</Text>

                <Text style={styles.status}>
                    Current Status: {user ? "Logged In (Client Mode)" : "Session Missing / Logged Out"}
                </Text>

                {/* BUTTON 1: IF SESSION IS MISSING */}
                {!user && (
                    <TouchableOpacity style={styles.btnGray} onPress={handleForceLogout}>
                        <Text style={styles.btnText}>1. Force Logout & Login Again</Text>
                    </TouchableOpacity>
                )}

                {/* BUTTON 2: IF LOGGED IN BUT STUCK */}
                {user && (
                    <TouchableOpacity style={styles.btnBlue} onPress={handleBecomeProvider} disabled={loading}>
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>2. Force Switch to Provider</Text>}
                    </TouchableOpacity>
                )}

                <Text style={styles.hint}>
                    Step 1: If you see "Session Missing", click button #1. {"\n"}
                    Step 2: Log in again. {"\n"}
                    Step 3: If you land here again, click button #2.
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F1F5F9', justifyContent: 'center', padding: 20 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    card: { backgroundColor: '#fff', padding: 30, borderRadius: 20, alignItems: 'center', shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
    title: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 10 },
    status: { fontSize: 16, color: '#64748B', marginBottom: 30, textAlign: 'center', fontWeight: '600' },

    btnGray: { backgroundColor: '#475569', width: '100%', padding: 18, borderRadius: 12, alignItems: 'center', marginBottom: 15 },
    btnBlue: { backgroundColor: '#0EA5E9', width: '100%', padding: 18, borderRadius: 12, alignItems: 'center', marginBottom: 15 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    hint: { marginTop: 20, color: '#94A3B8', textAlign: 'center', fontSize: 13, lineHeight: 20 }
});