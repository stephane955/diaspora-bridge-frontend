import { useState, useEffect, useRef } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

Notifications.setNotificationHandler({
    handleNotification: async (notification) => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true, // Required by new Expo types
        shouldShowList: true,   // Required by new Expo types
    }),
});

export function usePushNotifications() {
    const { user } = useAuth();
    const [expoPushToken, setExpoPushToken] = useState<string | undefined>();

    // Use specific types for the listeners
    // Initialize with 'undefined' to satisfy TypeScript
    const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
    const responseListener = useRef<Notifications.Subscription | undefined>(undefined);

    useEffect(() => {
        if (!user) return;

        registerForPushNotificationsAsync().then(token => {
            setExpoPushToken(token);
            if (token) {
                // SAVE TOKEN TO SUPABASE
                updateProfileToken(user.id, token);
            }
        });

        // Listen for incoming notifications
        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
            console.log("Notification Received:", notification);
        });

        // Listen for user tapping a notification
        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            console.log("Notification Tapped:", response);
            // Future: Navigate to Chat Screen here
        });

        return () => {
            // FIX 2: Use .remove() directly on the subscription object
            if (notificationListener.current) {
                notificationListener.current.remove();
            }
            if (responseListener.current) {
                responseListener.current.remove();
            }
        };
    }, [user]);

    return { expoPushToken };
}

async function updateProfileToken(userId: string, token: string) {
    const { error } = await supabase
        .from('profiles')
        .update({ push_token: token })
        .eq('id', userId);

    if (error) console.error("Error saving push token:", error);
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

        // Get the token specifically for your project ID
        try {
            const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

            // Fallback or explicit check
            token = (await Notifications.getExpoPushTokenAsync({
                projectId: projectId,
            })).data;
        } catch (e) {
            console.log("Error fetching token:", e);
        }
    } else {
        console.log('Must use physical device for Push Notifications');
    }

    return token;
}