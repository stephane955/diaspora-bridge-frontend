-- Task 2 (Tax): Schema support for generate-tax-report Edge Function.
-- Closed projects per user are queried for capital deployed and property tax categories.
-- No new tables required; function will query projects + milestones/expenses.
-- Ensure we have a way to mark "closed" (status = 'completed') and track total capital.

-- Optional: store report generation audit (for idempotency or history)
CREATE TABLE IF NOT EXISTS public.tax_report_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type text NOT NULL DEFAULT 'annual',
  period_start date,
  period_end date,
  generated_at timestamptz DEFAULT now(),
  output_format text DEFAULT 'json'
);

CREATE INDEX IF NOT EXISTS idx_tax_report_audit_user ON public.tax_report_audit(user_id);

ALTER TABLE public.tax_report_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tax_report_audit_select_own" ON public.tax_report_audit FOR SELECT USING (user_id = auth.uid());
