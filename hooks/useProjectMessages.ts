import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { createMessageNotification } from '@/lib/messageNotifications';
import { useLanguage } from '@/context/LanguageContext';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { Database } from '@/database.types';

export type MessageRow = Database['public']['Tables']['messages']['Row'];

export type ChatMessage = {
  id: string;
  projectId: string;
  senderId: string;
  recipientId: string;
  content: string | null;
  audioUrl: string | null;
  createdAt: string;
  /** Optimistic message not yet confirmed by server */
  pending?: boolean;
  /** Optimistic send failed */
  failed?: boolean;
};

export type ProjectParticipants = {
  clientId: string;
  providerId: string | null;
};

function normalizeRow(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    projectId: row.project_id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    content: row.content,
    audioUrl: row.audio_url,
    createdAt: row.created_at,
  };
}

function mergeIncomingMessage(prev: ChatMessage[], row: MessageRow): ChatMessage[] {
  if (prev.some((m) => m.id === row.id)) return prev;

  const normalized = normalizeRow(row);
  const withoutMatchingTemp = prev.filter(
    (m) =>
      !(
        m.pending &&
        m.senderId === row.sender_id &&
        (m.content === row.content || (!!m.audioUrl && !!row.audio_url))
      )
  );

  return [...withoutMatchingTemp, normalized];
}

export function useProjectMessages(projectId: string | undefined) {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<ProjectParticipants | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setParticipants(null);
      return;
    }

    supabase
      .from('projects')
      .select('owner_id, assigned_provider_id')
      .eq('id', projectId)
      .single()
      .then(({ data, error: projectError }) => {
        if (projectError || !data) {
          console.error('useProjectMessages participants:', projectError);
          return;
        }
        setParticipants({
          clientId: data.owner_id,
          providerId: data.assigned_provider_id,
        });
      });
  }, [projectId]);

  const fetchMessages = useCallback(async () => {
    if (!projectId) return;
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('messages')
      .select('id, project_id, sender_id, recipient_id, content, audio_url, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('useProjectMessages:', fetchError);
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setMessages((data ?? []).map(normalizeRow));
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchMessages();

    const channel = supabase
      .channel(`chat-room:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `project_id=eq.${projectId}`,
        },
        (payload: RealtimePostgresChangesPayload<MessageRow>) => {
          const row = payload.new as MessageRow;
          if (!row?.id) return;
          setMessages((prev) => mergeIncomingMessage(prev, row));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, fetchMessages]);

  const resolveRecipientId = useCallback(
    (senderId: string): string | null => {
      if (!participants) return null;
      if (senderId === participants.clientId) {
        return participants.providerId;
      }
      if (participants.providerId && senderId === participants.providerId) {
        return participants.clientId;
      }
      return participants.clientId;
    },
    [participants]
  );

  const sendTextMessage = useCallback(
    async (senderId: string, text: string) => {
      if (!projectId || !text.trim()) return { error: 'Empty message' };

      const trimmed = text.trim();
      const recipientId = resolveRecipientId(senderId);
      if (!recipientId) return { error: 'Could not resolve message recipient' };

      const tempId = `temp-${Date.now()}`;
      const optimistic: ChatMessage = {
        id: tempId,
        projectId,
        senderId,
        recipientId,
        content: trimmed,
        audioUrl: null,
        createdAt: new Date().toISOString(),
        pending: true,
      };

      setMessages((prev) => [...prev, optimistic]);

      const { data: inserted, error: insertError } = await supabase
        .from('messages')
        .insert({
          project_id: projectId,
          sender_id: senderId,
          recipient_id: recipientId,
          content: trimmed,
        })
        .select('id, project_id, sender_id, recipient_id, content, audio_url, created_at')
        .single();

      if (insertError) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        Alert.alert(t('messageFailed'), insertError.message || t('couldNotSendMessage'));
        return { error: insertError.message };
      }

      if (inserted) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? normalizeRow(inserted as MessageRow) : m))
        );
      }

      createMessageNotification({
        recipientId,
        projectId,
        senderId,
        preview: trimmed,
      }).catch(console.warn);

      return { error: null };
    },
    [projectId, resolveRecipientId]
  );

  /** Alias requested by product spec */
  const sendMessage = sendTextMessage;

  const sendAudioMessage = useCallback(
    async (senderId: string, audioUrl: string) => {
      if (!projectId || !audioUrl) return { error: 'Missing audio URL' };

      const recipientId = resolveRecipientId(senderId);
      if (!recipientId) return { error: 'Could not resolve message recipient' };

      const tempId = `temp-audio-${Date.now()}`;
      const optimistic: ChatMessage = {
        id: tempId,
        projectId,
        senderId,
        recipientId,
        content: '',
        audioUrl,
        createdAt: new Date().toISOString(),
        pending: true,
      };

      setMessages((prev) => [...prev, optimistic]);

      const { data: inserted, error: insertError } = await supabase
        .from('messages')
        .insert({
          project_id: projectId,
          sender_id: senderId,
          recipient_id: recipientId,
          content: '',
          audio_url: audioUrl,
        })
        .select('id, project_id, sender_id, recipient_id, content, audio_url, created_at')
        .single();

      if (insertError) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        Alert.alert(t('voiceMessageFailed'), insertError.message || t('couldNotSendVoice'));
        return { error: insertError.message };
      }

      if (inserted) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? normalizeRow(inserted as MessageRow) : m))
        );
      }

      createMessageNotification({
        recipientId,
        projectId,
        senderId,
        preview: 'Voice message',
        isAudio: true,
      }).catch(console.warn);

      return { error: null };
    },
    [projectId, resolveRecipientId]
  );

  return {
    messages,
    participants,
    loading,
    error,
    refetch: fetchMessages,
    sendTextMessage,
    sendMessage,
    sendAudioMessage,
  };
}
