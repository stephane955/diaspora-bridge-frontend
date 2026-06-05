-- Material Cart & Supplier Workflow
-- project_material_carts: id, project_id, provider_id, supplier_id, items (JSONB), total_amount_cfa, status, payment_status

-- Ensure profiles has role (client | provider | supplier)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text;

-- Create or alter project_material_carts for spec
CREATE TABLE IF NOT EXISTS project_material_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  items jsonb DEFAULT '[]',
  total_amount_cfa numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'pending_approval',
  payment_status text DEFAULT 'unpaid',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id)
);

-- Add columns if table already exists (e.g. from project_material_cart_items flow)
ALTER TABLE project_material_carts ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES auth.users(id);
ALTER TABLE project_material_carts ADD COLUMN IF NOT EXISTS items jsonb DEFAULT '[]';
ALTER TABLE project_material_carts ADD COLUMN IF NOT EXISTS total_amount_cfa numeric DEFAULT 0;
ALTER TABLE project_material_carts ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid';
ALTER TABLE project_material_carts ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE project_material_carts ADD COLUMN IF NOT EXISTS approved_by uuid;

CREATE INDEX IF NOT EXISTS idx_material_carts_project ON project_material_carts(project_id);
CREATE INDEX IF NOT EXISTS idx_material_carts_supplier ON project_material_carts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_material_carts_status ON project_material_carts(status);

ALTER TABLE project_material_carts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "material_carts_select" ON project_material_carts;
CREATE POLICY "material_carts_select" ON project_material_carts FOR SELECT USING (
  auth.uid() IN (SELECT owner_id FROM projects WHERE id = project_id)
  OR auth.uid() = provider_id
  OR auth.uid() = supplier_id
);
DROP POLICY IF EXISTS "material_carts_insert_provider" ON project_material_carts;
CREATE POLICY "material_carts_insert_provider" ON project_material_carts FOR INSERT WITH CHECK (auth.uid() = provider_id);
DROP POLICY IF EXISTS "material_carts_update" ON project_material_carts;
CREATE POLICY "material_carts_update" ON project_material_carts FOR UPDATE USING (
  auth.uid() IN (SELECT owner_id FROM projects WHERE id = project_id)
  OR auth.uid() = provider_id
  OR auth.uid() = supplier_id
);
