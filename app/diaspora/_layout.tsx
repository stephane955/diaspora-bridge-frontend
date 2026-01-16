import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/context/LanguageContext';

export default function DiasporaLayout() {
    const { t } = useLanguage();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: '#0F172A',
                tabBarInactiveTintColor: '#94A3B8',
                tabBarStyle: {
                    backgroundColor: '#FFFFFF',
                    borderTopColor: 'transparent',
                    height: 72,
                    paddingTop: 10,
                    paddingBottom: 10,
                    marginHorizontal: 16,
                    marginBottom: 12,
                    borderRadius: 22,
                    position: 'absolute',
                    shadowColor: '#0F172A',
                    shadowOpacity: 0.08,
                    shadowRadius: 16,
                    shadowOffset: { width: 0, height: 8 },
                    elevation: 10,
                },
                tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: t('tabHome'),
                    tabBarIcon: ({ color }) => <Ionicons name="home" size={20} color={color} />,
                }}
            />
            <Tabs.Screen
                name="new"
                options={{
                    title: t('tabPostJob'),
                    tabBarIcon: ({ color }) => <Ionicons name="add-circle" size={22} color={color} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: t('tabProfile'),
                    tabBarIcon: ({ color }) => <Ionicons name="person" size={20} color={color} />,
                }}
            />

            <Tabs.Screen name="project/[id]" options={{ href: null }} />
            <Tabs.Screen name="project/[id]/applicants" options={{ href: null }} />
            <Tabs.Screen name="projects" options={{ href: null }} />
            <Tabs.Screen name="timeline" options={{ href: null }} />
            <Tabs.Screen name="inbox" options={{ href: null }} />
            <Tabs.Screen name="wallet" options={{ href: null }} />
        </Tabs>
    );
}
