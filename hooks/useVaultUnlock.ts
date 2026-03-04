import { useState, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { Alert, Platform } from 'react-native';

/**
 * Vault Protection: requires Face ID / Touch ID before revealing Wallet or Withdraw screens.
 * If biometrics are unavailable, allows access after user confirmation.
 */
export function useVaultUnlock(options: {
    promptMessage?: string;
    fallbackLabel?: string;
    onUnlock?: () => void;
}) {
    const { promptMessage = 'Unlock to continue', onUnlock } = options;
    const [unlocked, setUnlocked] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [biometricAvailable, setBiometricAvailable] = useState<boolean | null>(null);

    const checkBiometric = useCallback(async () => {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        const available = hasHardware && isEnrolled;
        setBiometricAvailable(available);
        return available;
    }, []);

    const authenticate = useCallback(async () => {
        setError(null);
        const available = await checkBiometric();

        if (!available) {
            if (Platform.OS === 'web') {
                setUnlocked(true);
                onUnlock?.();
                return;
            }
            Alert.alert(
                'Biometrics not set up',
                'Add a fingerprint or face in device settings to protect this screen, or tap OK to open without protection.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Open anyway', onPress: () => { setUnlocked(true); onUnlock?.(); } },
                ]
            );
            return;
        }

        try {
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage,
                cancelLabel: 'Cancel',
            });

            if (result.success) {
                setUnlocked(true);
                setError(null);
                onUnlock?.();
            } else {
                if (result.error === 'user_cancel') {
                    setError('Cancelled');
                } else {
                    setError(result.error ?? 'Authentication failed');
                }
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Authentication failed');
        }
    }, [promptMessage, onUnlock, checkBiometric]);

    const lock = useCallback(() => {
        setUnlocked(false);
        setError(null);
    }, []);

    return {
        unlocked,
        error,
        biometricAvailable,
        authenticate,
        lock,
        checkBiometric,
    };
}
