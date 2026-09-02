import { supabase } from '@/lib/supabase';
import type { Database } from '@/database.types';

export type PlatformAdminRole = Database['public']['Enums']['platform_admin_role'];

/** Server-backed admin check via platform_admins (not client metadata). */
export async function checkIsAdmin(requiredRole?: PlatformAdminRole): Promise<boolean> {
  const { data, error } = requiredRole
    ? await supabase.rpc('has_admin_role', { p_required: requiredRole })
    : await supabase.rpc('has_admin_role');
  if (error) {
    return false;
  }
  return data === true;
}
