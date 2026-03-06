/**
 * Workroom data with TanStack Query: aggressive cache + optimistic milestone update.
 * When Provider uploads proof, UI instantly shows "Pending Approval"; mutation runs in background.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

const WORKROOM_KEY = (projectId: string) => ['workroom', projectId] as const;

export function useWorkroomQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: WORKROOM_KEY(projectId ?? ''),
    queryFn: async () => {
      if (!projectId) return { project: null, milestones: [] };
      const [projRes, milesRes] = await Promise.all([
        supabase.from('projects').select('*, profiles:owner_id(full_name, avatar_url, city)').eq('id', projectId).single(),
        supabase.from('milestones').select('*').eq('project_id', projectId).order('created_at', { ascending: true }),
      ]);
      if (projRes.error) throw projRes.error;
      if (milesRes.error) throw milesRes.error;
      return { project: projRes.data, milestones: milesRes.data ?? [] };
    },
    enabled: !!projectId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useMilestoneUploadEvidence(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ milestoneId, evidenceUrl }: { milestoneId: string; evidenceUrl: string }) => {
      const { error } = await supabase
        .from('milestones')
        .update({ evidence_url: evidenceUrl, status: 'in_review' })
        .eq('id', milestoneId);
      if (error) throw error;
      return { milestoneId, evidenceUrl };
    },
    onMutate: async ({ milestoneId }) => {
      if (!projectId) return;
      await queryClient.cancelQueries({ queryKey: WORKROOM_KEY(projectId) });
      const prev = queryClient.getQueryData<{ project: unknown; milestones: any[] }>(WORKROOM_KEY(projectId));
      queryClient.setQueryData(WORKROOM_KEY(projectId), (old: typeof prev) => {
        if (!old?.milestones) return old;
        return {
          ...old,
          milestones: old.milestones.map((m) =>
            m.id === milestoneId ? { ...m, status: 'in_review', evidence_url: 'pending' } : m
          ),
        };
      });
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (projectId && context?.prev) {
        queryClient.setQueryData(WORKROOM_KEY(projectId), context.prev);
      }
    },
    onSettled: () => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: WORKROOM_KEY(projectId) });
      }
    },
  });
}
