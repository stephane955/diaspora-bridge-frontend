import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '@/lib/supabase';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { syncIfOnline } from '@/utils/offlineQueue';
import { syncPendingEvidence } from '@/hooks/useOfflineWorkroom';
import type { Database } from '@/database.types';

// NetInfo: optional; sync queue when connection restored (install @react-native-community/netinfo)
let NetInfo: { addEventListener: (callback: (state: { isConnected: boolean | null }) => void) => () => void } | null = null;
try {
    NetInfo = require('@react-native-community/netinfo').default;
} catch {
    // NetInfo not installed; we still use AppState 'active' to sync
}

type ProjectUpdateRow = Database['public']['Tables']['project_updates']['Row'];

// 1. Define the shape of a "Timeline Event" (aligned with project_updates)
type TimelineEvent = {
    id: string;
    projectId: string;
    title: string;
    date: string;
    description: string;
    image: string | null;
    isLatest: boolean;
};

// 2. Define what the Context holds
type GlobalContextType = {
    events: TimelineEvent[];
    addEvent: (event: { projectId: string; title: string; description: string; image: string | null }) => void;
    loading: boolean;
};

const GlobalContext = createContext<GlobalContextType>({
    events: [],
    addEvent: () => {},
    loading: true,
});

export const GlobalProvider = ({ children }: { children: React.ReactNode }) => {
    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [loading, setLoading] = useState(true);

    // --- FETCH DATA ---
    const fetchEvents = async () => {
        try {
        const { data, error } = await supabase
            .from('project_updates')
            .select('*')
            .order('created_at', { ascending: false });

            if (error) throw error;

            const formattedEvents: TimelineEvent[] = (data || []).map((item, index) => ({
                id: String(item.id),
                projectId: item.project_id,
                title: item.title ?? '',
                date: new Date(item.created_at).toLocaleString(),
                description: item.body ?? '',
                image: item.photo_url,
                isLatest: index === 0,
            }));

            setEvents(formattedEvents);
        } catch (error) {
            console.log('Error fetching project_updates:', error);
        } finally {
            setLoading(false);
        }
    };

    // --- REALTIME SUBSCRIPTION ---
    useEffect(() => {
        fetchEvents();

        const channel = supabase.channel('project_updates-changes');

        channel
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'project_updates' },
                (payload: RealtimePostgresChangesPayload<ProjectUpdateRow>) => {
                    console.log('New project update received!', payload);
                    fetchEvents(); // Refresh list when new item arrives
                }
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, []);

    // --- OFFLINE SYNC: drain queue when app comes to foreground (3G/Wi‑Fi restored) ---
    // On focus (app active) or NetInfo "connected", drain offline queue
    useEffect(() => {
        const appSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
            if (nextState === 'active') {
                syncIfOnline();
                syncPendingEvidence();
            }
        });
        const unsubscribeNet = NetInfo?.addEventListener?.((state) => {
            if (state.isConnected === true) {
                syncIfOnline();
                syncPendingEvidence();
            }
        });
        return () => {
            appSub.remove();
            if (typeof unsubscribeNet === 'function') unsubscribeNet();
        };
    }, []);

    // --- ADD DATA ---
    const addEvent = async (newEvent: { projectId: string; title: string; description: string; image: string | null }) => {
        try {
            const { data: authData } = await supabase.auth.getUser();
            const authorId = authData.user?.id;
            if (!authorId) {
                alert('You must be signed in to post an update.');
                return;
            }
            const { error } = await supabase.from('project_updates').insert([
                {
                    project_id: newEvent.projectId,
                    author_id: authorId,
                    title: newEvent.title,
                    body: newEvent.description,
                    photo_url: newEvent.image,
                },
            ]);

            if (error) throw error;
        } catch (error) {
            console.error('Error adding project update:', error);
            alert('Failed to save to cloud.');
        }
    };

    return (
        <GlobalContext.Provider value={{ events, addEvent, loading }}>
            {children}
        </GlobalContext.Provider>
    );
};

export const useGlobal = () => useContext(GlobalContext);
