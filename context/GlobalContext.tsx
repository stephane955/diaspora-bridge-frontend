import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type ProjectUpdateRow = {
    id: string | number;
    project_id: string;
    title: string;
    created_at: string;
    description: string;
    image_url: string | null;
};

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
            .from<ProjectUpdateRow>('project_updates')
            .select('*')
            .order('created_at', { ascending: false });

            if (error) throw error;

            const formattedEvents: TimelineEvent[] = (data || []).map((item, index) => ({
                id: item.id.toString(),
                projectId: item.project_id,
                title: item.title,
                date: new Date(item.created_at).toLocaleString(),
                description: item.description,
                image: item.image_url,
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
            supabase.removeChannel(channel);
        };
    }, []);

    // --- ADD DATA ---
    const addEvent = async (newEvent: { projectId: string; title: string; description: string; image: string | null }) => {
        try {
            const { error } = await supabase.from('project_updates').insert([
                {
                    project_id: newEvent.projectId,
                    title: newEvent.title,
                    description: newEvent.description,
                    image_url: newEvent.image,
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
