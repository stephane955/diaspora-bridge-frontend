import { supabase } from '@/lib/supabase';

/** Creates an inbox notification when a project chat message is sent. */
export async function createMessageNotification(opts: {
    recipientId: string;
    projectId: string;
    senderId: string;
    preview: string;
    isAudio?: boolean;
}) {
    const { recipientId, projectId, senderId, preview, isAudio } = opts;

    const { data: sender } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', senderId)
        .maybeSingle();

    const senderName = sender?.full_name?.split(' ')[0] || 'Someone';
    const title = `New message from ${senderName}`;
    const message = isAudio ? 'Voice message' : preview.trim().slice(0, 160) || 'New message';

    await supabase.from('notifications').insert({
        user_id: recipientId,
        type: 'message',
        title,
        message,
        project_id: projectId,
        is_read: false,
        metadata: { sender_id: senderId },
    });
}
