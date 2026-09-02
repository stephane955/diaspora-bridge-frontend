-- Monopoly Ecosystem: Bidding, Supply Chain, Bridge Credit, Warranty, Chat translation
-- Run in Supabase SQL Editor. All new objects are additive; RLS applied.

-- ========== TASK 1: Smart Bids ==========
ALTER TABLE project_applications
  ADD COLUMN IF NOT EXISTS material_estimate numeric,
  ADD COLUMN IF NOT EXISTS time_to_completion_days int;

COMMENT ON COLUMN project_applications.material_estimate IS 'Provider estimate for materials (CFA) in Smart Bid';
COMMENT ON COLUMN project_applications.time_to_completion_days IS 'Estimated days to complete in Smart Bid';

-- Provider stats for AI scoring (completion rate, avg rating, dispute count)
CREATE OR REPLACE FUNCTION public.get_provider_stats(p_provider_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT jsonb_build_object(
    'completion_rate', COALESCE(
      (SELECT CASE
        WHEN COUNT(*) FILTER (WHERE status = 'completed') = 0 THEN 0
        ELSE 100.0 * COUNT(*) FILTER (WHERE status = 'completed') / NULLIF(COUNT(*), 0)
      END
      FROM projects WHERE assigned_provider_id = p_provider_id),
      0
    ),
    'avg_review_score', COALESCE(
      (SELECT AVG(rating)::numeric(5,2) FROM reviews WHERE provider_id = p_provider_id),
      0
    ),
    'dispute_count', COALESCE(
      (SELECT COUNT(*) FROM project_disputes pd
       JOIN projects p ON p.id = pd.project_id AND p.assigned_provider_id = p_provider_id),
      0
    ),
    'completed_projects_count', COALESCE(
      (SELECT COUNT(*) FROM projects WHERE assigned_provider_id = p_provider_id AND status = 'completed'),
      0
    )
  );
$$;

-- ========== TASK 2: Partner Suppliers & Material Cart ==========
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text,
  address text,
  contact_phone text,
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_material_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft', -- draft | pending_approval | approved | ordered
  total_materials_cfa numeric NOT NULL DEFAULT 0,
  labor_amount_cfa numeric, -- agreed labor portion
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id)
);

CREATE TABLE IF NOT EXISTS project_material_cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES project_material_carts(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price_cfa numeric NOT NULL,
  total_cfa numeric GENERATED ALWAYS AS (quantity * unit_price_cfa) STORED,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_material_carts_project ON project_material_carts(project_id);
CREATE INDEX IF NOT EXISTS idx_material_cart_items_cart ON project_material_cart_items(cart_id);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_material_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_material_cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_select_all" ON suppliers FOR SELECT USING (true);
CREATE POLICY "material_carts_select" ON project_material_carts FOR SELECT USING (
  auth.uid() IN (SELECT owner_id FROM projects WHERE id = project_id)
  OR auth.uid() = provider_id
);
CREATE POLICY "material_carts_insert" ON project_material_carts FOR INSERT WITH CHECK (provider_id = auth.uid());
CREATE POLICY "material_carts_update" ON project_material_carts FOR UPDATE USING (
  auth.uid() IN (SELECT owner_id FROM projects WHERE id = project_id) OR auth.uid() = provider_id
);
CREATE POLICY "material_cart_items_select" ON project_material_cart_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM project_material_carts c WHERE c.id = cart_id AND (
    c.provider_id = auth.uid() OR auth.uid() IN (SELECT owner_id FROM projects WHERE id = c.project_id)
  ))
);
CREATE POLICY "material_cart_items_insert" ON project_material_cart_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM project_material_carts c WHERE c.id = cart_id AND c.provider_id = auth.uid())
);
CREATE POLICY "material_cart_items_update" ON project_material_cart_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM project_material_carts c WHERE c.id = cart_id AND c.provider_id = auth.uid())
);
CREATE POLICY "material_cart_items_delete" ON project_material_cart_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM project_material_carts c WHERE c.id = cart_id AND c.provider_id = auth.uid())
);

-- Seed example partner suppliers when table is empty (run once)
INSERT INTO suppliers (id, name, city, verified)
SELECT gen_random_uuid(), 'Quincaillerie Centrale', 'Douala', true WHERE NOT EXISTS (SELECT 1 FROM suppliers LIMIT 1);
INSERT INTO suppliers (id, name, city, verified)
SELECT gen_random_uuid(), 'Brico Depot Yaoundé', 'Yaoundé', true WHERE (SELECT COUNT(*) FROM suppliers) < 2;

-- ========== TASK 3: Bridge Credit (Provider Advance) ==========
CREATE TABLE IF NOT EXISTS provider_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cfa numeric NOT NULL CHECK (amount_cfa > 0),
  status text NOT NULL DEFAULT 'pending', -- pending | disbursed | repaid | defaulted
  disbursed_at timestamptz,
  repaid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_advances_project ON provider_advances(project_id);
CREATE INDEX IF NOT EXISTS idx_provider_advances_provider ON provider_advances(provider_id);

ALTER TABLE provider_advances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "provider_advances_select" ON provider_advances FOR SELECT USING (
  provider_id = auth.uid() OR auth.uid() IN (SELECT owner_id FROM projects WHERE id = project_id)
);
CREATE POLICY "provider_advances_insert" ON provider_advances FOR INSERT WITH CHECK (provider_id = auth.uid());

-- Eligibility: success_score > 90 and >= 3 completed projects (computed in app or via RPC)
CREATE OR REPLACE FUNCTION public.get_provider_advance_eligibility(p_provider_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH stats AS (
    SELECT (public.get_provider_stats(p_provider_id)) AS s
  )
  SELECT jsonb_build_object(
    'eligible', (
      (stats.s->>'completion_rate')::numeric >= 90
      AND ((stats.s->>'completed_projects_count')::int) >= 3
    ),
    'completion_rate', (stats.s->>'completion_rate')::numeric,
    'completed_projects_count', (stats.s->>'completed_projects_count')::int,
    'max_advance_pct', 20
  ) FROM stats;
$$;

-- ========== TASK 4: Chat – Voice transcription & translation ==========
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS transcription_text text,
  ADD COLUMN IF NOT EXISTS translation_text text,
  ADD COLUMN IF NOT EXISTS translation_lang text;

-- ========== TASK 5: Warranty (30-day retainage) & Handoff ==========
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS warranty_retainage_cfa numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS warranty_hold_until timestamptz,
  ADD COLUMN IF NOT EXISTS warranty_status text DEFAULT 'none'; -- none | held | frozen | released

CREATE TABLE IF NOT EXISTS project_defects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  reported_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open', -- open | resolved
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_project_defects_project ON project_defects(project_id);

ALTER TABLE project_defects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_defects_select" ON project_defects FOR SELECT USING (public.user_can_access_project(project_id));
CREATE POLICY "project_defects_insert" ON project_defects FOR INSERT WITH CHECK (
  auth.uid() IN (SELECT owner_id FROM projects WHERE id = project_id)
  AND reported_by = auth.uid()
);

-- Release milestone: on final milestone, release 90% and hold 10% for 30 days
CREATE OR REPLACE FUNCTION public.release_milestone(
  p_project_id uuid,
  p_provider_id uuid,
  p_amount numeric,
  p_desc text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_milestone_id uuid;
  v_step_order int;
  v_max_step int;
  v_release_amount numeric;
  v_retainage numeric;
BEGIN
  -- Find next locked milestone for this project
  SELECT id, step_order INTO v_milestone_id, v_step_order
  FROM milestones
  WHERE project_id = p_project_id AND status = 'locked'
  ORDER BY step_order ASC LIMIT 1;

  IF v_milestone_id IS NULL THEN
    RAISE EXCEPTION 'No locked milestone found for this project';
  END IF;

  SELECT MAX(step_order) INTO v_max_step FROM milestones WHERE project_id = p_project_id;

  IF v_step_order = v_max_step AND v_max_step > 0 THEN
    -- Final milestone: 90% to provider, 10% retainage for 30 days
    v_retainage := ROUND(p_amount * 0.10, 0);
    v_release_amount := p_amount - v_retainage;

    UPDATE milestones SET status = 'paid' WHERE id = v_milestone_id;
    INSERT INTO project_expenses (project_id, provider_id, amount, description, status, type)
    VALUES (p_project_id, p_provider_id, v_release_amount, p_desc || ' (90% final)', 'approved', 'milestone');

    UPDATE projects
    SET warranty_retainage_cfa = v_retainage,
        warranty_hold_until = now() + interval '30 days',
        warranty_status = 'held'
    WHERE id = p_project_id;
  ELSE
    -- Non-final: full release
    v_release_amount := p_amount;
    UPDATE milestones SET status = 'paid' WHERE id = v_milestone_id;
    INSERT INTO project_expenses (project_id, provider_id, amount, description, status, type)
    VALUES (p_project_id, p_provider_id, v_release_amount, p_desc, 'approved', 'milestone');
  END IF;
END;
$$;

-- Release warranty retainage after 30 days or when no open defects
CREATE OR REPLACE FUNCTION public.release_warranty_retainage(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_retainage numeric;
  v_status text;
  v_hold_until timestamptz;
  v_open_defects int;
BEGIN
  SELECT warranty_retainage_cfa, warranty_status, warranty_hold_until
  INTO v_retainage, v_status, v_hold_until
  FROM projects WHERE id = p_project_id;

  IF v_retainage IS NULL OR v_retainage <= 0 OR v_status NOT IN ('held', 'frozen') THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_open_defects
  FROM project_defects WHERE project_id = p_project_id AND status = 'open';

  IF v_open_defects > 0 AND v_status = 'frozen' THEN
    RAISE EXCEPTION 'Cannot release retainage while defects are open';
  END IF;

  IF v_status = 'frozen' AND v_open_defects > 0 THEN
    RETURN;
  END IF;

  IF v_hold_until > now() AND v_status = 'held' THEN
    RAISE EXCEPTION 'Warranty period not yet ended';
  END IF;

  UPDATE projects
  SET warranty_retainage_cfa = 0, warranty_hold_until = NULL, warranty_status = 'released'
  WHERE id = p_project_id;

  INSERT INTO project_expenses (project_id, provider_id, amount, description, status, type)
  VALUES (p_project_id, (SELECT assigned_provider_id FROM projects WHERE id = p_project_id), v_retainage, 'Warranty retainage released (30-day hold complete)', 'approved', 'milestone');
END;
$$;
