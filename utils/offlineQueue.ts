import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

const QUEUE_KEY = 'diaspora_offline_queue';

export type QueuedAction = {
    type: 'project_update';
    payload: {
        project_id: string;
        author_id: string;
        title: string;
        body: string;
        photo_url: string | null;
    };
};

async function getQueue(): Promise<QueuedAction[]> {
    try {
        const raw = await AsyncStorage.getItem(QUEUE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

async function setQueue(queue: QueuedAction[]) {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueue(action: QueuedAction): Promise<void> {
    const queue = await getQueue();
    queue.push(action);
    await setQueue(queue);
}

export async function processQueue(): Promise<{ processed: number; failed: number }> {
    const queue = await getQueue();
    let processed = 0;
    let failed = 0;
    for (let i = 0; i < queue.length; i++) {
        const action = queue[i];
        try {
            if (action.type === 'project_update') {
                const { error } = await supabase.from('project_updates').insert({
                    project_id: action.payload.project_id,
                    author_id: action.payload.author_id,
                    title: action.payload.title,
                    body: action.payload.body,
                    photo_url: action.payload.photo_url,
                });
                if (error) throw error;
            }
            processed++;
        } catch {
            failed++;
            break;
        }
    }
    if (processed > 0) {
        const newQueue = queue.slice(processed + failed);
        await setQueue(newQueue);
    }
    return { processed, failed };
}

export async function syncIfOnline(): Promise<void> {
    const queue = await getQueue();
    if (queue.length === 0) return;
    await processQueue();
}
