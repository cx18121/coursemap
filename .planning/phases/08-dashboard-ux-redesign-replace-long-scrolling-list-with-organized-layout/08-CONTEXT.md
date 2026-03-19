# Phase 8: Dashboard UX Redesign - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the long-scrolling dashboard layout (status panels → course accordions → school calendars stacked vertically) with a tab-based organized layout. The redesign covers visual structure, course display, and status panel presentation. No new data capabilities — all existing functionality (CountdownPanel, DedupePanel, ConflictPanel, CourseAccordion, SchoolCalendarList, SyncButton) is reorganized, not replaced.

</domain>

<decisions>
## Implementation Decisions

### Dashboard structure
- Two-tab layout: **Overview** and **Courses**
- Overview tab: countdown deadlines (primary focus), three stat cards, sync button inline
- Courses tab: canvas course card grid + school calendars list
- Default tab on load: **Overview** — always resets to Overview on page load (no localStorage persistence)
- Tab UI: standard tab strip near the top of the dashboard content area

### Course list display
- Replace per-course accordion list with a **compact card grid** (2 columns)
- Each card shows: color swatch, course name, enabled/disabled toggle, event count (e.g., "35 events")
- Clicking a card opens a **slide-in drawer** from the right with the full course detail: individual event list, type grouping checkboxes, color picker
- School calendars remain as a list section below the course card grid within the Courses tab

### Status panels (Overview tab)
- Three **side-by-side mini stat cards** in a row: Deadlines · Synced · Conflicts
- Each card shows a count/summary number at a glance
- Clicking a stat card **expands a detail section below the card row** — only one expanded at a time
- The expanded detail area shows the existing panel content (deadline list, dedupe breakdown, conflict list)

### Information hierarchy
- **Countdown deadlines** are the primary visual focus on the Overview tab — largest visual weight
- Sync button is **inline in the Overview tab**, not fixed at bottom of viewport
- Sync button lives **below the stat cards** — logical flow: see status → decide to sync
- Sync progress and summary are shown inline near the sync button (no fixed-position overlay)

### Claude's Discretion
- Exact number of grid columns at different breakpoints (2-col on mobile, potentially 3-col on wider)
- Drawer animation style (slide duration, backdrop)
- Loading skeleton design for the card grid
- Empty state for Overview when no Canvas URL is set
- Tab indicator style (underline, pill, etc.) — must be consistent with existing glassmorphic aesthetic

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing component structure
- `src/components/SyncDashboard.tsx` — Current monolithic dashboard; all state, handlers, and layout live here. The redesign refactors this.
- `src/components/CountdownPanel.tsx` — Existing countdown panel; content moves into stat card expand area
- `src/components/DedupePanel.tsx` — Existing dedupe panel; content moves into stat card expand area
- `src/components/ConflictPanel.tsx` — Existing conflict panel; content moves into stat card expand area
- `src/components/CourseAccordion.tsx` — Existing per-course accordion; content moves into slide-in drawer
- `src/components/SchoolCalendarList.tsx` — Existing school calendar list; moves to Courses tab
- `src/components/SyncButton.tsx` — Existing fixed sync button; becomes inline in Overview tab
- `src/components/SyncSummary.tsx` — Existing sync summary overlay; becomes inline near sync button

No external specs — requirements are fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SyncDashboard.tsx`: All state management (courses, syncStatus, syncProgress, syncVersion, lastSyncedAt, etc.) and all handlers live here — keep this as the parent, refactor only the render section
- `CountdownPanel`, `DedupePanel`, `ConflictPanel`: Drop-in components; just move them to the expanded stat card area
- `CourseAccordion`: Move its content to the slide-in drawer; the card grid is a new wrapping layer
- `SyncButton`: Currently renders at fixed bottom with progress bar; extract to inline variant
- `key={syncVersion}` on ConflictPanel: Keep this pattern — it forces remount on sync complete to clear cached data

### Established Patterns
- Glassmorphic cards: `bg-white/10 backdrop-blur-lg rounded-2xl border border-[--color-border]` — use for new cards and drawer
- CSS variables: `--color-text-primary`, `--color-text-secondary`, `--color-border`, `--color-surface`
- `createPortal` used in `ColorPicker` for z-index escape — drawer may need similar approach
- Client-side state: `useState`/`useCallback`/`useMemo` only; no global state management
- Optimistic updates with silent revert on failure (established in course/event toggles)

### Integration Points
- `src/app/dashboard/page.tsx`: Passes `userName`, `hasCanvasUrl`, `hasSchoolAccount`, `initialCourseTypeSettings` as props to `SyncDashboard` — no change needed here
- The tab state is new local state in `SyncDashboard` (or a new tab wrapper component)
- Drawer state (which course is open, if any) is new local state
- Which stat card is expanded is new local state (null | 'countdown' | 'dedupe' | 'conflicts')

</code_context>

<specifics>
## Specific Ideas

- Countdown deadlines should feel like the "hero" of the Overview tab — not just another card. Could be a larger section above the three stat cards.
- The three stat cards are summary/entry points; the expanded content below is where the existing panels live (no redesign of CountdownPanel/DedupePanel/ConflictPanel internals needed).
- Slide-in drawer for course details: right-side panel, partially overlaps the card grid, has a close button. Should feel like a settings/detail panel, not a modal.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 08-dashboard-ux-redesign-replace-long-scrolling-list-with-organized-layout*
*Context gathered: 2026-03-19*
