import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type PushNotificationData = Record<string, unknown>;

async function registerPushToken(userId: string): Promise<void> {
    if (!Device.isDevice) return;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#D4AF37',
        });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;

    const tokenResult = projectId
        ? await Notifications.getExpoPushTokenAsync({ projectId })
        : await Notifications.getExpoPushTokenAsync();

    const expoPushToken = tokenResult.data;
    if (!expoPushToken) return;

    // Schema stores push token on profiles (no user_push_tokens table in generated types yet)
    await supabase
        .from('profiles')
        .update({ push_token: expoPushToken })
        .eq('id', userId);
}

/**
 * Registers Expo push token for the signed-in user and wires notification tap deep-links.
 */
export function usePushNotifications(
    onNotificationResponse?: (data: PushNotificationData) => void
) {
    const { user } = useAuth();
    const responseListener = useRef<Notifications.EventSubscription | null>(null);

    useEffect(() => {
        if (!user?.id) return;

        registerPushToken(user.id).catch((err) => {
            console.warn('Push registration failed:', err);
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
            const data = (response.notification.request.content.data ?? {}) as PushNotificationData;
            onNotificationResponse?.(data);
        });

        return () => {
            if (responseListener.current) {
                responseListener.current.remove();
            }
        };
    }, [user?.id, onNotificationResponse]);
}
