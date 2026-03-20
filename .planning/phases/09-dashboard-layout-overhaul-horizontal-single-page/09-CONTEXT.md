# Phase 9: Dashboard Layout Overhaul — Horizontal Single-Page Layout

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the two-tab (Overview / Courses) layout with a compact single-page horizontal dashboard. No new data capabilities — all existing functionality and components from Phase 8 are reorganized into a denser, more horizontal layout that eliminates wasted vertical space.

</domain>

<decisions>
## Implementation Decisions

### Layout structure
- **No tabs** — Overview and Courses content merged onto a single page
- **Two-column horizontal layout** — left rail + right main area, or a top strip + two-column body
- Left/narrower side: stat cards stacked vertically (Deadlines, Synced, Conflicts) — each clickable to expand detail inline or in-place
- Right/main area: course list (compact rows or small cards)
- Sync button lives below the stat cards on the left rail or inline at the top of the page — not fixed at bottom
- CountdownPanel is NOT always-visible as a hero; the "Deadlines" stat card is the entry point, clicking expands it

### Course drawer UX
- Course accordion (event list, toggles, color picker) **auto-opens** when the drawer opens — user should not have to click a second time to see content
- The drawer itself should be reconsidered: instead of a full right-side slide-in overlay (which wastes space and has z-index layering issues), consider an **inline expansion panel** below the course row, or a fixed right panel that does NOT overlap the main content but pushes it
- If a slide-in drawer is kept: it must not use a dark backdrop/overlay that obscures the rest of the page. It should feel like a detail panel, not a modal. The backdrop issue is a known complaint.
- Drawer close: Escape key + close button — no backdrop click close (avoids accidental closes)
- Only one course can be expanded at a time

### Information density
- Courses should display as **compact rows**, not large cards — show color swatch, name, enabled toggle, event count in a single tight row (~40-48px tall)
- Stat cards should be compact — number + label, minimal padding
- Reduce all section spacing: `space-y-6` → `space-y-3` or `space-y-4` throughout
- No section headers with large uppercase labels unless genuinely needed

### Whitespace
- Max content width: keep `max-w-2xl` or expand to `max-w-3xl` / `max-w-4xl` to use more horizontal space on desktop
- Padding: reduce `pt-12` top padding; the header + stat area should feel snug
- Avoid empty space between stat cards and course list — they should be adjacent, not separated by a gap

### Sync UX (no change)
- Sync button and SyncSummary remain inline (from Phase 8), not fixed at bottom
- Stat counts refresh after sync (from Phase 8)

### Claude's Discretion
- Exact column widths and breakpoints for the two-column layout
- Whether stat cards stack vertically in a left rail or form a horizontal strip at the top
- Drawer implementation (inline expand vs. push-aside vs. overlay with no backdrop) — pick the approach that avoids the z-index/layering complaint
- Loading skeleton for compact course rows
- Scroll behavior (whether the two columns scroll independently or the page scrolls as one)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 8 implementation (what exists and must be reorganized)
- `src/components/SyncDashboard.tsx` — Current Phase 8 dashboard with two-tab layout; Phase 9 refactors this
- `src/components/StatCard.tsx` — Stat card component built in Phase 8; reuse as-is or adapt
- `src/components/CourseCard.tsx` — Course card from Phase 8; REPLACE with compact row design
- `src/components/CourseDrawer.tsx` — Slide-in drawer from Phase 8; redesign to fix overlay layering
- `src/components/SyncButton.tsx` — Has inline prop from Phase 8; keep inline behavior
- `src/components/SyncSummary.tsx` — Has inline prop from Phase 8; keep inline behavior
- `src/components/CountdownPanel.tsx` — Existing panel; only shown when Deadlines stat card is expanded
- `src/components/DedupePanel.tsx` — Existing panel; only shown when Synced stat card is expanded
- `src/components/ConflictPanel.tsx` — Existing panel; only shown when Conflicts stat card is expanded
- `src/components/CourseAccordion.tsx` — Existing per-course accordion; used inside course drawer, should auto-open

### Phase 8 context (prior decisions that still apply)
- `.planning/phases/08-dashboard-ux-redesign-replace-long-scrolling-list-with-organized-layout/08-CONTEXT.md` — Prior design decisions; glassmorphic aesthetic, CSS variables, state management patterns all carry forward

No external specs — requirements are fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StatCard.tsx`: Compact stat display with active ring; keep and reuse — may need size/padding adjustment
- `CourseAccordion.tsx`: Full course detail component (events, toggles, color picker); wrap in drawer and auto-open it
- `SchoolCalendarList.tsx`: Existing list; include below course list in the single-page layout
- `SyncDashboard.tsx` state: All state management (courses, syncStatus, expandedPanel, etc.) carries forward unchanged — only the render section changes

### Established Patterns
- Glassmorphic cards: `bg-white/10 backdrop-blur-lg rounded-2xl border border-[--color-border]`
- CSS variables: `--color-text-primary`, `--color-text-secondary`, `--color-border`, `--color-surface`
- `createPortal` (used in ColorPicker and CourseDrawer): if drawer is replaced with inline expand, portal may no longer be needed
- Optimistic updates with silent revert on failure

### Integration Points
- `src/app/dashboard/page.tsx`: Props to `SyncDashboard` unchanged — no server component changes needed
- Tab state (`activeTab`) will be removed entirely from SyncDashboard
- Course drawer state (`openCourseDrawer`) may change shape if drawer is replaced with inline expand

</code_context>

<specifics>
## Specific Ideas

- "The layering of the drawers is weird" — the portal-based overlay feels like a modal, not a panel. Consider replacing with an inline expand below the selected course row, similar to GitHub's repo file preview or Linear's issue sidebar.
- "So much space wasted on both the overview page and the course page" — the two-tab design separated content that could coexist. Merging them into one scrollable page with a two-column layout should solve this.
- "Make the dashboard more horizontal than what it is now" — the stat cards column (left) + course list (right) pattern directly addresses this. Desktop users should see both sides simultaneously without scrolling.
- The course drawer auto-open is about reducing clicks: when a user taps a course, they want to see the events immediately, not see a collapsed accordion and have to click again.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 09-dashboard-layout-overhaul-horizontal-single-page*
*Context gathered: 2026-03-20*
