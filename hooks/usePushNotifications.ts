import { useState, useEffect, useRef } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type PushNotificationHandler = (data: Record<string, unknown>) => void;

Notifications.setNotificationHandler({
    handleNotification: async (notification) => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export function usePushNotifications(onNotificationPress?: PushNotificationHandler) {
    const { user } = useAuth();
    const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
    const handlerRef = useRef(onNotificationPress);
    handlerRef.current = onNotificationPress;

    const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
    const responseListener = useRef<Notifications.Subscription | undefined>(undefined);

    useEffect(() => {
        if (!user) return;

        // Action categories for "Approve" / "View Proof" on lock screen
        Notifications.setNotificationCategoryAsync('MILESTONE_APPROVAL', [
            { identifier: 'APPROVE', buttonTitle: 'Approve', options: { isDestructive: false, isAuthenticationRequired: false } },
            { identifier: 'VIEW_PROOF', buttonTitle: 'View Proof', options: { isDestructive: false, isAuthenticationRequired: false } },
        ]).catch(() => {});

        registerForPushNotificationsAsync().then(token => {
            setExpoPushToken(token);
            if (token) updateProfileToken(user.id, token);
        });

        notificationListener.current = Notifications.addNotificationReceivedListener(() => {});

        responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
            const data = (response.notification.request.content.data || {}) as Record<string, unknown>;
            const projectId = (data.project_id ?? data.chat_id ?? data.id) as string | undefined;
            const actionIdentifier = response.actionIdentifier || data.actionIdentifier;
            if (projectId && handlerRef.current) {
                handlerRef.current({
                    ...data,
                    project_id: projectId,
                    actionIdentifier,
                    openApproval: actionIdentifier === 'APPROVE' || actionIdentifier === 'VIEW_PROOF' || data.openApproval,
                });
            }
        });

        return () => {
            notificationListener.current?.remove();
            responseListener.current?.remove();
        };
    }, [user]);

    return { expoPushToken };
}

async function updateProfileToken(userId: string, token: string) {
    await supabase.from('profiles').update({ push_token: token, expo_push_token: token }).eq('id', userId);
    await supabase.from('user_devices').upsert(
        { user_id: userId, expo_push_token: token, device_id: 'default', updated_at: new Date().toISOString() },
        { onConflict: 'user_id,device_id' }
    );
}

async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Failed to get push token for push notification!');
            return;
        }

        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        if (!projectId) {
            console.warn('Push token skipped: Add extra.eas.projectId to app.json for push notifications.');
        } else {
            try {
                token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
            } catch (e) {
                console.warn('Error fetching push token:', e);
            }
        }
    } else {
        console.log('Must use physical device for Push Notifications');
    }

    return token;
}