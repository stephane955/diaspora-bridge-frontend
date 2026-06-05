import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getProjectChatLastRead } from '@/lib/chatReadState';

export type ChatThread = {
    projectId: string;
    projectTitle: string;
    projectImage: string | null;
    projectCity: string | null;
    latestPreview: string;
    latestAt: string;
    isVoice: boolean;
    unreadCount: number;
};

type MessageRow = {
    project_id: string;
    content: string | null;
    audio_url: string | null;
    created_at: string;
    sender_id: string;
    recipient_id: string;
};

export function useInboxThreads(userId: string | undefined, role: 'client' | 'provider') {
    const [threads, setThreads] = useState<ChatThread[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchThreads = useCallback(async () => {
        if (!userId) {
            setThreads([]);
            setLoading(false);
            return;
        }

        setError(null);
        try {
            const projectQuery =
                role === 'client'
                    ? supabase
                          .from('projects')
                          .select('id, title, image_url, city')
                          .eq('owner_id', userId)
                          .neq('status', 'pending')
                    : supabase
                          .from('projects')
                          .select('id, title, image_url, city')
                          .eq('assigned_provider_id', userId);

            const { data: projects, error: projError } = await projectQuery.order('updated_at', {
                ascending: false,
            });

            if (projError) throw projError;
            if (!projects?.length) {
                setThreads([]);
                setLoading(false);
                return;
            }

            const projectMap = new Map(
                projects.map((p: any) => [p.id, p as { id: string; title: string; image_url: string | null; city: string | null }])
            );
            const projectIds = projects.map((p: any) => p.id);

            const { data: messages, error: msgError } = await supabase
                .from('messages')
                .select('project_id, content, audio_url, created_at, sender_id, recipient_id')
                .in('project_id', projectIds)
                .order('created_at', { ascending: false });

            if (msgError) throw msgError;

            const latestByProject = new Map<string, MessageRow>();
            for (const msg of (messages ?? []) as MessageRow[]) {
                if (!latestByProject.has(msg.project_id)) {
                    latestByProject.set(msg.project_id, msg);
                }
            }

            const unreadCounts = await Promise.all(
                projectIds.map(async (pid) => {
                    const lastRead = await getProjectChatLastRead(userId, pid);
                    let q = supabase
                        .from('messages')
                        .select('id', { count: 'exact', head: true })
                        .eq('project_id', pid)
                        .eq('recipient_id', userId);
                    if (lastRead) q = q.gt('created_at', lastRead);
                    const { count } = await q;
                    return { pid, count: count ?? 0 };
                })
            );
            const unreadMap = new Map(unreadCounts.map((u) => [u.pid, u.count]));

            const built: ChatThread[] = [];

            for (const [projectId, project] of projectMap) {
                const latest = latestByProject.get(projectId);
                const isVoice = !!latest?.audio_url;
                built.push({
                    projectId,
                    projectTitle: project.title ?? 'Project',
                    projectImage: project.image_url,
                    projectCity: project.city,
                    latestPreview: latest
                        ? isVoice
                            ? '🎤 Voice Message'
                            : (latest.content?.trim() || 'New message')
                        : 'No messages yet — say hello',
                    latestAt: latest?.created_at ?? new Date(0).toISOString(),
                    isVoice,
                    unreadCount: unreadMap.get(projectId) ?? 0,
                });
            }

            built.sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());
            setThreads(built);
        } catch (e: any) {
            setError(e?.message ?? 'Could not load conversations');
        } finally {
            setLoading(false);
        }
    }, [userId, role]);

    useEffect(() => {
        setLoading(true);
        fetchThreads();
    }, [fetchThreads]);

    useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel(`inbox-threads:${userId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                () => { fetchThreads(); }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [userId, fetchThreads]);

    return { threads, loading, error, refetch: fetchThreads };
}
