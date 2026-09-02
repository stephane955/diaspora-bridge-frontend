import { supabase } from '@/lib/supabase';
import { SETTLEMENT_CURRENCY } from '@/lib/money';

export type HireProviderParams = {
  projectId: string;
  applicationId: string;
  providerId: string;
  bidAmount: number;
};

/**
 * Assigns a provider, accepts their application, rejects others,
 * and seeds escrow milestones if none exist yet.
 * Project status becomes `in_progress` (app convention for "active").
 */
export async function hireProvider({
  projectId,
  applicationId,
  providerId,
  bidAmount,
}: HireProviderParams) {
  const { error: projectError } = await supabase
    .from('projects')
    .update({
      assigned_provider_id: providerId,
      status: 'in_progress',
    })
    .eq('id', projectId);

  if (projectError) throw projectError;

  const { error: acceptError } = await supabase
    .from('project_applications')
    .update({ status: 'accepted' })
    .eq('id', applicationId);

  if (acceptError) throw acceptError;

  await supabase
    .from('project_applications')
    .update({ status: 'rejected' })
    .eq('project_id', projectId)
    .neq('id', applicationId);

  const { data: existingMiles } = await supabase
    .from('milestones')
    .select('id')
    .eq('project_id', projectId)
    .limit(1);

  if (!existingMiles?.length) {
    const total = Math.max(0, Number(bidAmount) || 0);
    const halfAmount = Math.floor(total / 2);
    const remainder = total - halfAmount;

    const { error: milesError } = await supabase.from('milestones').insert([
      {
        project_id: projectId,
        title: 'Phase 1: Mobilization & Materials',
        currency: SETTLEMENT_CURRENCY,
        amount_minor: halfAmount,
        status: 'in_progress',
        step_order: 1,
      },
      {
        project_id: projectId,
        title: 'Phase 2: Completion & Handover',
        currency: SETTLEMENT_CURRENCY,
        amount_minor: remainder,
        status: 'locked',
        step_order: 2,
      },
    ]);

    if (milesError) throw milesError;
  }
}

/** Relative "time posted" label for marketplace cards */
export function formatTimePosted(iso?: string | null): string {
  if (!iso) return 'Just now';
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}
