import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// 1. Define the shape of a "Timeline Event"
type TimelineEvent = {
    id: string;
    title: string;
    date: string; // "Created At" formatted as a string
    status: 'approved' | 'pending_approval';
    description: string;
    image: string | null;
    isLatest: boolean;
};

// 2. Define what the Context holds
type GlobalContextType = {
    events: TimelineEvent[];
    // We removed 'id', 'date', and 'isLatest' from input because Database handles those!
    addEvent: (event: { title: string; description: string; status: 'pending_approval' | 'approved'; image: string | null }) => void;
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
                .from('events')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const formattedEvents: TimelineEvent[] = (data || []).map((item, index) => ({
                id: item.id.toString(),
                title: item.title,
                date: new Date(item.created_at).toLocaleString(),
                status: item.status,
                description: item.description,
                image: item.image_url,
                isLatest: index === 0,
            }));

            setEvents(formattedEvents);
        } catch (error) {
            console.log('Error fetching events:', error);
        } finally {
            setLoading(false);
        }
    };

    // --- REALTIME SUBSCRIPTION ---
    useEffect(() => {
        fetchEvents();

        // Fix for the TypeScript error: "postgres_changes" type matching
        const channel = supabase.channel('events-changes');

        channel
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'events' },
                (payload: RealtimePostgresChangesPayload<any>) => {
                    console.log('New event received!', payload);
                    fetchEvents(); // Refresh list when new item arrives
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // --- ADD DATA ---
    const addEvent = async (newEvent: { title: string; description: string; status: string; image: string | null }) => {
        // Optimistic update (optional, but good for UI speed)
        // For now, we rely on the Realtime listener to update the list

        try {
            const { error } = await supabase.from('events').insert([
                {
                    title: newEvent.title,
                    description: newEvent.description,
                    status: newEvent.status,
                    image_url: newEvent.image,
                },
            ]);

            if (error) throw error;
        } catch (error) {
            console.error('Error adding event:', error);
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