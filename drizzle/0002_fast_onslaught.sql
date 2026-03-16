CREATE TABLE "classifier_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_name_pattern" text NOT NULL,
	"category" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "classifier_cache_event_name_pattern_unique" UNIQUE("event_name_pattern")
);
--> statement-breakpoint
CREATE TABLE "course_type_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"course_name" text NOT NULL,
	"event_type" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "course_type_settings" ADD CONSTRAINT "course_type_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "course_type_settings_idx" ON "course_type_settings" USING btree ("user_id","course_name","event_type");--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "type_grouping_enabled";