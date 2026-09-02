import { supabase } from '@/lib/supabase';

/** Read-only ledger user_available balance (returns null if RPC unavailable). */
export async function fetchUserAvailableBalanceMinor(): Promise<bigint | null> {
  const { data, error } = await supabase.rpc('rpc_get_user_available_balance');
  if (error) {
    return null;
  }
  try {
    return BigInt(String(data ?? '0'));
  } catch {
    return null;
  }
}
