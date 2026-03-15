import {
  pgTable,
  text,
  integer,
  timestamp,
  serial,
  uniqueIndex,
  boolean,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  googleId: text("google_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  canvasIcsUrl: text("canvas_ics_url"), // Phase 1: wizard step 3
  typeGroupingEnabled: boolean('type_grouping_enabled').notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const oauthTokens = pgTable(
  "oauth_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["personal", "school"] }).notNull(),
    // Stores the Google email for this account (used by AccountDropdown to show "email + role label")
    email: text("email"),
    encryptedAccessToken: text("encrypted_access_token").notNull(),
    encryptedRefreshToken: text("encrypted_refresh_token"), // null if not granted
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Unique constraint: one row per (userId, role)
    userRoleIdx: uniqueIndex("oauth_tokens_user_role_idx").on(
      table.userId,
      table.role
    ),
  })
);

// Tracks which courses the user has enabled/disabled per session
export const courseSelections = pgTable(
  "course_selections",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseName: text("course_name").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    colorId: text("color_id").notNull().default("9"), // Blueberry default
    gcalCalendarId: text("gcal_calendar_id"), // set after first sync
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userCourseIdx: uniqueIndex("course_sel_user_course_idx").on(
      t.userId,
      t.courseName
    ),
  })
);

// Per-event overrides — only rows for events the user has explicitly toggled or renamed
// No row = event is enabled (default-include pattern)
export const eventOverrides = pgTable(
  "event_overrides",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventUid: text("event_uid").notNull(), // Canvas UID
    enabled: boolean("enabled").notNull().default(false), // false = excluded
    customTitle: text("custom_title"), // user-renamed title (null = use AI-cleaned title)
  },
  (t) => ({
    userEventIdx: uniqueIndex("event_override_user_event_idx").on(
      t.userId,
      t.eventUid
    ),
  })
);

// AI-cleaned titles cache — shared across all users; avoids re-calling AI on repeat syncs
export const eventTitleCache = pgTable("event_title_cache", {
  id: serial("id").primaryKey(),
  originalTitle: text("original_title").notNull().unique(),
  cleanedTitle: text("cleaned_title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

// School calendar mirror selections — tracks which school Google calendars to mirror
export const schoolCalendarSelections = pgTable(
  "school_calendar_selections",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    schoolCalendarId: text("school_calendar_id").notNull(), // Google calendarId on school account
    schoolCalendarName: text("school_calendar_name").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    gcalMirrorCalendarId: text("gcal_mirror_calendar_id"), // sub-calendar on personal account
  },
  (t) => ({
    userSchoolCalIdx: uniqueIndex("school_cal_sel_user_cal_idx").on(
      t.userId,
      t.schoolCalendarId
    ),
  })
);

// Per-(course, event-type) sub-calendar mapping — one GCal sub-calendar per course+type combination
// Created on demand when typeGroupingEnabled=true on first sync for that (userId, courseName, eventType) triple
export const courseTypeCalendars = pgTable(
  'course_type_calendars',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseName: text('course_name').notNull(),
    eventType: text('event_type').notNull(), // 'assignment' | 'quiz' | 'discussion' | 'announcement' | 'event'
    gcalCalendarId: text('gcal_calendar_id').notNull(),
  },
  (t) => ({
    uniqueIdx: uniqueIndex('course_type_cal_idx').on(t.userId, t.courseName, t.eventType),
  })
);
