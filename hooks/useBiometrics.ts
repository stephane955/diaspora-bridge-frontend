import * as LocalAuthentication from 'expo-local-authentication';
import { Alert } from 'react-native';
import { useLanguage } from '@/context/LanguageContext';

export const useBiometrics = () => {
    const { t } = useLanguage();

    const authenticate = async (): Promise<boolean> => {
        try {
            // 1. Check if hardware supports it
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            if (!hasHardware) return true; // Pass if device is old (optional logic)

            // 2. Check if user has FaceID/Fingerprint enrolled
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();
            if (!isEnrolled) return true; // Pass if user uses PIN only

            // 3. Prompt the user
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: t('confirmWithdrawal'),
                fallbackLabel: t('usePasscode'),
                cancelLabel: t('cancel'),
                disableDeviceFallback: false,
            });

            if (result.success) {
                return true;
            } else {
                Alert.alert(t('authFailedTitle'), t('authFailedBody'));
                return false;
            }

        } catch (error) {
            console.error("Biometric Error", error);
            return false;
        }
    };

    return { authenticate };
};