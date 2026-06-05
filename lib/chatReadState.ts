import AsyncStorage from '@react-native-async-storage/async-storage';

const readKey = (userId: string, projectId: string) => `chat_read_${userId}_${projectId}`;

export async function markProjectChatRead(userId: string, projectId: string): Promise<void> {
    await AsyncStorage.setItem(readKey(userId, projectId), new Date().toISOString());
}

export async function getProjectChatLastRead(userId: string, projectId: string): Promise<string | null> {
    return AsyncStorage.getItem(readKey(userId, projectId));
}
