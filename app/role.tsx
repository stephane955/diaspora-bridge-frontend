import { View, Text, Button, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

export default function RoleScreen() {
    const router = useRouter();

    const signOut = async () => {
        await AsyncStorage.removeItem('loggedIn');
        router.replace('/login');
    };

    return (
        <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
            <Pressable onPress={signOut} style={styles.signOut}>
                <Ionicons name="log-out-outline" size={16} color="#0f172a" />
                <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>

            <Text style={{ fontSize: 22, marginBottom: 12 }}>Choose your role</Text>

            <Button
                title="I am in the diaspora"
                onPress={() => router.push('/diaspora')}
            />

            <View style={{ height: 10 }} />

            <Button
                title="I offer services in Cameroon"
                onPress={() => router.push('/provider')}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    signOut: {
        position: 'absolute',
        top: 40,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: '#e2e8f0',
        borderRadius: 12,
    },
    signOutText: { color: '#0f172a', fontWeight: '600' },
});
