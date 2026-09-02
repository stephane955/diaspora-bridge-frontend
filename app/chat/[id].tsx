import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Image,
  StatusBar,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import ChatRoom from '@/components/ChatRoom';
import PremiumHeader from '@/components/PremiumHeader';
import { useAuth } from '@/context/AuthContext';
import { markProjectChatRead } from '@/lib/chatReadState';
import { supabase } from '@/lib/supabase';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import { useLanguage } from '@/context/LanguageContext';
import {
  HEADER_BLOCK_HEIGHT,
  ICON_BUTTON_SIZE,
  NAVY,
  radius,
  space,
  withAlpha,
} from '@/constants/design';

const { height } = Dimensions.get('window');

type Peer = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  roleLabel: string;
};

export default function ProjectChatScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const projectId = typeof id === 'string' ? id : id?.[0];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, role } = useAuth();
  const c = usePremiumColors();
  const { t } = useLanguage();

  const fallbackRoute = role === 'provider' ? '/provider/inbox' : '/diaspora/inbox';
  const [peer, setPeer] = useState<Peer | null>(null);
  const [loadingPeer, setLoadingPeer] = useState(true);

  useEffect(() => {
    if (projectId && user?.id) {
      markProjectChatRead(user.id, projectId);
    }
  }, [projectId, user?.id]);

  useEffect(() => {
    if (!projectId || !user?.id) return;
    (async () => {
      setLoadingPeer(true);
      try {
        const { data: project } = await supabase
          .from('projects')
          .select('owner_id, assigned_provider_id, title')
          .eq('id', projectId)
          .single();
        if (!project) return;

        const otherId =
          user.id === project.owner_id
            ? project.assigned_provider_id
            : project.owner_id;

        if (!otherId) {
          setPeer({
            id: '',
            full_name: project.title || 'Project Chat',
            avatar_url: null,
            roleLabel: 'Unassigned',
          });
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, role')
          .eq('id', otherId)
          .maybeSingle();

        const roleLabel =
          profile?.role === 'provider'
            ? t('roleProvider')
            : profile?.role === 'supplier'
              ? 'Supplier'
              : t('roleClient');

        setPeer({
          id: otherId,
          full_name: profile?.full_name || t('providerFallback'),
          avatar_url: profile?.avatar_url || null,
          roleLabel,
        });
      } finally {
        setLoadingPeer(false);
      }
    })();
  }, [projectId, user?.id, t]);

  if (!projectId) {
    router.back();
    return null;
  }

  // Chat content sits flush under the header, matching HEADER_BLOCK_HEIGHT.
  const headerH = insets.top + HEADER_BLOCK_HEIGHT;
  const chatHeight = height - headerH - insets.bottom - 8;

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <StatusBar barStyle={c.isDark ? 'light-content' : 'dark-content'} />

      <LinearGradient
        colors={
          c.isDark
            ? [withAlpha(NAVY, 0.98), withAlpha('#0A0F1A', 1)]
            : [withAlpha('#F8FAFC', 1), withAlpha('#E2E8F0', 0.6)]
        }
        style={StyleSheet.absoluteFill}
      />

      <PremiumHeader
        title={peer?.full_name || 'Project Chat'}
        subtitle={peer ? `${peer.roleLabel} · Encrypted` : undefined}
        showBack
        fallbackRoute={fallbackRoute}
        hideMenu
        rightSlot={
          peer?.avatar_url ? (
            <Image
              source={{ uri: peer.avatar_url }}
              style={[styles.avatar, { borderColor: c.gold, backgroundColor: c.surfaceAlt }]}
            />
          ) : (
            <View
              style={[
                styles.avatar,
                styles.avatarFallback,
                { borderColor: c.gold, backgroundColor: c.surfaceAlt },
              ]}
            />
          )
        }
      />

      <View style={[styles.chatWrap, { paddingTop: headerH, paddingBottom: insets.bottom + 4 }]}>
        {loadingPeer ? (
          <ActivityIndicator color={c.gold} style={{ marginTop: space.lg }} />
        ) : (
          <ChatRoom
            projectId={projectId}
            maxHeight={Math.max(320, chatHeight)}
            bottomInset={insets.bottom + 4}
            headerOffset={0}
            hideInternalHeader
            fullBleed
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  avatar: {
    width: ICON_BUTTON_SIZE,
    height: ICON_BUTTON_SIZE,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  avatarFallback: {},
  chatWrap: { flex: 1, paddingHorizontal: space.sm },
});
