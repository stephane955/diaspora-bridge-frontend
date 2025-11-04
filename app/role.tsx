import { View, Text, Button } from 'react-native';
import { useRouter } from 'expo-router';

export default function RoleScreen() {
    const router = useRouter();

    return (
        <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
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
