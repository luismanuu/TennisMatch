-- Secure the _prisma_migrations table
-- This table is internal to Prisma and should not be accessible via PostgREST API

-- Enable Row Level Security on _prisma_migrations table
ALTER TABLE IF EXISTS "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- Create a policy that denies all access via PostgREST
-- Note: Prisma migrations will still work because they use direct database connections
-- with elevated privileges, not through PostgREST
CREATE POLICY "Deny all access to _prisma_migrations"
  ON "_prisma_migrations"
  FOR ALL
  USING (false)
  WITH CHECK (false);
