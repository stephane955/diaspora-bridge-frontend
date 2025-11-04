import { View, Text } from 'react-native';

export default function ProviderHome() {
    return (
        <View style={{ flex: 1, padding: 20 }}>
            <Text style={{ fontSize: 22, marginBottom: 8 }}>Provider – My Projects</Text>
            <Text>Here provider will see incoming requests…</Text>
        </View>
    );
}
