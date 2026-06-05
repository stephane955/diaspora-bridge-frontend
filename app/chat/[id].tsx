import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PremiumHeader from '@/components/PremiumHeader';
import ChatRoom from '@/components/ChatRoom';
import { useAuth } from '@/context/AuthContext';
import { markProjectChatRead } from '@/lib/chatReadState';
import { PREMIUM_BG, FLOATING_TAB_BAR_HEIGHT } from '@/constants/layout';
import { useLanguage } from '@/context/LanguageContext';

const { height } = Dimensions.get('window');

export default function ProjectChatScreen() {
    const { id } = useLocalSearchParams<{ id?: string }>();
    const projectId = typeof id === 'string' ? id : id?.[0];
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user, role } = useAuth();
    const { t } = useLanguage();

    const fallbackRoute = role === 'provider' ? '/provider/inbox' : '/diaspora/inbox';

    useEffect(() => {
        if (projectId && user?.id) {
            markProjectChatRead(user.id, projectId);
        }
    }, [projectId, user?.id]);

    if (!projectId) {
        router.back();
        return null;
    }

    const chatHeight = height - insets.top - 100 - insets.bottom - 16;

    return (
        <View style={styles.screen}>
            <StatusBar barStyle="light-content" />
            <PremiumHeader
                title={t('projectChatTitle')}
                subtitle={t('tapOpenChat')}
                showBack
                fallbackRoute={fallbackRoute}
            />
            <View style={[styles.chatWrap, { paddingTop: insets.top + 88, paddingBottom: insets.bottom + 8 }]}>
                <ChatRoom
                    projectId={projectId}
                    maxHeight={Math.max(320, chatHeight)}
                    bottomInset={insets.bottom + 8}
                    headerOffset={88}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: PREMIUM_BG },
    chatWrap: { flex: 1, paddingHorizontal: 12 },
});
