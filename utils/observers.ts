import { supabase } from '@/lib/supabase';
import type { ProjectAccessRole } from '@/types/models';

const INVITE_TOKEN_LENGTH = 32;
const TOKEN_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateToken(): string {
    let s = '';
    for (let i = 0; i < INVITE_TOKEN_LENGTH; i++) {
        s += TOKEN_CHARS[Math.floor(Math.random() * TOKEN_CHARS.length)];
    }
    return s;
}

/**
 * Create a view-only Observer invite for a project. Returns the full invite link and token.
 */
export async function createObserverInvite(projectId: string): Promise<{ link: string; token: string }> {
    const token = generateToken();
    const { error } = await supabase.from('project_observers').insert({
        project_id: projectId,
        invite_token: token,
    });
    if (error) throw error;
    const base = typeof window !== 'undefined' ? `${window.location.origin}` : 'https://yourapp.com';
    const link = `${base}/observer/join?token=${token}`;
    return { link, token };
}

/**
 * Claim an observer invite: set user_id for the given token. Call when user is logged in.
 */
export async function claimObserverInvite(token: string, userId: string): Promise<{ projectId: string } | null> {
    const { data: row, error } = await supabase
        .from('project_observers')
        .select('id, project_id')
        .eq('invite_token', token)
        .single();
    if (error || !row) return null;
    const { error: updateErr } = await supabase
        .from('project_observers')
        .update({ user_id: userId })
        .eq('id', row.id);
    if (updateErr) return null;
    return { projectId: row.project_id };
}

/**
 * Determine current user's role for a project: owner, provider, or observer.
 */
export async function getProjectAccessRole(
    projectId: string,
    userId: string | undefined
): Promise<ProjectAccessRole> {
    if (!userId) return null;
    const { data: project } = await supabase
        .from('projects')
        .select('owner_id, assigned_provider_id')
        .eq('id', projectId)
        .single();
    if (!project) return null;
    if (project.owner_id === userId) return 'owner';
    if (project.assigned_provider_id === userId) return 'provider';
    const { data: obs } = await supabase
        .from('project_observers')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .maybeSingle();
    if (obs) return 'observer';
    return null;
}
