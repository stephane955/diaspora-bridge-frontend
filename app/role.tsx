import { View, Text, Button, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/context/LanguageContext';

export default function RoleScreen() {
    const router = useRouter();
    const { t } = useLanguage();

    const signOut = async () => {
        await AsyncStorage.removeItem('loggedIn');
        router.replace('/login');
    };

    return (
        <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
            <Pressable onPress={signOut} style={styles.signOut}>
                <Ionicons name="log-out-outline" size={16} color="#0f172a" />
                <Text style={styles.signOutText}>{t('signOut')}</Text>
            </Pressable>

            <Text style={{ fontSize: 22, marginBottom: 12 }}>{t('chooseYourRole')}</Text>

            <Button
                title={t('iAmInDiaspora')}
                onPress={() => router.push('/diaspora')}
            />

            <View style={{ height: 10 }} />

            <Button
                title={t('iOfferServicesCameroon')}
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
