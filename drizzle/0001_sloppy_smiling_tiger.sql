CREATE TABLE "course_selections" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"course_name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"color_id" text DEFAULT '9' NOT NULL,
	"gcal_calendar_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_type_calendars" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"course_name" text NOT NULL,
	"event_type" text NOT NULL,
	"gcal_calendar_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"event_uid" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"custom_title" text
);
--> statement-breakpoint
CREATE TABLE "event_title_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"original_title" text NOT NULL,
	"cleaned_title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_title_cache_original_title_unique" UNIQUE("original_title")
);
--> statement-breakpoint
CREATE TABLE "school_calendar_selections" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"school_calendar_id" text NOT NULL,
	"school_calendar_name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"gcal_mirror_calendar_id" text
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "type_grouping_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "course_selections" ADD CONSTRAINT "course_selections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_type_calendars" ADD CONSTRAINT "course_type_calendars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_overrides" ADD CONSTRAINT "event_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_calendar_selections" ADD CONSTRAINT "school_calendar_selections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "course_sel_user_course_idx" ON "course_selections" USING btree ("user_id","course_name");--> statement-breakpoint
CREATE UNIQUE INDEX "course_type_cal_idx" ON "course_type_calendars" USING btree ("user_id","course_name","event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "event_override_user_event_idx" ON "event_overrides" USING btree ("user_id","event_uid");--> statement-breakpoint
CREATE UNIQUE INDEX "school_cal_sel_user_cal_idx" ON "school_calendar_selections" USING btree ("user_id","school_calendar_id");