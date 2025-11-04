import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';

export default function NewProjectScreen() {
    const router = useRouter();
    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');
    const [service, setService] = useState('');

    const onSubmit = () => {
        if (!title) {
            Alert.alert('Missing title', 'Please enter a project title.');
            return;
        }

        // For now just show success
        Alert.alert('Project created', 'Your project has been created (local only).');
        router.back();
    };

    return (
        <View style={styles.container}>
            <Text style={styles.label}>Project title *</Text>
            <TextInput
                style={styles.input}
                placeholder="Paint my house in Buea"
                value={title}
                onChangeText={setTitle}
            />

            <Text style={styles.label}>Service needed</Text>
            <TextInput
                style={styles.input}
                placeholder="Construction, Plumber, Tutor..."
                value={service}
                onChangeText={setService}
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
                style={[styles.input, { height: 100 }]}
                placeholder="Describe what you need..."
                value={desc}
                onChangeText={setDesc}
                multiline
            />

            <TouchableOpacity style={styles.button} onPress={onSubmit}>
                <Text style={styles.buttonText}>Create project</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: '#fff' },
    label: { fontWeight: '500', marginBottom: 6, marginTop: 10 },
    input: {
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    button: {
        backgroundColor: '#2563eb',
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 20,
    },
    buttonText: { color: '#fff', fontWeight: '600' },
});
