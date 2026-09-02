import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { FavoriteProvider, Profile } from '@/types/models';

type FavoriteRow = FavoriteProvider & {
  profiles?: Profile | null;
};

/**
 * Client favorites against `favorite_providers`.
 */
export function useFavoriteProviders() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteRow[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setFavorites([]);
      setFavoriteIds(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('favorite_providers')
        .select('id, client_id, provider_id, created_at, profiles:provider_id(id, full_name, avatar_url, city, rating, role)')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as FavoriteRow[];
      setFavorites(rows);
      setFavoriteIds(new Set(rows.map((r) => r.provider_id)));
    } catch (e) {
      console.warn('favorite_providers fetch failed', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isFavorite = useCallback(
    (providerId: string) => favoriteIds.has(providerId),
    [favoriteIds],
  );

  const toggleFavorite = useCallback(
    async (providerId: string) => {
      if (!user?.id || !providerId || providerId === user.id) return false;
      const currently = favoriteIds.has(providerId);
      // Optimistic
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (currently) next.delete(providerId);
        else next.add(providerId);
        return next;
      });
      try {
        if (currently) {
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
        }
        await refresh();
        return !currently;
      } catch (e) {
        // Revert
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (currently) next.add(providerId);
          else next.delete(providerId);
          return next;
        });
        throw e;
      }
    },
    [user?.id, favoriteIds, refresh],
  );

  return { favorites, favoriteIds, loading, isFavorite, toggleFavorite, refresh };
}
