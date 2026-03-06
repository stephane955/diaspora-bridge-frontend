-- Task 4: Blueprint Store — blueprints table (architect_id, title, price, pdf_url, material_estimate_json).

CREATE TABLE IF NOT EXISTS public.blueprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  architect_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  price numeric NOT NULL CHECK (price >= 0),
  pdf_url text,
  material_estimate_json jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blueprints_architect ON public.blueprints(architect_id);

ALTER TABLE public.blueprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blueprints_select_all" ON public.blueprints FOR SELECT USING (true);
CREATE POLICY "blueprints_insert_own" ON public.blueprints FOR INSERT WITH CHECK (architect_id = auth.uid());
CREATE POLICY "blueprints_update_own" ON public.blueprints FOR UPDATE USING (architect_id = auth.uid());
CREATE POLICY "blueprints_delete_own" ON public.blueprints FOR DELETE USING (architect_id = auth.uid());

COMMENT ON TABLE public.blueprints IS 'Blueprint store: architect designs with price, pdf, and material estimate.';
