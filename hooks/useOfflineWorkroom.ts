/**
 * Offline-first Workroom cache + pending evidence sync queue.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { uploadMilestoneEvidence } from '@/lib/storage';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useMilestoneRealtimeSync } from '@/hooks/useWorkroomData';

const WORKROOM_KEY = (projectId: string) => ['workroom', projectId] as const;
const cacheKey = (projectId: string) => `@db/workroom_cache/${projectId}`;
const PENDING_KEY = '@db/pending_evidence_sync';

export type PendingEvidence = {
  id: string;
  projectId: string;
  milestoneId: string;
  localUri: string;
  createdAt: string;
};

export type WorkroomPayload = {
  project: any;
  milestones: any[];
};

async function readCache(projectId: string): Promise<WorkroomPayload | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(projectId));
    return raw ? (JSON.parse(raw) as WorkroomPayload) : null;
  } catch {
    return null;
  }
}

async function writeCache(projectId: string, payload: WorkroomPayload) {
  try {
    await AsyncStorage.setItem(cacheKey(projectId), JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export async function getPendingEvidenceQueue(): Promise<PendingEvidence[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function setPendingEvidenceQueue(queue: PendingEvidence[]) {
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(queue));
}

export async function enqueuePendingEvidence(
  item: Omit<PendingEvidence, 'id' | 'createdAt'>,
): Promise<PendingEvidence> {
  const entry: PendingEvidence = {
    ...item,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  const queue = await getPendingEvidenceQueue();
  // One pending photo per milestone
  const next = queue.filter((q) => q.milestoneId !== item.milestoneId);
  next.push(entry);
  await setPendingEvidenceQueue(next);
  return entry;
}

export async function removePendingEvidence(milestoneId: string) {
  const queue = await getPendingEvidenceQueue();
  await setPendingEvidenceQueue(queue.filter((q) => q.milestoneId !== milestoneId));
}

/**
 * Upload queued evidence to Supabase Storage + update milestone rows.
 */
export async function syncPendingEvidence(projectId?: string): Promise<{
  processed: number;
  failed: number;
}> {
  const queue = await getPendingEvidenceQueue();
  const targets = projectId ? queue.filter((q) => q.projectId === projectId) : queue;
  let processed = 0;
  let failed = 0;
  const remaining = [...queue];

  for (const item of targets) {
    try {
      const path = await uploadMilestoneEvidence(item.localUri, item.milestoneId);
      const { error } = await supabase
        .from('milestones')
        .update({ evidence_url: path, status: 'in_review' })
        .eq('id', item.milestoneId);
      if (error) throw error;
      const idx = remaining.findIndex((r) => r.id === item.id);
      if (idx >= 0) remaining.splice(idx, 1);
      processed++;
    } catch {
      failed++;
      break;
    }
  }
  await setPendingEvidenceQueue(remaining);
  return { processed, failed };
}

/**
 * Workroom query with AsyncStorage hydrate — instant offline load.
 */
export function useOfflineWorkroom(projectId: string | undefined) {
  const { isOffline, isConnected, refresh: refreshNet } = useNetworkStatus();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingEvidence[]>([]);
  const [fromCache, setFromCache] = useState(false);
  const syncingRef = useRef(false);

  useMilestoneRealtimeSync(projectId);

  const query = useQuery({
    queryKey: WORKROOM_KEY(projectId ?? ''),
    queryFn: async () => {
      if (!projectId) return { project: null, milestones: [] as any[] };
      const [projRes, milesRes] = await Promise.all([
        supabase
          .from('projects')
          .select('*, profiles:owner_id(full_name, avatar_url, city)')
          .eq('id', projectId)
          .single(),
        supabase
          .from('milestones')
          .select('*')
          .eq('project_id', projectId)
          .order('step_order', { ascending: true }),
      ]);
      if (projRes.error) throw projRes.error;
      if (milesRes.error) throw milesRes.error;
      const payload: WorkroomPayload = {
        project: projRes.data,
        milestones: milesRes.data ?? [],
      };
      await writeCache(projectId, payload);
      setFromCache(false);
      return payload;
    },
    enabled: !!projectId && isConnected,
    staleTime: 1000 * 60 * 2,
    placeholderData: () => {
      const cached = queryClient.getQueryData<WorkroomPayload>(WORKROOM_KEY(projectId ?? ''));
      return cached;
    },
  });

  // Hydrate from AsyncStorage immediately (offline-first)
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      const cached = await readCache(projectId);
      if (cancelled || !cached) return;
      queryClient.setQueryData(WORKROOM_KEY(projectId), cached);
      setFromCache(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, queryClient]);

  const refreshPending = useCallback(async () => {
    const all = await getPendingEvidenceQueue();
    setPending(projectId ? all.filter((p) => p.projectId === projectId) : all);
  }, [projectId]);

  useEffect(() => {
    refreshPending();
  }, [refreshPending]);

  const runSync = useCallback(async () => {
    if (syncingRef.current || !isConnected) return { processed: 0, failed: 0 };
    syncingRef.current = true;
    try {
      const result = await syncPendingEvidence(projectId);
      await refreshPending();
      if (projectId && result.processed > 0) {
        await query.refetch();
      }
      return result;
    } finally {
      syncingRef.current = false;
    }
  }, [isConnected, projectId, query, refreshPending]);

  // Auto-sync when connectivity returns
  useEffect(() => {
    if (isConnected && pending.length > 0) {
      runSync();
    }
  }, [isConnected, pending.length, runSync]);

  const queueEvidenceOffline = useCallback(
    async (milestoneId: string, localUri: string) => {
      if (!projectId) return;
      await enqueuePendingEvidence({ projectId, milestoneId, localUri });
      // Optimistic local milestone patch
      queryClient.setQueryData(WORKROOM_KEY(projectId), (old: WorkroomPayload | undefined) => {
        if (!old?.milestones) return old;
        return {
          ...old,
          milestones: old.milestones.map((m) =>
            m.id === milestoneId
              ? { ...m, status: 'in_progress', evidence_url: localUri, _pendingSync: true }
              : m,
          ),
        };
      });
      await refreshPending();
    },
    [projectId, queryClient, refreshPending],
  );

  const pendingMilestoneIds = new Set(pending.map((p) => p.milestoneId));

  return {
    ...query,
    isOffline,
    isConnected,
    fromCache,
    pending,
    pendingMilestoneIds,
    queueEvidenceOffline,
    syncPending: runSync,
    refreshNet,
    refreshPending,
  };
}
