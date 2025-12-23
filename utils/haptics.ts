import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Simple "tick" for button presses
export const lightFeedback = () => {
    if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
};

// Heavier "thud" for switching tabs or significant actions
export const mediumFeedback = () => {
    if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
};

// Success vibration (like Apple Pay success)
export const successFeedback = () => {
    if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
};