import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getProjectChatLastRead } from '@/lib/chatReadState';

export function useProjectUnreadCount(projectId: string | undefined, userId: string | undefined) {
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchUnread = useCallback(async () => {
        if (!projectId || !userId) {
            setUnreadCount(0);
            return;
        }
        const lastRead = await getProjectChatLastRead(userId, projectId);
        let query = supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', projectId)
            .eq('recipient_id', userId);

        if (lastRead) {
            query = query.gt('created_at', lastRead);
        }

        const { count, error } = await query;
        if (error) {
            console.warn('useProjectUnreadCount:', error.message);
            return;
        }
        setUnreadCount(count ?? 0);
    }, [projectId, userId]);

    useEffect(() => {
        fetchUnread();
        if (!projectId) return;

        const channel = supabase
            .channel(`chat-unread:${projectId}:${userId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages', filter: `project_id=eq.${projectId}` },
                () => { fetchUnread(); }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [projectId, userId, fetchUnread]);

    return { unreadCount, refreshUnread: fetchUnread };
}
