-- Monopoly Ecosystem Schema: Algorithmic Bidding, B2B Supply Chain, Embedded Finance (retainage/credit)
-- Additive migration: project_bids, suppliers (contact/is_verified), project_expenses.supplier_id, credit_advances, projects.retainage_balance
-- Run after apex_enterprise_schema and optionally after existing monopoly_ecosystem.sql.

-- ========== 1. Algorithmic Bidding: project_bids ==========
CREATE TABLE IF NOT EXISTS public.project_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount >= 0),
  estimated_days int,
  ai_score numeric,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_bids_project_id ON public.project_bids(project_id);
CREATE INDEX IF NOT EXISTS idx_project_bids_provider_id ON public.project_bids(provider_id);
CREATE INDEX IF NOT EXISTS idx_project_bids_ai_score ON public.project_bids(ai_score DESC NULLS LAST);

ALTER TABLE public.project_bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_bids_select" ON public.project_bids FOR SELECT USING (
  provider_id = auth.uid()
  OR project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid())
);
CREATE POLICY "project_bids_insert" ON public.project_bids FOR INSERT WITH CHECK (provider_id = auth.uid());
CREATE POLICY "project_bids_update" ON public.project_bids FOR UPDATE USING (
  provider_id = auth.uid() OR project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid())
);

COMMENT ON TABLE public.project_bids IS 'Algorithmic bidding: provider bids with amount, estimated_days; ai_score for ranking.';

-- ========== 2. B2B Supply Chain: suppliers (id, name, contact, is_verified) ==========
-- If suppliers already exists (e.g. from monopoly_ecosystem.sql), add missing columns.
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact text,
  is_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS contact text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;

-- Sync is_verified from existing 'verified' column if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'verified'
  ) THEN
    UPDATE public.suppliers SET is_verified = COALESCE(verified, false) WHERE is_verified IS NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Ensure RLS and policy for suppliers (read-all for marketplace)
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "suppliers_select_all" ON public.suppliers;
CREATE POLICY "suppliers_select_all" ON public.suppliers FOR SELECT USING (true);

-- ========== 3. Map project_expenses to suppliers via supplier_id ==========
ALTER TABLE public.project_expenses
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_expenses_supplier_id ON public.project_expenses(supplier_id);

COMMENT ON COLUMN public.project_expenses.supplier_id IS 'B2B supply chain: expense tied to a partner supplier when applicable.';

-- ========== 4. Embedded Finance: credit_advances ==========
CREATE TABLE IF NOT EXISTS public.credit_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  amount_requested numeric NOT NULL CHECK (amount_requested > 0),
  status text NOT NULL DEFAULT 'pending',
  repaid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_advances_provider_id ON public.credit_advances(provider_id);
CREATE INDEX IF NOT EXISTS idx_credit_advances_project_id ON public.credit_advances(project_id);
CREATE INDEX IF NOT EXISTS idx_credit_advances_status ON public.credit_advances(status);

ALTER TABLE public.credit_advances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_advances_select" ON public.credit_advances FOR SELECT USING (
  provider_id = auth.uid()
  OR project_id IN (SELECT id FROM public.projects WHERE owner_id = auth.uid())
);
CREATE POLICY "credit_advances_insert" ON public.credit_advances FOR INSERT WITH CHECK (provider_id = auth.uid());

COMMENT ON TABLE public.credit_advances IS 'Embedded finance: provider working capital advance; repaid_at when settled from final payout.';

-- ========== 5. Projects: retainage_balance (30-day warranty holdback) ==========
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS retainage_balance numeric DEFAULT 0;

COMMENT ON COLUMN public.projects.retainage_balance IS '30-day warranty holdback amount (e.g. 10% of final milestone) until release or defect resolution.';
