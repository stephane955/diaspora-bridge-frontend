import * as LocalAuthentication from 'expo-local-authentication';
import { Alert } from 'react-native';

export const useBiometrics = () => {

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
                promptMessage: 'Confirm Withdrawal',
                fallbackLabel: 'Use Passcode',
                cancelLabel: 'Cancel',
                disableDeviceFallback: false,
            });

            if (result.success) {
                return true;
            } else {
                Alert.alert("Authentication Failed", "We could not verify your identity.");
                return false;
            }

        } catch (error) {
            console.error("Biometric Error", error);
            return false;
        }
    };

    return { authenticate };
};