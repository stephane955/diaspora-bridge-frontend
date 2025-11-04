import { View, Text, Button } from 'react-native';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
    const router = useRouter();

    return (
        <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
            <Text style={{ fontSize: 24, marginBottom: 16 }}>Login</Text>
            {/* later: email/password */}
            <Button title="Continue" onPress={() => router.push('/role')} />
        </View>
    );
}
