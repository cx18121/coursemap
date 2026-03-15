# Phase 4: Event Type Grouping — Sub-Calendars per Course and Type - Research

**Researched:** 2026-03-15
**Domain:** Canvas ICS event type classification, Google Calendar sub-calendar proliferation management, Drizzle schema migrations, React UI extension
**Confidence:** HIGH for core mechanics (verified against existing codebase); MEDIUM for Canvas event type taxonomy (no official spec — pattern-inferred from existing title cleanup logic and Canvas docs)

---

## Summary

Phase 4 adds a second dimension of sub-calendar organization. Today the app creates one Google Calendar sub-calendar per Canvas course (e.g., "Canvas - Math 101"). This phase would further split events within each course into type-specific sub-calendars (e.g., "Canvas - Math 101 — Assignments", "Canvas - Math 101 — Quizzes").

The core technical problem has three parts: (1) classify Canvas ICS events into a type taxonomy reliably enough, (2) route events to per-(course, type) sub-calendars instead of per-course sub-calendars, and (3) manage the combinatorial explosion in sub-calendar count and DB schema. The existing `gcalSubcalendars.ts` DB-first pattern, `icalParser.ts` title analysis, and `courseSelections` table all have direct extension points for this feature.

**Primary recommendation:** Classify event types from ICS SUMMARY patterns (assignments vs quizzes vs discussions vs generic events) using a pure-function classifier service, extend the schema with a `gcalCalendarIdByType` JSONB column or new `courseTypeCalendars` table, and update `gcalSync.ts` to route to `ensureTypeSubCalendar` instead of `ensureSubCalendar`. Make per-type grouping a user-controlled toggle (opt-in) to avoid breaking existing user setups.

The phase requires a Drizzle schema migration, a new event type classifier, an extension to `gcalSubcalendars.ts`, and UI toggle controls. No new npm packages are needed.

---

## Standard Stack

### Core (all already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `googleapis` | ^171.4.0 | Google Calendar sub-calendar creation and event routing | Already used in `gcalSubcalendars.ts` and `gcalSync.ts` |
| `drizzle-orm` | ^0.45.1 | Schema extension, new migration for type-calendar mapping | Already used project-wide |
| `node-ical` | ^0.25.5 | Canvas ICS parsing — provides SUMMARY field for type classification | Already used in `icalParser.ts` |
| `@neondatabase/serverless` | ^1.0.2 | Postgres host for new schema columns | Already in use |

### No New Dependencies Required
All capabilities needed for this phase exist in the already-installed stack. The classifier is pure TypeScript logic. Sub-calendar creation reuses the existing Google Calendar API client pattern.

---

## Architecture Patterns

### Recommended Project Structure Extensions
```
src/
├── services/
│   ├── eventTypeClassifier.ts     # NEW: pure-function type detection
│   ├── eventTypeClassifier.test.ts # NEW: unit tests
│   ├── gcalSubcalendars.ts        # EXTEND: add ensureTypeSubCalendar()
│   └── gcalSync.ts                # EXTEND: route to type sub-calendar when mode enabled
├── lib/db/
│   └── schema.ts                  # EXTEND: add courseTypeCalendars table
└── components/
    └── CourseAccordion.tsx         # EXTEND: add per-type grouping toggle
```

### Pattern 1: Canvas Event Type Classification

**What:** A pure function that inspects the VEVENT SUMMARY field to determine event type.
**When to use:** Called in `icalParser.ts` when building `CanvasEvent`, or lazily in `gcalSync.ts` before routing.

**Canvas ICS VEVENT type signals (MEDIUM confidence — pattern-inferred):**
- Canvas does NOT include a CATEGORIES or X-TYPE field in its ICS export. The `to_ics` method in the Canvas source only sets `dtstart`, `dtend`, `summary`, `description`, `url`, `uid`, `sequence`, and `ip_class = "PUBLIC"`.
- Type must therefore be inferred from the SUMMARY string.

**Known SUMMARY patterns (from existing `titleCleanup.ts` and Canvas community docs):**
```
"Submit Assignment: Homework 1 [CS 201-001 Spring 2026]"   → assignment
"Submit Assignment Homework 1 [CS 201-001 Spring 2026]"    → assignment
"Quiz 1 [Math 101]"                                         → quiz
"Quiz: Chapter 3 [Math 101]"                               → quiz
"Discussion: Week 2 Reading [English 100]"                 → discussion
"Announcement: Midterm Reminder [CS 201]"                  → announcement
"CS 201 Office Hours"                                      → event (no course bracket prefix)
"Midterm Exam [CS 201-001 Spring 2026]"                   → exam (optional subtype)
```

**Recommended taxonomy (5 types):**
```typescript
export type CanvasEventType =
  | 'assignment'
  | 'quiz'
  | 'discussion'
  | 'announcement'
  | 'event';   // catch-all for generic/unclassified
```

**Classification function:**
```typescript
// Source: inferred from titleCleanup.ts patterns + Canvas ICS format
export function classifyEventType(summary: string): CanvasEventType {
  const s = summary.trim().toLowerCase();
  if (/^submit\s+(assignment:?\s+)?/i.test(summary)) return 'assignment';
  if (/^quiz[:\s]/i.test(summary)) return 'quiz';
  if (/^discussion[:\s]/i.test(summary)) return 'discussion';
  if (/^announcement[:\s]/i.test(summary)) return 'announcement';
  return 'event';
}
```

**Warning:** Canvas institutions may customize event title templates. The patterns above cover standard Canvas behavior but some institutional deployments prefix titles differently. This function should have a fallback to `'event'` and must never throw.

### Pattern 2: CanvasEvent Type Extension

Extend the existing `CanvasEvent` interface in `icalParser.ts` to carry type:
```typescript
export interface CanvasEvent {
  summary: string;
  description: string;
  start: Date;
  end: Date;
  courseName: string;
  uid: string;
  eventType: CanvasEventType;  // NEW field
}
```
Set it during `parseCanvasFeed()` by calling `classifyEventType(summary)`.

### Pattern 3: Per-(Course, Type) Sub-Calendar DB Schema

**Option A — JSONB column on `courseSelections` (simpler, less normalized):**
```typescript
// Add to courseSelections table
gcalCalendarIdByType: jsonb('gcal_calendar_id_by_type').$type<Record<string, string>>()
// e.g. { assignment: "calId1", quiz: "calId2", event: "calId3" }
```
- Pro: Single table, no join needed.
- Con: JSONB updates require read-modify-write to avoid overwriting other keys.

**Option B — New `courseTypeCalendars` table (more normalized, extensible — recommended):**
```typescript
export const courseTypeCalendars = pgTable(
  'course_type_calendars',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    courseName: text('course_name').notNull(),
    eventType: text('event_type').notNull(),  // 'assignment' | 'quiz' | 'discussion' | 'announcement' | 'event'
    gcalCalendarId: text('gcal_calendar_id').notNull(),
  },
  (t) => ({
    uniqueIdx: uniqueIndex('course_type_cal_user_course_type_idx').on(t.userId, t.courseName, t.eventType),
  })
);
```
- Pro: Clean upserts, clear unique constraint per (user, course, type). Same DB-first pattern as `schoolCalendarSelections`.
- Con: New table, new migration.

**Recommendation: Option B.** Matches the established pattern in `gcalSubcalendars.ts` and avoids fragile JSONB merge logic.

### Pattern 4: ensureTypeSubCalendar (extension of existing helper)

```typescript
// Source: mirrors ensureSubCalendar() in gcalSubcalendars.ts
export async function ensureTypeSubCalendar(
  calendar: calendar_v3.Calendar,
  userId: number,
  courseName: string,
  eventType: CanvasEventType,
  colorId: string
): Promise<string> {
  // 1. DB-first check: courseTypeCalendars WHERE (userId, courseName, eventType)
  // 2. If found, return gcalCalendarId
  // 3. If not, calendar.calendars.insert({ summary: `Canvas - ${courseName} — ${capitalize(eventType)}s` })
  // 4. calendarList.patch to set colorId
  // 5. Insert into courseTypeCalendars
  // 6. Return new calendarId
}
```

Sub-calendar naming convention:
- `Canvas - Math 101 — Assignments`
- `Canvas - Math 101 — Quizzes`
- `Canvas - Math 101 — Discussions`
- `Canvas - Math 101 — Events`

### Pattern 5: User-Controlled Toggle (Opt-In)

**Do not break existing users.** Phase 2 created per-course sub-calendars that users already have populated. Switching to per-type grouping must be a user choice (not automatic), otherwise:
- Old sub-calendars would go stale (events no longer routed there)
- Users would lose their existing Google Calendar organization unexpectedly

**Recommended approach:** Add a `typeGroupingEnabled` boolean column to the `users` table (default `false`). When `false`, sync uses the existing per-course path. When `true`, sync uses the per-(course, type) path.

Alternatively: Store preference in `courseSelections` per-course so users can opt-in per course. This is more granular but more complex to implement.

**Simpler MVP:** A global toggle per user stored in `users.typeGroupingEnabled`.

### Pattern 6: Migration Strategy

Because existing `courseSelections.gcalCalendarId` rows point to "Canvas - CourseName" sub-calendars, enabling type grouping creates NEW sub-calendars alongside the old ones. The old per-course sub-calendars remain untouched (just stop receiving new events).

**No data migration is needed** for existing calendar events — they stay in the old sub-calendar. Only new sync runs will route to the new per-type sub-calendars. This is acceptable behavior.

### Anti-Patterns to Avoid

- **Reclassifying on every sync:** Event type classification from SUMMARY is deterministic. Cache the type in DB or on the `CanvasEvent` object — don't re-regex on every sync.
- **Creating sub-calendars eagerly for all types:** Only create a type sub-calendar when at least one event of that type exists for a course. Don't pre-create "Canvas - Math 101 — Announcements" if there are no announcements.
- **Setting colorId per-event instead of per-calendar:** The existing decision (Phase 2) set color at the sub-calendar level only. Type sub-calendars should follow the same rule. Use `calendarList.patch` not `events.insert({ colorId })`.
- **Breaking the bulk dedup pattern:** Phase 2 replaced per-event `events.list` with a single `events.list` per sub-calendar. With type grouping, there is one sub-calendar per (course, type), so the bulk dedup must be called once per sub-calendar bucket, not once per course. The existing `existingByUid` Map approach in `gcalSync.ts` works correctly at the sub-calendar level — just scope it to each (course, type) pair.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sub-calendar creation/caching | Custom calendar creation logic | Extend `ensureSubCalendar` pattern from `gcalSubcalendars.ts` | Already handles DB-first check, API call, calendarList.patch, DB persist — copy the pattern |
| Calendar color management | Custom color palette | Existing `GOOGLE_CALENDAR_COLORS` + `colorAssignment.ts` | Color round-robin already handles up to 11 courses; per-type calendars should inherit course color |
| Type-specific DB storage | JSONB blob manipulation | New `courseTypeCalendars` table with Drizzle | Standard relational pattern; JSONB is error-prone for partial updates |
| Event dedup per type-sub-calendar | Re-building dedup logic | Reuse `existingByUid` Map pattern from `gcalSync.ts` per sub-calendar bucket | The existing logic is correct per-calendar — just change what a "calendar" is |

**Key insight:** Every piece of infrastructure needed for type sub-calendars already exists — the only novelty is the classification step and the routing decision. This is mostly plumbing extension, not new architecture.

---

## Common Pitfalls

### Pitfall 1: Sub-Calendar Count Explosion on Large Course Loads

**What goes wrong:** A student with 8 courses × 5 types = 40 sub-calendars. Google Calendar's sidebar becomes unusable with 40 calendars. At 10 courses × 5 types = 50.

**Why it happens:** Naive implementation creates one sub-calendar per (course, type) pair without checking whether that type has any events.

**How to avoid:** Only create a type sub-calendar for types that actually have events in a given course. In practice most courses will have assignments + quizzes + events = 3 calendars max per course. At 8 courses that's ~24. Acceptable.

**Warning signs:** High `calendar.calendars.insert` call count during first sync after enabling type grouping.

### Pitfall 2: Event Re-routing Breaks Existing Dedup

**What goes wrong:** An event that previously lived in "Canvas - Math 101" now needs to route to "Canvas - Math 101 — Assignments". The existing dedup logic (`canvasSourceCalendarId=canvas` private property filter) queries the OLD sub-calendar and finds nothing. The event is re-inserted as a duplicate.

**Why it happens:** `gcalSync.ts` queries `existingByUid` from the sub-calendar the event will be written to. If routing changes, the dedup check runs against a newly created empty sub-calendar.

**How to avoid:**
1. When type grouping is first enabled, do NOT delete the old per-course sub-calendars. Accept that old events live in old calendars and new events route to type-specific ones.
2. OR: Add a one-time migration that moves events from old sub-calendars to new type sub-calendars (complex, not recommended for MVP).
3. The safest approach: store `eventType` in the `extendedProperties.private` block alongside `canvasCanvasUid` so events in either sub-calendar type are queryable.

### Pitfall 3: Classification Errors on Institutional Title Variations

**What goes wrong:** Some Canvas institutions configure custom title templates. A quiz might be titled "W3 Assessment: [CS 201]" not "Quiz: [CS 201]". It falls into `'event'` bucket instead of `'quiz'`.

**Why it happens:** The classifier relies on prefix patterns from standard Canvas behavior.

**How to avoid:** The fallback to `'event'` is safe — misclassified events still sync correctly, just go to the "Events" sub-calendar instead of "Quizzes". Document that classification accuracy is best-effort.

### Pitfall 4: Drizzle Migration Required Before Deploy

**What goes wrong:** Deploying code that references `courseTypeCalendars` before the Drizzle migration runs causes a DB query error at runtime.

**Why it happens:** Neon Postgres doesn't auto-apply Drizzle migrations on deploy.

**How to avoid:** Include a Wave 0 task that runs `npx drizzle-kit generate` and `npx drizzle-kit migrate` as part of the phase. The project already has this pattern — it was applied in Phase 2 when the 4-table extension was added. The migration file goes in `./drizzle/` and should be committed.

### Pitfall 5: Color Assignment for Type Sub-Calendars

**What goes wrong:** Each type sub-calendar needs a colorId. If you assign random colors, the user sees 5 different-colored calendars for the same course, defeating the purpose of course-color coding.

**Why it happens:** The color assignment function in `colorAssignment.ts` assigns per course, not per type.

**How to avoid:** Assign the same `colorId` to all type sub-calendars within a course (matching the course's existing colorId). The course color identity is more useful than per-type color differentiation. Retrieve the course's colorId from `courseSelections` and pass it to `ensureTypeSubCalendar`.

---

## Code Examples

### Event Type Classifier (new service)
```typescript
// src/services/eventTypeClassifier.ts
export type CanvasEventType = 'assignment' | 'quiz' | 'discussion' | 'announcement' | 'event';

export function classifyEventType(summary: string): CanvasEventType {
  if (/^submit\s+(assignment:?\s+)?/i.test(summary)) return 'assignment';
  if (/^quiz[:\s]/i.test(summary)) return 'quiz';
  if (/^discussion[:\s]/i.test(summary)) return 'discussion';
  if (/^announcement[:\s]/i.test(summary)) return 'announcement';
  return 'event';
}
```

### Schema Extension (new table)
```typescript
// Append to src/lib/db/schema.ts
export const courseTypeCalendars = pgTable(
  'course_type_calendars',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseName: text('course_name').notNull(),
    eventType: text('event_type').notNull(),
    gcalCalendarId: text('gcal_calendar_id').notNull(),
  },
  (t) => ({
    uniqueIdx: uniqueIndex('course_type_cal_idx').on(t.userId, t.courseName, t.eventType),
  })
);
```

### ensureTypeSubCalendar (extension of gcalSubcalendars.ts)
```typescript
// Mirrors ensureSubCalendar — DB-first pattern
export async function ensureTypeSubCalendar(
  calendar: calendar_v3.Calendar,
  userId: number,
  courseName: string,
  eventType: CanvasEventType,
  colorId: string
): Promise<string> {
  const existing = await db.query.courseTypeCalendars.findFirst({
    where: and(
      eq(courseTypeCalendars.userId, userId),
      eq(courseTypeCalendars.courseName, courseName),
      eq(courseTypeCalendars.eventType, eventType)
    ),
  });

  if (existing?.gcalCalendarId) return existing.gcalCalendarId;

  const typeLabel = eventType.charAt(0).toUpperCase() + eventType.slice(1) + 's';
  const insertRes = await calendar.calendars.insert({
    requestBody: { summary: `Canvas - ${courseName} — ${typeLabel}` },
  });
  const calendarId = insertRes.data.id!;

  await calendar.calendarList.patch({
    calendarId,
    colorRgbFormat: false,
    requestBody: { colorId },
  }).catch(() => {});

  await db.insert(courseTypeCalendars).values({ userId, courseName, eventType, gcalCalendarId: calendarId });

  return calendarId;
}
```

### gcalSync routing change (conceptual delta)
```typescript
// BEFORE (Phase 2):
const subCalId = await ensureSubCalendar(calendar, userId, courseName, colorId);

// AFTER (Phase 4, when type grouping enabled):
const eventType = classifyEventType(event.summary);
const subCalId = await ensureTypeSubCalendar(calendar, userId, courseName, eventType, colorId);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| One calendar for all Canvas events | One sub-calendar per course ("Canvas - CourseName") | Phase 2 | Color-coded courses in Google Calendar sidebar |
| — | One sub-calendar per (course, type) | Phase 4 | Type-based filtering in Google Calendar sidebar |

**Existing constraints from Phase 2 decisions that Phase 4 must preserve:**
- `colorId` is set at sub-calendar level via `calendarList.patch`, not on individual events
- `ensureSubCalendar` uses DB-first pattern (check DB before any API call)
- `canvasSourceCalendarId=canvas` private extended property on every event (required for bulk dedup filter)
- `canvasCanvasUid` private extended property on every event (required for dedup by UID)

---

## Open Questions

1. **Per-user or per-course opt-in toggle?**
   - What we know: Type grouping is additive (new sub-calendars alongside existing ones)
   - What's unclear: Should users be able to enable grouping for only some courses?
   - Recommendation: Global per-user toggle for MVP simplicity; per-course is a future enhancement

2. **What to do with the old per-course sub-calendar when type grouping is enabled?**
   - What we know: Existing events in "Canvas - Math 101" remain there even after type grouping is enabled
   - What's unclear: Should the old calendar be kept (read-only legacy), renamed, or hidden?
   - Recommendation: Leave as-is. Google Calendar users can manually hide or delete old calendars. App does not manage calendar deletion.

3. **How to surface type grouping toggle in the UI?**
   - What we know: Dashboard shows CourseAccordion per course; a global settings toggle makes sense
   - What's unclear: Whether this is a settings page feature or an inline toggle in the dashboard
   - Recommendation: Add to an existing "settings" area or as a simple toggle near the Canvas Courses section header

4. **Announcement events in Canvas ICS feeds**
   - What we know: Canvas can include announcements as calendar events; they appear with "Announcement:" prefix
   - What's unclear: Whether announcements have a `due_at` date (they may be date-less and not appear in ICS)
   - Recommendation: Include classification for completeness, but treat gracefully when zero announcements exist for a course

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30 + ts-jest 29 |
| Config file | `jest.config.js` (project root) |
| Quick run command | `npx jest src/services/eventTypeClassifier.test.ts --no-coverage` |
| Full suite command | `npx jest --no-coverage` |

### Phase Requirements → Test Map

This phase has no formal requirement IDs assigned yet. The behaviors that need test coverage are:

| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| `classifyEventType` correctly classifies assignment/quiz/discussion/announcement/event | unit | `npx jest src/services/eventTypeClassifier.test.ts -t "classifyEventType"` | Wave 0 |
| `classifyEventType` returns `'event'` for unrecognized patterns (fallback safety) | unit | `npx jest src/services/eventTypeClassifier.test.ts -t "fallback"` | Wave 0 |
| `ensureTypeSubCalendar` returns cached calendarId on second call (DB-first) | unit | `npx jest src/services/gcalSubcalendars.test.ts -t "ensureTypeSubCalendar"` | Wave 0 |
| `ensureTypeSubCalendar` creates sub-calendar with correct naming convention | unit | `npx jest src/services/gcalSubcalendars.test.ts -t "naming"` | Wave 0 |
| `syncCanvasEvents` routes to type sub-calendar when `typeGroupingEnabled=true` | unit | `npx jest src/services/gcalSync.test.ts -t "type routing"` | Wave 0 |
| `CanvasEvent.eventType` is populated by `parseCanvasFeed` | unit | `npx jest src/services/icalParser.test.ts -t "eventType"` | existing (needs extension) |

### Sampling Rate
- **Per task commit:** `npx jest src/services/eventTypeClassifier.test.ts --no-coverage`
- **Per wave merge:** `npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/services/eventTypeClassifier.test.ts` — unit tests for `classifyEventType` (new file, new service)
- [ ] `src/services/gcalSubcalendars.test.ts` — does not exist yet; covers `ensureTypeSubCalendar`
- [ ] Extend `src/services/gcalSync.test.ts` — add cases for type-routing branch
- [ ] Drizzle migration: `npx drizzle-kit generate && npx drizzle-kit migrate` — required before any sync test with real DB

---

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/services/gcalSubcalendars.ts` — DB-first sub-calendar creation pattern (direct read)
- Existing codebase: `src/services/gcalSync.ts` — bulk dedup and routing logic (direct read)
- Existing codebase: `src/lib/db/schema.ts` — current table structure and extension points (direct read)
- Existing codebase: `src/services/titleCleanup.ts` — Canvas SUMMARY prefix patterns used for cleanup (direct read)
- Existing codebase: `src/services/icalParser.ts` — `CanvasEvent` interface and parsing pipeline (direct read)

### Secondary (MEDIUM confidence)
- Canvas LMS open source: `canvas-lms/app/models/calendar_event.rb` — confirmed Canvas ICS does NOT include a CATEGORIES or type field; type must be inferred from SUMMARY. Fetched 2026-03-15.
- [Canvas Calendar Events API](https://canvas.instructure.com/doc/api/calendar_events.html) — canonical reference for Canvas event structure
- [Google Calendar API Quota Guide](https://developers.google.com/workspace/calendar/api/guides/quota) — confirmed no documented hard limit on sub-calendars per user account

### Tertiary (LOW confidence)
- Community observation: Canvas SUMMARY format uses "Submit Assignment:", "Quiz:", "Discussion:" prefixes as standard templates — consistent with the existing `regexCleanTitle` patterns in `titleCleanup.ts` but no official specification document found

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use, verified from package.json and source
- Architecture: HIGH — DB-first pattern, bulk dedup, and sub-calendar creation are all direct extensions of existing verified code
- Canvas type classification: MEDIUM — prefix patterns inferred from existing titleCleanup logic and Canvas source inspection; no official ICS field spec for type exists
- Pitfalls: HIGH — dedup re-routing risk and sub-calendar explosion are verifiable from reading gcalSync.ts directly

**Research date:** 2026-03-15
**Valid until:** 2026-09-15 (stable stack; Canvas ICS format rarely changes; Google Calendar API v3 is stable)
