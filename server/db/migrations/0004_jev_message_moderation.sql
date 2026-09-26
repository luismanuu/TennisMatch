ALTER TABLE "match_messages" ADD COLUMN "moderation_status" text DEFAULT 'visible' NOT NULL;--> statement-breakpoint
ALTER TABLE "match_messages" ADD COLUMN "moderation_scores" jsonb;--> statement-breakpoint
ALTER TABLE "match_messages" ADD COLUMN "moderation_reviewed_by" text;--> statement-breakpoint
ALTER TABLE "match_messages" ADD COLUMN "moderation_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "match_messages" ADD CONSTRAINT "match_messages_moderation_reviewed_by_user_id_fk" FOREIGN KEY ("moderation_reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_match_messages_held" ON "match_messages" USING btree ("created_at") WHERE "match_messages"."moderation_status" = 'held';--> statement-breakpoint
ALTER TABLE "match_messages" ADD CONSTRAINT "match_messages_moderation_status_check" CHECK ("match_messages"."moderation_status" in ('visible', 'held', 'rejected'));