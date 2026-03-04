-- Apex Enterprise: Schema for Observer, Expenses, Contract, Dispute, Push
-- Run this in Supabase SQL Editor or via migrations.

-- 1. OBSERVER ROLE: View-only access via invite link
CREATE TABLE IF NOT EXISTS project_observers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invite_token text NOT NULL UNIQUE,
  email text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_project_observers_project ON project_observers(project_id);
CREATE INDEX IF NOT EXISTS idx_project_observers_token ON project_observers(invite_token);
CREATE INDEX IF NOT EXISTS idx_project_observers_user ON project_observers(user_id);

-- 2. MATERIAL EXPENSES / RECEIPT LEDGER (extend or use project_expenses)
-- If project_expenses exists with (project_id, amount, description, status), add columns:
ALTER TABLE project_expenses ADD COLUMN IF NOT EXISTS receipt_url text;
ALTER TABLE project_expenses ADD COLUMN IF NOT EXISTS extracted_amount numeric;
ALTER TABLE project_expenses ADD COLUMN IF NOT EXISTS type text DEFAULT 'milestone'; -- 'milestone' | 'material'
ALTER TABLE project_expenses ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES auth.users(id);
-- Material budget cap (optional)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS material_budget numeric;

-- 3. DIGITAL CONTRACT & E-SIGNATURE
CREATE TABLE IF NOT EXISTS project_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  pdf_url text,
  client_signed_at timestamptz,
  provider_signed_at timestamptz,
  client_signature_url text,
  provider_signature_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_contracts_project ON project_contracts(project_id);

-- 4. ARBITRATION / DISPUTE
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS dispute_status text DEFAULT 'none'; -- 'none' | 'open' | 'resolved'
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS disputed_at timestamptz;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS dispute_milestone_id uuid REFERENCES milestones(id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS arbitration_admin_id uuid REFERENCES auth.users(id);
-- Optional: disputes table for thread
CREATE TABLE IF NOT EXISTS project_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id uuid NOT NULL REFERENCES milestones(id),
  opened_by uuid REFERENCES auth.users(id),
  resolved_by uuid REFERENCES auth.users(id),
  resolution text,
  status text NOT NULL DEFAULT 'open', -- 'open' | 'resolved'
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_project_disputes_project ON project_disputes(project_id);

-- 5. PUSH: profiles.push_token already used by app
-- Ensure profiles has push_token if not present:
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token text;

-- RLS (simplified; adjust to your auth)
ALTER TABLE project_observers ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Observers readable by project owner and observers"
  ON project_observers FOR SELECT USING (
    auth.uid() IN (SELECT owner_id FROM projects WHERE id = project_id)
    OR auth.uid() = user_id
  );
CREATE POLICY "Project owner can insert observers"
  ON project_observers FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT owner_id FROM projects WHERE id = project_id)
  );

CREATE POLICY "Contract readable by project parties"
  ON project_contracts FOR SELECT USING (
    auth.uid() IN (SELECT owner_id FROM projects WHERE id = project_id)
    OR auth.uid() IN (SELECT assigned_provider_id FROM projects WHERE id = project_id)
  );

CREATE POLICY "Disputes readable by project and admin"
  ON project_disputes FOR SELECT USING (
    auth.uid() IN (SELECT owner_id FROM projects WHERE id = project_id)
    OR auth.uid() IN (SELECT assigned_provider_id FROM projects WHERE id = project_id)
    OR auth.uid() IN (SELECT arbitration_admin_id FROM projects WHERE id = project_id)
  );
