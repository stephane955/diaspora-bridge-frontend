import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { UserRole } from '@/context/AuthContext';

/** Resolve account role from auth metadata, then profiles.role. */
export async function resolveAccountRole(user: User | null): Promise<UserRole> {
  if (!user) return null;
  const meta = user.user_metadata?.role ?? (user as any).raw_user_meta_data?.role;
  if (meta === 'client' || meta === 'provider' || meta === 'supplier') {
    return meta;
  }
  try {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    const r = data?.role;
    if (r === 'client' || r === 'provider' || r === 'supplier') return r;
  } catch {
    /* ignore */
  }
  return null;
}
