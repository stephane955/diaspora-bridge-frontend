DROP POLICY IF EXISTS "material_carts_update" ON project_material_carts;

CREATE POLICY "material_carts_update_provider"
ON project_material_carts
FOR UPDATE
USING (auth.uid() = provider_id)
WITH CHECK (
  auth.uid() = provider_id
  AND status = 'pending_approval'
  AND payment_status = 'unpaid'
);

CREATE POLICY "material_carts_update_client_approval"
ON project_material_carts
FOR UPDATE
USING (auth.uid() IN (SELECT owner_id FROM projects WHERE id = project_id))
WITH CHECK (
  auth.uid() IN (SELECT owner_id FROM projects WHERE id = project_id)
  AND status IN ('approved', 'pending_approval')
);

CREATE POLICY "material_carts_update_supplier_collection"
ON project_material_carts
FOR UPDATE
USING (auth.uid() = supplier_id)
WITH CHECK (
  auth.uid() = supplier_id
  AND status IN ('approved', 'collected')
);
