-- After identity verification: record submission time and document paths for review.
-- Enables admin/edge function to know who submitted and which storage paths to open.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_submitted_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_document_paths jsonb;

COMMENT ON COLUMN profiles.verification_submitted_at IS 'When the provider last submitted KYC documents.';
COMMENT ON COLUMN profiles.verification_document_paths IS 'Storage paths in kyc_documents bucket, e.g. { "front": "userId/front_123.jpg", "back": "...", "selfie": "..." }.';

-- Allow app to create a notification for the current user (e.g. "Verification submitted").
DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
CREATE POLICY "notifications_insert_own" ON notifications FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());
