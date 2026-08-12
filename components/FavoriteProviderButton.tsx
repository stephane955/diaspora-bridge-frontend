import React, { useEffect, useState } from 'react';
import { TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { PREMIUM_GOLD } from '@/constants/layout';
import { successFeedback, lightFeedback } from '@/utils/haptics';
import { useLanguage } from '@/context/LanguageContext';

type Props = {
  providerId: string | null | undefined;
  size?: number;
};

/**
 * Heart toggle wired to `favorite_providers` (self-contained local state).
 */
export default function FavoriteProviderButton({ providerId, size = 22 }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user?.id || !providerId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('favorite_providers')
        .select('id')
        .eq('client_id', user.id)
        .eq('provider_id', providerId)
        .maybeSingle();
      if (!cancelled) setActive(!!data);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, providerId]);

  if (!providerId || !user?.id || providerId === user.id) return null;

  const onPress = async () => {
    if (busy) return;
    setBusy(true);
    lightFeedback();
    const prev = active;
    setActive(!prev);
    try {
      if (prev) {
        const { error } = await supabase
          .from('favorite_providers')
          .delete()
          .eq('client_id', user.id)
          .eq('provider_id', providerId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('favorite_providers').insert({
          client_id: user.id,
          provider_id: providerId,
        });
        if (error) throw error;
        successFeedback();
      }
    } catch (e: any) {
      setActive(prev);
      Alert.alert(t('favoritesTitle'), e?.message || t('favoritesUpdateFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.btn, active && styles.btnActive]}
      hitSlop={10}
      disabled={busy}
      accessibilityLabel={active ? t('removeFromSaved') : t('saveProvider')}
    >
      {busy ? (
        <ActivityIndicator size="small" color={PREMIUM_GOLD} />
      ) : (
        <Ionicons
          name={active ? 'heart' : 'heart-outline'}
          size={size}
          color={active ? '#F87171' : PREMIUM_GOLD}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
  },
  btnActive: {
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderColor: 'rgba(248,113,113,0.35)',
  },
});
