import { Tabs } from 'expo-router';
import { useLanguage } from '@/context/LanguageContext';
import GlassNavigation from '@/components/GlassNavigation'; // Import your custom component

export default function DiasporaLayout() {
    const { t } = useLanguage();

    return (
        <Tabs
            // This replaces the default white bar with your Glass Component
            tabBar={() => <GlassNavigation />}
            screenOptions={{
                headerShown: false,
                // We hide the default bar completely just in case
                tabBarStyle: { display: 'none' },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: t('tabHome'), // Kept your translation logic
                }}
            />
            <Tabs.Screen
                name="new"
                options={{
                    title: t('tabPostJob'),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: t('tabProfile'),
                }}
            />

            {/* Hidden Utility Screens (Kept exactly as you had them) */}
            <Tabs.Screen name="project/[id]" options={{ href: null }} />
            <Tabs.Screen name="project/[id]/applicants" options={{ href: null }} />
            <Tabs.Screen name="projects" options={{ href: null }} />
            <Tabs.Screen name="timeline" options={{ href: null }} />
            <Tabs.Screen name="inbox" options={{ href: null }} />
            <Tabs.Screen name="wallet" options={{ href: null }} />
        </Tabs>
    );
}