import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import ChatRoom from '@/components/ChatRoom';
import { useAuth } from '@/context/AuthContext';
import { markProjectChatRead } from '@/lib/chatReadState';
import { supabase } from '@/lib/supabase';
import { safeGoBack } from '@/utils/navigation';
import { usePremiumColors } from '@/hooks/usePremiumColors';
import { useLanguage } from '@/context/LanguageContext';
import { successFeedback } from '@/utils/haptics';

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

  const headerH = insets.top + 72;
  const chatHeight = height - headerH - insets.bottom - 8;

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <StatusBar barStyle={c.isDark ? 'light-content' : 'dark-content'} />

      <BlurView
        intensity={70}
        tint={c.blurTint}
        style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: c.glassStrong }]}
      >
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)' }]}
          onPress={() => {
            successFeedback();
            safeGoBack(router, fallbackRoute);
          }}
          hitSlop={12}
          activeOpacity={0.75}
        >
          <Ionicons name="chevron-back" size={24} color={c.textPrimary} />
        </TouchableOpacity>

        {loadingPeer ? (
          <ActivityIndicator color={c.gold} style={{ marginLeft: 12 }} />
        ) : (
          <View style={styles.peerRow}>
            <Image
              source={{
                uri: peer?.avatar_url || 'https://i.pravatar.cc/150?u=chat',
              }}
              style={[styles.avatar, { borderColor: c.gold }]}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: c.textPrimary }]} numberOfLines={1}>
                {peer?.full_name || 'Project Chat'}
              </Text>
              <View style={styles.roleRow}>
                <View style={[styles.liveDot, { backgroundColor: '#22C55E' }]} />
                <Text style={[styles.role, { color: c.textSecondary }]}>
                  {peer?.roleLabel || 'Partner'} · Live
                </Text>
              </View>
            </View>
          </View>
        )}
      </BlurView>

      <View style={[styles.chatWrap, { paddingTop: headerH, paddingBottom: insets.bottom + 4 }]}>
        <ChatRoom
          projectId={projectId}
          maxHeight={Math.max(320, chatHeight)}
          bottomInset={insets.bottom + 4}
          headerOffset={0}
          hideInternalHeader
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.2)',
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peerRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    backgroundColor: '#334155',
  },
  name: { fontSize: 17, fontWeight: '800' },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  role: { fontSize: 12, fontWeight: '600' },
  chatWrap: { flex: 1, paddingHorizontal: 10 },
});
