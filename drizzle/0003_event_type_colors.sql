ALTER TABLE "course_type_settings" ADD COLUMN "color_id" text NOT NULL DEFAULT '1';
--> statement-breakpoint
UPDATE "course_type_settings" SET "color_id" = '9' WHERE "event_type" = 'Assignments';
--> statement-breakpoint
UPDATE "course_type_settings" SET "color_id" = '11' WHERE "event_type" = 'Quizzes';
--> statement-breakpoint
UPDATE "course_type_settings" SET "color_id" = '2' WHERE "event_type" = 'Discussions';
--> statement-breakpoint
UPDATE "course_type_settings" SET "color_id" = '6' WHERE "event_type" = 'Events';
--> statement-breakpoint
UPDATE "course_type_settings" SET "color_id" = '8' WHERE "event_type" = 'Announcements';
--> statement-breakpoint
UPDATE "course_type_settings" SET "color_id" = '3' WHERE "event_type" = 'Exams';
--> statement-breakpoint
UPDATE "course_type_settings" SET "color_id" = '7' WHERE "event_type" = 'Labs';
--> statement-breakpoint
UPDATE "course_type_settings" SET "color_id" = '5' WHERE "event_type" = 'Lectures';
--> statement-breakpoint
UPDATE "course_type_settings" SET "color_id" = '4' WHERE "event_type" = 'Projects';
