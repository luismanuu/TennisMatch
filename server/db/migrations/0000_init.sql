CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"order" integer DEFAULT 0 NOT NULL,
	"default_elo" integer DEFAULT 1000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "cities_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "city_segment_cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_segment_id" uuid NOT NULL,
	"city_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "city_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "city_segments_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "match_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player1_id" uuid,
	"player2_id" uuid,
	"pending_player2_id" uuid,
	"winner_id" uuid,
	"tournament_id" uuid,
	"score" text,
	"played_at" timestamp with time zone,
	"scheduled_at" timestamp with time zone,
	"location" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"is_competitive" boolean DEFAULT true NOT NULL,
	"score_proposed_by" uuid,
	"score_proposed_at" timestamp with time zone,
	"score_approved_by" uuid,
	"schedule_proposed_by" uuid,
	"schedule_proposed_at" timestamp with time zone,
	"schedule_proposed_scheduled_at" timestamp with time zone,
	"schedule_approved_by" uuid,
	"schedule_rejected_by" uuid,
	"reschedule_proposed_by" uuid,
	"reschedule_proposed_at" timestamp with time zone,
	"reschedule_proposed_scheduled_at" timestamp with time zone,
	"reschedule_approved_by" uuid,
	"reschedule_rejected_by" uuid,
	"match_proposed_by" uuid,
	"match_accepted_by" uuid,
	"match_rejected_by" uuid,
	"acceptance_proposed_scheduled_at" timestamp with time zone,
	"acceptance_proposed_location" text,
	"acceptance_change_approved_by" uuid,
	"acceptance_change_rejected_by" uuid,
	"llm_elo_calculated" boolean DEFAULT false,
	"llm_calculation_reasoning" text,
	"llm_calculation_model" text,
	"llm_calculation_timestamp" timestamp with time zone,
	"llm_calculation_failed" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "matches_status_check" CHECK ("matches"."status" in ('scheduled', 'active', 'completed', 'cancelled')),
	CONSTRAINT "matches_participants_check" CHECK (("matches"."tournament_id" is not null and ("matches"."player1_id" is not null or "matches"."player2_id" is not null or "matches"."pending_player2_id" is not null))
        or ("matches"."tournament_id" is null and "matches"."player1_id" is not null and (
          ("matches"."player2_id" is not null and "matches"."pending_player2_id" is null)
          or ("matches"."player2_id" is null and "matches"."pending_player2_id" is not null))))
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"type" text NOT NULL,
	"match_id" uuid NOT NULL,
	"is_read" boolean DEFAULT false,
	"is_dismissed" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"read_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "notifications_type_check" CHECK ("notifications"."type" in ('match_proposal', 'match_created', 'score_proposal', 'schedule_proposal', 'reschedule_proposal', 'acceptance_change'))
);
--> statement-breakpoint
CREATE TABLE "pending_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"category_id" uuid NOT NULL,
	"invited_by_player_id" uuid NOT NULL,
	"invitation_token" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "pending_players_email_unique" UNIQUE("email"),
	CONSTRAINT "pending_players_invitation_token_unique" UNIQUE("invitation_token"),
	CONSTRAINT "pending_players_status_check" CHECK ("pending_players"."status" in ('pending', 'accepted', 'expired'))
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"phone_number" text,
	"city_id" uuid,
	"category_id" uuid,
	"elo" integer DEFAULT 1000 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"deleted_at" timestamp with time zone,
	"mmr" numeric(6, 3) DEFAULT 0,
	"mmr_uncertainty" numeric(4, 2) DEFAULT 2,
	"placement_matches_completed" integer DEFAULT 0,
	"win_streak" integer DEFAULT 0,
	"loss_streak" integer DEFAULT 0,
	"last_match_at" timestamp with time zone,
	"matches_this_month" integer DEFAULT 0,
	"last_decay_check" date,
	"total_matches_played" integer DEFAULT 0,
	"utr_rating" numeric(10, 2),
	"utr_reliability" numeric(4, 3),
	"previous_rank" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "players_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "players_status_check" CHECK ("players"."status" in ('active', 'deleted')),
	CONSTRAINT "check_placement_matches_range" CHECK ("players"."placement_matches_completed" between 0 and 3),
	CONSTRAINT "check_positive_win_streak" CHECK ("players"."win_streak" >= 0),
	CONSTRAINT "check_positive_loss_streak" CHECK ("players"."loss_streak" >= 0),
	CONSTRAINT "check_uncertainty_bounds" CHECK ("players"."mmr_uncertainty" between 0.5 and 2.0)
);
--> statement-breakpoint
CREATE TABLE "rating_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	"elo_before" integer NOT NULL,
	"elo_after" integer NOT NULL,
	"elo_change" integer NOT NULL,
	"mmr_before" numeric(6, 3) NOT NULL,
	"mmr_after" numeric(6, 3) NOT NULL,
	"mmr_change" numeric(6, 3) NOT NULL,
	"uncertainty_before" numeric(4, 2) NOT NULL,
	"uncertainty_after" numeric(4, 2) NOT NULL,
	"k_factor" integer NOT NULL,
	"expected_score" numeric(4, 3) NOT NULL,
	"actual_score" numeric(4, 3) NOT NULL,
	"is_placement_match" boolean DEFAULT false,
	"is_unrated_match" boolean DEFAULT false,
	"win_streak_bonus" integer DEFAULT 0,
	"opponent_id" uuid,
	"opponent_elo" integer,
	"opponent_mmr" numeric(6, 3),
	"was_winner" boolean NOT NULL,
	"rating_reversed" boolean DEFAULT false,
	"reversed_at" timestamp with time zone,
	"reasoning_preview" text,
	"match_rating" numeric(10, 2),
	"match_weight" numeric(4, 3),
	"games_won" integer,
	"games_lost" integer,
	"total_games" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "tournament_group_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"seed_position" integer
);
--> statement-breakpoint
CREATE TABLE "tournament_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"group_name" text NOT NULL,
	"group_number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tournament_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"match_id" uuid,
	"player_id" uuid,
	"bracket_type" text NOT NULL,
	"round_number" integer,
	"group_id" uuid,
	"bracket_position" text,
	"is_bye" boolean DEFAULT false NOT NULL,
	"round_deadline" timestamp with time zone,
	CONSTRAINT "tournament_matches_bracket_type_check" CHECK ("tournament_matches"."bracket_type" in ('group', 'main', 'backdraw')),
	CONSTRAINT "tournament_matches_bye_check" CHECK (("tournament_matches"."is_bye" = false and "tournament_matches"."match_id" is not null) or ("tournament_matches"."is_bye" = true and "tournament_matches"."player_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "tournament_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"status" text DEFAULT 'registered' NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now(),
	"withdrawn_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"check_in_status" text,
	"check_in_at" timestamp with time zone,
	CONSTRAINT "tournament_registrations_status_check" CHECK ("tournament_registrations"."status" in ('registered', 'confirmed', 'withdrawn', 'waitlisted')),
	CONSTRAINT "tournament_registrations_check_in_check" CHECK ("tournament_registrations"."check_in_status" in ('checked_in', 'not_checked_in'))
);
--> statement-breakpoint
CREATE TABLE "tournament_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"round_name" text NOT NULL,
	"bracket_type" text NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'upcoming' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "tournament_rounds_bracket_type_check" CHECK ("tournament_rounds"."bracket_type" in ('group', 'main', 'backdraw')),
	CONSTRAINT "tournament_rounds_status_check" CHECK ("tournament_rounds"."status" in ('upcoming', 'active', 'completed'))
);
--> statement-breakpoint
CREATE TABLE "tournament_standings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"sets_won" integer DEFAULT 0 NOT NULL,
	"sets_lost" integer DEFAULT 0 NOT NULL,
	"games_won" integer DEFAULT 0 NOT NULL,
	"games_lost" integer DEFAULT 0 NOT NULL,
	"head_to_head_wins" integer DEFAULT 0 NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"game_difference" integer DEFAULT 0 NOT NULL,
	"final_position" integer,
	"qualified" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category_id" uuid,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"status" text DEFAULT 'upcoming' NOT NULL,
	"tournament_type" text DEFAULT 'groups_playoffs' NOT NULL,
	"current_phase" text DEFAULT 'registration',
	"group_size" integer DEFAULT 4 NOT NULL,
	"players_per_group_advance" integer DEFAULT 2 NOT NULL,
	"registration_open" boolean DEFAULT true NOT NULL,
	"registration_deadline" timestamp with time zone,
	"max_players" integer,
	"min_players" integer DEFAULT 4 NOT NULL,
	"created_by" uuid NOT NULL,
	"organizer_id" uuid,
	"description" text,
	"rules" text,
	"location" text,
	"points_config" jsonb DEFAULT '{"group_stage":3,"playoffs":5}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "tournaments_status_check" CHECK ("tournaments"."status" in ('upcoming', 'active', 'completed')),
	CONSTRAINT "tournaments_type_check" CHECK ("tournaments"."tournament_type" in ('groups_playoffs', 'single_elimination', 'double_elimination', 'round_robin')),
	CONSTRAINT "tournaments_phase_check" CHECK ("tournaments"."current_phase" in ('registration', 'group_stage', 'playoffs', 'completed')),
	CONSTRAINT "check_organizer_created_by" CHECK ("tournaments"."organizer_id" is null or "tournaments"."organizer_id" = "tournaments"."created_by")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'player' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_role_check" CHECK ("user"."role" in ('player', 'admin', 'tournament_organizer'))
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_segment_cities" ADD CONSTRAINT "city_segment_cities_city_segment_id_city_segments_id_fk" FOREIGN KEY ("city_segment_id") REFERENCES "public"."city_segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_segment_cities" ADD CONSTRAINT "city_segment_cities_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_messages" ADD CONSTRAINT "match_messages_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_messages" ADD CONSTRAINT "match_messages_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_player1_id_players_id_fk" FOREIGN KEY ("player1_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_player2_id_players_id_fk" FOREIGN KEY ("player2_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_pending_player2_id_pending_players_id_fk" FOREIGN KEY ("pending_player2_id") REFERENCES "public"."pending_players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_id_players_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_score_proposed_by_players_id_fk" FOREIGN KEY ("score_proposed_by") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_score_approved_by_players_id_fk" FOREIGN KEY ("score_approved_by") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_schedule_proposed_by_players_id_fk" FOREIGN KEY ("schedule_proposed_by") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_schedule_approved_by_players_id_fk" FOREIGN KEY ("schedule_approved_by") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_schedule_rejected_by_players_id_fk" FOREIGN KEY ("schedule_rejected_by") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_reschedule_proposed_by_players_id_fk" FOREIGN KEY ("reschedule_proposed_by") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_reschedule_approved_by_players_id_fk" FOREIGN KEY ("reschedule_approved_by") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_reschedule_rejected_by_players_id_fk" FOREIGN KEY ("reschedule_rejected_by") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_match_proposed_by_players_id_fk" FOREIGN KEY ("match_proposed_by") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_match_accepted_by_players_id_fk" FOREIGN KEY ("match_accepted_by") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_match_rejected_by_players_id_fk" FOREIGN KEY ("match_rejected_by") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_acceptance_change_approved_by_players_id_fk" FOREIGN KEY ("acceptance_change_approved_by") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_acceptance_change_rejected_by_players_id_fk" FOREIGN KEY ("acceptance_change_rejected_by") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_players" ADD CONSTRAINT "pending_players_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_players" ADD CONSTRAINT "pending_players_invited_by_player_id_players_id_fk" FOREIGN KEY ("invited_by_player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_opponent_id_players_id_fk" FOREIGN KEY ("opponent_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_group_players" ADD CONSTRAINT "tournament_group_players_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_group_players" ADD CONSTRAINT "tournament_group_players_group_id_tournament_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."tournament_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_group_players" ADD CONSTRAINT "tournament_group_players_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_groups" ADD CONSTRAINT "tournament_groups_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_group_id_tournament_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."tournament_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_rounds" ADD CONSTRAINT "tournament_rounds_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_standings" ADD CONSTRAINT "tournament_standings_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_standings" ADD CONSTRAINT "tournament_standings_group_id_tournament_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."tournament_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_standings" ADD CONSTRAINT "tournament_standings_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_created_by_players_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_organizer_id_players_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_categories_order" ON "categories" USING btree ("order");--> statement-breakpoint
CREATE INDEX "idx_cities_order" ON "cities" USING btree ("order");--> statement-breakpoint
CREATE UNIQUE INDEX "city_segment_cities_segment_city_key" ON "city_segment_cities" USING btree ("city_segment_id","city_id");--> statement-breakpoint
CREATE INDEX "idx_city_segment_cities_city" ON "city_segment_cities" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "idx_match_messages_match_created" ON "match_messages" USING btree ("match_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_matches_player1_player2_status_date" ON "matches" USING btree ("player1_id","player2_id","status","played_at");--> statement-breakpoint
CREATE INDEX "idx_matches_player2_player1_status_date" ON "matches" USING btree ("player2_id","player1_id","status","played_at");--> statement-breakpoint
CREATE INDEX "idx_matches_status_scheduled" ON "matches" USING btree ("status","scheduled_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_matches_played_at" ON "matches" USING btree ("played_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_matches_pending_player2" ON "matches" USING btree ("pending_player2_id");--> statement-breakpoint
CREATE INDEX "idx_matches_tournament_id" ON "matches" USING btree ("tournament_id") WHERE "matches"."tournament_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_notifications_unique" ON "notifications" USING btree ("player_id","type","match_id") WHERE not "notifications"."is_dismissed";--> statement-breakpoint
CREATE INDEX "idx_notifications_player_pending" ON "notifications" USING btree ("player_id","created_at" DESC NULLS LAST) WHERE not "notifications"."is_dismissed";--> statement-breakpoint
CREATE INDEX "idx_notifications_match_id" ON "notifications" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "idx_pending_players_invited_by_composite" ON "pending_players" USING btree ("invited_by_player_id","status");--> statement-breakpoint
CREATE INDEX "idx_players_category_id" ON "players" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_players_city_status_elo" ON "players" USING btree ("city_id","status","elo") WHERE "players"."status" = 'active' and "players"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_players_elo" ON "players" USING btree ("elo");--> statement-breakpoint
CREATE INDEX "idx_players_last_match_at" ON "players" USING btree ("last_match_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_rating_history_player" ON "rating_history" USING btree ("player_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_rating_history_match" ON "rating_history" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "idx_rating_history_created" ON "rating_history" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_group_players_key" ON "tournament_group_players" USING btree ("tournament_id","group_id","player_id");--> statement-breakpoint
CREATE INDEX "idx_tournament_group_players_group_id" ON "tournament_group_players" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_tournament_group_players_player_id" ON "tournament_group_players" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_groups_tournament_number_key" ON "tournament_groups" USING btree ("tournament_id","group_number");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_matches_tournament_match_unique" ON "tournament_matches" USING btree ("tournament_id","match_id") WHERE "tournament_matches"."match_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_matches_bye_unique" ON "tournament_matches" USING btree ("tournament_id","bracket_type","round_number","bracket_position") WHERE "tournament_matches"."is_bye" = true;--> statement-breakpoint
CREATE INDEX "idx_tournament_matches_match_id" ON "tournament_matches" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "idx_tournament_matches_group_id" ON "tournament_matches" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_registrations_tournament_player_key" ON "tournament_registrations" USING btree ("tournament_id","player_id");--> statement-breakpoint
CREATE INDEX "idx_tournament_registrations_player_id" ON "tournament_registrations" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_rounds_key" ON "tournament_rounds" USING btree ("tournament_id","bracket_type","round_number");--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_standings_key" ON "tournament_standings" USING btree ("tournament_id","group_id","player_id");--> statement-breakpoint
CREATE INDEX "idx_tournament_standings_group_id" ON "tournament_standings" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_tournaments_status" ON "tournaments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_tournaments_start_date" ON "tournaments" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "idx_tournaments_organizer_id" ON "tournaments" USING btree ("organizer_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");