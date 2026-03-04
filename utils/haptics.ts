import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export const lightFeedback = () => {
    if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
};

export const mediumFeedback = () => {
    if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
};

export const successFeedback = () => {
    if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
};

/** Selection tick for scrolling / picking items */
export const selectionFeedback = () => {
    if (Platform.OS !== 'web') {
        Haptics.selectionAsync();
    }
};