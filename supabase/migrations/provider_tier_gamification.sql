-- Task 4: Provider Gamification — tier (Bronze, Silver, Gold, Platinum) on profiles.
-- Trigger: upgrade tier when completed_projects hits thresholds and success_score > 90%.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tier text DEFAULT 'Bronze',
  ADD COLUMN IF NOT EXISTS completed_projects int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS success_score numeric DEFAULT 0;

COMMENT ON COLUMN public.profiles.tier IS 'Provider tier: Bronze, Silver, Gold, Platinum.';
COMMENT ON COLUMN public.profiles.completed_projects IS 'Count of completed projects (assigned_provider_id).';
COMMENT ON COLUMN public.profiles.success_score IS 'Success score 0–100 (e.g. completion rate, rating).';

CREATE OR REPLACE FUNCTION public.compute_provider_tier(p_completed int, p_success_score numeric)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_success_score >= 90 AND p_completed >= 30 THEN 'Platinum'
    WHEN p_success_score >= 90 AND p_completed >= 15 THEN 'Gold'
    WHEN p_success_score >= 90 AND p_completed >= 5 THEN 'Silver'
    ELSE 'Bronze'
  END;
$$;

CREATE OR REPLACE FUNCTION public.sync_provider_tier_on_project_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid;
  v_completed int;
  v_success_score numeric;
  v_tier text;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status IS DISTINCT FROM 'completed') THEN
    v_provider_id := NEW.assigned_provider_id;
    IF v_provider_id IS NOT NULL THEN
      SELECT COUNT(*)::int INTO v_completed
        FROM public.projects WHERE assigned_provider_id = v_provider_id AND status = 'completed';
      v_success_score := COALESCE(
        (SELECT (public.get_provider_stats(v_provider_id)->>'completion_rate')::numeric),
        0
      );
      v_tier := public.compute_provider_tier(v_completed, v_success_score);
      UPDATE public.profiles
      SET completed_projects = v_completed, success_score = v_success_score, tier = v_tier
      WHERE id = v_provider_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_provider_tier_on_complete ON public.projects;
CREATE TRIGGER trg_provider_tier_on_complete
  AFTER UPDATE OF status ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_provider_tier_on_project_complete();

COMMENT ON FUNCTION public.compute_provider_tier IS 'Returns Bronze|Silver|Gold|Platinum from completed_projects and success_score (90%+ required for Silver+).';
