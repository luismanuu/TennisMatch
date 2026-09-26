-- Re-runnable: every statement checks before it adds. No CREATE INDEX CONCURRENTLY: match_messages is tiny
-- (tens of rows on staging) and drizzle runs each migration in a transaction, where CONCURRENTLY is not allowed.
ALTER TABLE "match_messages" ADD COLUMN IF NOT EXISTS "moderation_status" text DEFAULT 'visible' NOT NULL;--> statement-breakpoint
ALTER TABLE "match_messages" ADD COLUMN IF NOT EXISTS "moderation_scores" jsonb;--> statement-breakpoint
ALTER TABLE "match_messages" ADD COLUMN IF NOT EXISTS "moderation_reviewed_by" text;--> statement-breakpoint
ALTER TABLE "match_messages" ADD COLUMN IF NOT EXISTS "moderation_reviewed_at" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'match_messages_moderation_reviewed_by_user_id_fk') THEN
    ALTER TABLE "match_messages" ADD CONSTRAINT "match_messages_moderation_reviewed_by_user_id_fk" FOREIGN KEY ("moderation_reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_match_messages_held" ON "match_messages" USING btree ("created_at") WHERE "match_messages"."moderation_status" = 'held';--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'match_messages_moderation_status_check') THEN
    ALTER TABLE "match_messages" ADD CONSTRAINT "match_messages_moderation_status_check" CHECK ("match_messages"."moderation_status" in ('visible', 'held', 'rejected'));
  END IF;
END $$;
