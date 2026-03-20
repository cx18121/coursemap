# Phase 9: Dashboard Layout Overhaul — Horizontal Single-Page — Research

**Researched:** 2026-03-20
**Domain:** React / Next.js 16 frontend layout refactor — horizontal two-column dashboard, inline course expand, tab removal
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **No tabs** — Overview and Courses content merged onto a single page
- **Two-column horizontal layout** — left rail + right main area, or top strip + two-column body
- Left/narrower side: stat cards stacked vertically (Deadlines, Synced, Conflicts) — each clickable to expand detail inline or in-place
- Right/main area: course list (compact rows or small cards)
- Sync button lives below the stat cards on the left rail or inline at the top of the page — not fixed at bottom
- CountdownPanel is NOT always-visible as a hero; the "Deadlines" stat card is the entry point, clicking expands it
- Course accordion **auto-opens** when the drawer opens — user should not have to click a second time to see content
- Drawer close: Escape key + close button — no backdrop click close (avoids accidental closes)
- Only one course can be expanded at a time
- Courses display as **compact rows** (~40-48px tall): color swatch, name, enabled toggle, event count in a single tight row
- Reduce all section spacing: `space-y-6` → `space-y-3` or `space-y-4` throughout
- Sync button and SyncSummary remain inline (from Phase 8), not fixed at bottom

### Claude's Discretion

- Exact column widths and breakpoints for the two-column layout
- Whether stat cards stack vertically in a left rail or form a horizontal strip at the top
- Drawer implementation (inline expand vs. push-aside vs. overlay with no backdrop) — pick the approach that avoids z-index/layering complaint
- Loading skeleton for compact course rows
- Scroll behavior (whether the two columns scroll independently or the page scrolls as one)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UX-01 | Dashboard uses a two-tab layout (Overview / Courses) with Overview as default tab | Phase 9 REPLACES this with a single-page horizontal layout — UX-01 is superseded |
| UX-02 | Overview tab shows countdown deadlines as primary hero with three summary stat cards that expand detail panels | Stat cards carry forward; CountdownPanel moved behind Deadlines card click |
| UX-03 | Courses tab displays courses as compact card grid | REPLACED: courses become compact single-line rows in right column, no tab |
| UX-04 | Clicking a course card opens a slide-in drawer with full course details | Course drawer redesigned: no backdrop, auto-open accordion, Escape+button only dismiss |
| UX-05 | Sync button and summary render inline in Overview tab instead of fixed at bottom | Carries forward from Phase 8 — sync button stays inline on left rail or top strip |

</phase_requirements>

---

## Summary

Phase 9 is a pure frontend layout transformation. All state management, API calls, and business logic from Phase 8 carry forward unchanged — only the render tree in `SyncDashboard.tsx` changes, plus a new compact row component replaces `CourseCard`, and `CourseDrawer` is redesigned to remove the backdrop and auto-open the accordion.

The core change is eliminating the two-tab structure in favor of a single scrolling page with a horizontal two-column layout. On desktop, the left rail (~280-320px) holds the three stat cards stacked vertically and the sync button below them. The right column (remaining width) holds the compact course list. Both columns share the same scroll context (the page scrolls as one unit — independent column scrolling creates UX problems on mobile and adds complexity for marginal gain).

The `CourseDrawer` needs two targeted fixes: (1) remove the black/dark backdrop overlay, and (2) pass an `initiallyExpanded` or equivalent prop to `CourseAccordion` so the accordion opens automatically when the drawer mounts. The drawer itself (portal, Escape key, close button) is otherwise kept as-is.

**Primary recommendation:** Refactor `SyncDashboard.tsx` render section to replace the tab structure with a single `flex gap-6` or CSS grid two-column layout. Replace `CourseCard` with a new `CourseRow` compact component. Modify `CourseAccordion` to accept a `defaultExpanded` prop. Strip the backdrop from `CourseDrawer`.

---

## Standard Stack

### Core (all already installed — no new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.3 | Component model, `useState`, `useMemo`, `useEffect` | Project baseline |
| Next.js | 16.1.6 | App Router, `'use client'` directive | Project baseline |
| Tailwind CSS | ^4 (`@import "tailwindcss"`) | All layout utilities — `grid`, `flex`, `gap-*`, `w-*`, column sizing | Project baseline |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-dom` `createPortal` | 19.2.3 | Keeps `CourseDrawer` (and `ColorPicker`) above stacking contexts | Required when parent has `backdrop-blur-lg` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS Grid two-column | Flexbox row | Grid is cleaner for named column sizing (e.g. `grid-cols-[280px_1fr]`); flexbox requires manual width + `flex-shrink-0` |
| Inline expand below row | Push-aside panel | Inline expand is simpler (no portal, no z-index) but makes the layout reflow on click, which is jarring for a long course list. Push-aside via fixed right panel with no backdrop is the better fit here. |
| Separate scroll contexts | Single page scroll | Single scroll wins on mobile and avoids `overflow-hidden` clipping issues inside glassmorphic containers |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended Project Structure (no change)

```
src/components/
├── SyncDashboard.tsx      # Primary refactor target — render section only
├── CourseRow.tsx          # NEW: replaces CourseCard for compact ~44px rows
├── CourseDrawer.tsx       # MODIFY: remove backdrop, add auto-open prop threading
├── CourseAccordion.tsx    # MODIFY: add defaultExpanded prop
├── StatCard.tsx           # REUSE as-is (may adjust padding)
├── SyncButton.tsx         # REUSE as-is (inline prop already exists)
└── SyncSummary.tsx        # REUSE as-is (inline prop already exists)
```

### Pattern 1: Tailwind 4 Two-Column Layout

**What:** CSS Grid with a fixed left rail and fluid right column.

**When to use:** Left column is content-narrow (stat cards ~260-320px); right column fills remaining space.

**Example:**
```tsx
// Tailwind 4 arbitrary grid-template-columns syntax
<div className="grid grid-cols-[280px_1fr] gap-6">
  {/* Left rail: stat cards + sync */}
  <aside className="flex flex-col gap-3">
    <StatCard ... />
    <StatCard ... />
    <StatCard ... />
    {/* Expanded panel — full width of left rail */}
    {expandedPanel && <PanelComponent />}
    <SyncButton inline ... />
  </aside>

  {/* Right column: compact course list */}
  <main className="flex flex-col gap-1">
    {courses.map(course => <CourseRow ... />)}
  </main>
</div>
```

**Tailwind 4 note:** Arbitrary values like `grid-cols-[280px_1fr]` work directly — no `safelist` or config needed. The project uses `@import "tailwindcss"` with no separate `tailwind.config.js`, so arbitrary values via bracket notation are the correct approach.

**Responsive collapse:** On mobile (`< sm`), the two-column grid collapses to a single column — use `grid-cols-1 sm:grid-cols-[260px_1fr]` or `lg:grid-cols-[280px_1fr]`. On narrow screens the stat cards appear above the course list (stacked), which is acceptable.

### Pattern 2: Compact Course Row

**What:** Replace the `CourseCard` card-grid widget with a single tight horizontal row (~44px). Each row: color swatch | course name (truncated) | event count badge | enabled toggle.

**When to use:** Information-dense list where the user scans vertically, not selects by card shape.

**Example:**
```tsx
// CourseRow.tsx — new component
export default function CourseRow({ courseName, colorId, enabled, eventCount, onClick, onToggle }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-3 h-11 rounded-xl cursor-pointer
                 hover:bg-white/[0.08] transition-colors border border-transparent
                 hover:border-[--color-border]"
    >
      {/* Color swatch */}
      <div className="w-3 h-3 rounded-full flex-shrink-0"
           style={{ backgroundColor: GOOGLE_CALENDAR_COLORS[colorId]?.hex ?? '#4285f4' }} />

      {/* Course name — truncated */}
      <span className="flex-1 text-sm text-[--color-text-primary] truncate min-w-0">
        {courseName}
      </span>

      {/* Event count */}
      <span className="text-xs text-[--color-text-secondary] flex-shrink-0">
        {eventCount}
      </span>

      {/* Toggle */}
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => { e.stopPropagation(); onToggle(courseName, e.target.checked); }}
        onClick={(e) => e.stopPropagation()}
        className="w-4 h-4 rounded accent-indigo-500 cursor-pointer flex-shrink-0"
      />
    </div>
  );
}
```

**Key:** `min-w-0` on the course name span is required — without it, `truncate` does not work inside flex containers (flex items do not shrink below their text content width by default).

### Pattern 3: CourseDrawer Without Backdrop

**What:** Remove the `bg-black/40` backdrop div from `CourseDrawer`. The drawer becomes a non-modal detail panel. Close only via Escape or close button (locked decision).

**Why:** The backdrop creates a "modal feel" with full-page dimming, which is the complaint. Without backdrop, the drawer panel (`z-50`, `fixed right-0`, `bg-[--color-surface]`) remains readable against the page content.

**Current CourseDrawer render:**
```tsx
// BEFORE (Phase 8)
return createPortal(
  <>
    <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />  // ← REMOVE THIS
    <div className="fixed top-0 right-0 h-full w-full max-w-md z-50 ...">
      ...
    </div>
  </>,
  document.body
);
```

```tsx
// AFTER (Phase 9)
return createPortal(
  <div className="fixed top-0 right-0 h-full w-full max-w-md z-50
                  bg-[--color-surface] border-l border-[--color-border]
                  overflow-y-auto shadow-2xl transition-transform duration-200">
    {/* header + CourseAccordion */}
  </div>,
  document.body
);
```

**Note:** Without a backdrop to click, the `onClick={onClose}` on the backdrop is removed. This is a locked decision — accidental close via backdrop click is explicitly prohibited.

### Pattern 4: CourseAccordion Auto-Open

**What:** Add a `defaultExpanded?: boolean` prop to `CourseAccordion`. Initialize `useState(false)` → `useState(defaultExpanded ?? false)`.

**Current code (CourseAccordion.tsx line 44):**
```typescript
const [expanded, setExpanded] = useState(false);
```

**Change:**
```typescript
interface CourseAccordionProps {
  // ... existing props ...
  defaultExpanded?: boolean;  // NEW
}

export default function CourseAccordion({ ..., defaultExpanded }: CourseAccordionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  // rest unchanged
}
```

**CourseDrawer.tsx** passes `defaultExpanded={true}` to `CourseAccordion`:
```tsx
<CourseAccordion
  {...allExistingProps}
  defaultExpanded={true}   // NEW — auto-open on drawer mount
/>
```

**Why `defaultExpanded` (not a controlled prop):** The accordion's internal expand/collapse behavior remains user-controlled after initial render. A controlled `isExpanded` prop would require the drawer to manage accordion state, which adds unnecessary coupling. `defaultExpanded` (uncontrolled initial value) is the React idiom for "start open, let user control after."

### Pattern 5: Expanded Panel in Left Rail

**What:** When a stat card is clicked, the expanded detail (CountdownPanel, DedupePanel, ConflictPanel) renders below the stat card stack in the left rail, not full-width below a card row (the Phase 8 pattern).

**Layout:**
```tsx
<aside className="flex flex-col gap-3">
  <div className="flex flex-col gap-3">
    <StatCard label="Deadlines" ... />
    <StatCard label="Synced" ... />
    <StatCard label="Conflicts" ... />
  </div>

  {/* Expanded panel — appears below the stat card stack */}
  {expandedPanel === 'countdown' && <CountdownPanel events={countdownEvents} />}
  {expandedPanel === 'dedupe' && <DedupePanel />}
  {expandedPanel === 'conflicts' && <ConflictPanel key={syncVersion} />}

  {/* Sync button always last in left rail */}
  <SyncButton inline ... />
  {(canvasSummary || mirrorSummary) && <SyncSummary inline ... />}
</aside>
```

**Implication:** When a panel expands, the left rail grows taller than the right column. Since both columns share a single scroll context and `align-items` defaults to `stretch`, use `items-start` on the grid container so columns do not stretch to match each other's height.

### Anti-Patterns to Avoid

- **Controlled `isExpanded` on CourseAccordion:** Coupling the accordion's open/close to the drawer's state — use `defaultExpanded` (uncontrolled initial value) instead.
- **Independent column scroll:** `overflow-y-auto` on each column creates scroll jails on mobile. Single page scroll is correct.
- **Removing `createPortal` from CourseDrawer:** The `backdrop-blur-lg` stacking context on glassmorphic cards traps `position: fixed` children. The portal stays even without a backdrop.
- **Using `grid-cols-2` for the two-column layout:** That gives exactly 50/50 split. The stat cards column needs a fixed width (~260-300px); the course list needs the remaining space. Use `grid-cols-[260px_1fr]` or similar.
- **Forgetting `min-w-0` on flex text children:** Causes truncation to silently fail. Any `truncate` on a flex child needs `min-w-0` on the same element.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS Grid column sizing | Custom flex hacks | Tailwind `grid-cols-[280px_1fr]` | Arbitrary value syntax works directly in Tailwind 4 |
| Portal z-index escape | Custom stacking context workaround | Keep existing `createPortal(content, document.body)` | Already solved in Phase 8; ColorPicker established the pattern |
| Accordion open state | External state manager | `defaultExpanded` prop + internal useState | React uncontrolled idiom — simpler, no prop drilling |
| Color swatch hex lookup | Duplicate color map | Import `GOOGLE_CALENDAR_COLORS` from `./ColorPicker` | Already exported; single source of truth |

---

## Common Pitfalls

### Pitfall 1: Tab State Removal Breaks Drawer State Shape

**What goes wrong:** `openCourseDrawer` state is currently only populated when the user is on the Courses tab. With no tabs, the drawer can be opened from the right column at any time, including while a stat card panel is expanded on the left. Both can be simultaneously visible — that is the intended behavior.

**Why it happens:** The Phase 8 `handleTabChange` function called `setOpenCourseDrawer(null)` on tab switch. That guard no longer exists.

**How to avoid:** Remove `handleTabChange` entirely. Remove `activeTab` state. `openCourseDrawer` remains open independently of which panels are expanded. Only the close button and Escape key close it.

**Warning signs:** If the drawer closes unexpectedly or cannot be opened while a stat panel is expanded, the tab-clearing logic was not fully removed.

### Pitfall 2: Truncation Fails for Long Course Names in Compact Rows

**What goes wrong:** Course name text does not truncate with ellipsis — it overflows or wraps the row to two lines.

**Why it happens:** `truncate` (which applies `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`) requires the element to have a bounded width. In a flex container, flex items by default have `min-width: auto` (sized to their content), so the text never actually overflows.

**How to avoid:** Add `min-w-0` to the course name span and ensure the span has `flex-1`. The combination `flex-1 min-w-0 truncate` is the standard fix.

**Warning signs:** Long course names wrap to two lines or push the toggle checkbox off-screen.

### Pitfall 3: Left Rail Stretched by Expanded Panels

**What goes wrong:** The right column (course list) stretches vertically to match the left rail height when a detail panel is expanded, leaving a large empty area below the last course row.

**Why it happens:** CSS Grid default `align-items: stretch` makes all cells fill the grid row height.

**How to avoid:** Add `items-start` to the grid container: `grid grid-cols-[280px_1fr] gap-6 items-start`. This makes each column height-independent.

**Warning signs:** The course list area shows blank space proportional to the expanded panel height.

### Pitfall 4: CourseAccordion defaultExpanded Not Respected on Re-open

**What goes wrong:** When the user closes the drawer and reopens a course, the accordion is collapsed even though `defaultExpanded={true}` was passed.

**Why it happens:** `useState(defaultExpanded ?? false)` only sets the initial state on mount. If the component is not unmounted and remounted between drawer openings, the state persists from the previous open/collapse interaction.

**How to avoid:** This is not a problem if `CourseDrawer` is conditionally rendered (`{openCourseDrawer && <CourseDrawer ... />}`). Each time the drawer opens (openCourseDrawer becomes non-null), a new `CourseDrawer` instance mounts, which mounts a new `CourseAccordion` with `defaultExpanded=true`. The current Phase 8 implementation already does conditional rendering — preserve this pattern.

**Warning signs:** If `CourseDrawer` is rendered always and hidden via CSS, `defaultExpanded` stops working after the first user interaction.

### Pitfall 5: Portal Drawer Not Closable Without Backdrop

**What goes wrong:** Without a backdrop, users cannot click outside the drawer to close it. The locked decision explicitly prohibits backdrop-click close — so this is intentional. BUT if the Escape key listener is not active, the drawer becomes unclosable without the X button.

**Why it happens:** If the `useEffect` keydown listener in `CourseDrawer` is accidentally removed during the backdrop removal.

**How to avoid:** When removing the backdrop `<div>`, do NOT touch the `useEffect` that registers the `keydown` listener. The Escape → `onClose()` path must remain intact.

**Warning signs:** Pressing Escape while the drawer is open does nothing.

---

## Code Examples

Verified patterns from existing codebase:

### Two-Column Grid Container (new — using Tailwind 4 arbitrary values)
```tsx
// Source: Tailwind 4 docs — @import "tailwindcss" supports arbitrary values
<div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
  <aside>...</aside>
  <main>...</main>
</div>
```

### Compact Course Row (new CourseRow.tsx)
```tsx
// Source: Project pattern from CourseAccordion header row, condensed
<div
  onClick={onClick}
  className="flex items-center gap-3 px-3 h-11 rounded-xl cursor-pointer
             hover:bg-white/[0.08] transition-colors"
>
  <div className="w-3 h-3 rounded-full flex-shrink-0"
       style={{ backgroundColor: GOOGLE_CALENDAR_COLORS[colorId]?.hex ?? '#4285f4' }} />
  <span className="flex-1 text-sm text-[--color-text-primary] truncate min-w-0">
    {courseName}
  </span>
  <span className="text-xs text-[--color-text-secondary] flex-shrink-0 tabular-nums">
    {eventCount}
  </span>
  <input
    type="checkbox"
    checked={enabled}
    onChange={(e) => { e.stopPropagation(); onToggle(courseName, e.target.checked); }}
    onClick={(e) => e.stopPropagation()}
    className="w-4 h-4 rounded accent-indigo-500 cursor-pointer flex-shrink-0"
  />
</div>
```

### CourseAccordion defaultExpanded prop change
```typescript
// Source: src/components/CourseAccordion.tsx line 44 — minimal change
// BEFORE:
const [expanded, setExpanded] = useState(false);

// AFTER (add defaultExpanded to props interface first):
const [expanded, setExpanded] = useState(defaultExpanded ?? false);
```

### Backdrop removal from CourseDrawer
```tsx
// Source: src/components/CourseDrawer.tsx — remove backdrop div, keep portal wrapper
return createPortal(
  <div className="fixed top-0 right-0 h-full w-full max-w-md z-50
                  bg-[--color-surface] border-l border-[--color-border]
                  overflow-y-auto shadow-2xl">
    {/* header and body unchanged */}
  </div>,
  document.body
);
```

### Stat cards stacked in left rail
```tsx
// Source: Phase 8 SyncDashboard.tsx — restructured from grid-cols-3 to flex-col
<div className="flex flex-col gap-3">
  <StatCard label="Deadlines" value={upcomingDeadlineCount}
    active={expandedPanel === 'countdown'}
    onClick={() => handleStatCardClick('countdown')} />
  <StatCard label="Synced" value={dedupeCount}
    active={expandedPanel === 'dedupe'}
    onClick={() => handleStatCardClick('dedupe')} />
  <StatCard label="Conflicts" value={conflictCount}
    active={expandedPanel === 'conflicts'}
    onClick={() => handleStatCardClick('conflicts')} />
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Two-tab layout (Overview / Courses) | Single-page horizontal layout | Phase 9 | Eliminates wasted tab-switch interaction; stat cards and course list visible simultaneously |
| CourseCard grid (2-3 cols, ~120px tall) | CourseRow compact list (~44px tall) | Phase 9 | ~3x more courses visible without scrolling |
| Stat cards as collapsed entry points + CountdownPanel hero always visible | Stat cards are the sole entry point; no always-visible panel | Phase 9 | Reduces page height significantly; CountdownPanel now behind Deadlines click |
| CourseDrawer with black backdrop overlay | CourseDrawer as no-backdrop detail panel | Phase 9 | Eliminates modal feel; page remains visible while viewing course detail |
| CourseAccordion always starts collapsed | CourseAccordion opens automatically when drawer mounts | Phase 9 | Removes extra click; course detail immediately visible |

**Deprecated/outdated after Phase 9:**
- `activeTab` state and `handleTabChange` function in `SyncDashboard` — removed entirely
- `CourseCard.tsx` component — replaced by `CourseRow.tsx` (keep file for now; remove import)
- Backdrop `<div className="fixed inset-0 bg-black/40 z-40">` in `CourseDrawer.tsx` — removed

---

## Open Questions

1. **Stat card padding in left rail vs. grid row**
   - What we know: `StatCard` currently uses `p-4` padding; in a narrow left rail (~280px) this is proportional
   - What's unclear: Whether `p-3` looks better in a stacked vertical layout vs. the current horizontal grid-row layout
   - Recommendation: Keep `p-4` as default; Claude's discretion to reduce to `p-3` if the rail feels heavy

2. **Max-width expansion for desktop**
   - What we know: Current container is `max-w-2xl` (672px). The CONTEXT says expand to `max-w-3xl` or `max-w-4xl` to use more horizontal space
   - What's unclear: The exact breakpoint at which the two-column layout activates (`lg:` at 1024px vs. `md:` at 768px)
   - Recommendation: Use `max-w-4xl` (896px) for the outer container; activate two-column at `md:` (768px) since that covers most laptop screens. Below `md`, single column (stat cards above course list).

3. **SchoolCalendarList placement**
   - What we know: In Phase 8 it was in the Courses tab below the course grid. With no tabs, it needs a home.
   - What's unclear: Should it appear below the compact course list in the right column, or below the entire two-column layout?
   - Recommendation: Place it below the compact course row list in the right column, separated by a section header. This keeps all "what to sync" configuration together.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | jest 30.x + ts-jest 29.x |
| Config file | `jest.config.js` |
| Quick run command | `npx jest --testPathPattern="CourseRow\|SyncDashboard" --passWithNoTests` |
| Full suite command | `npx jest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UX-01 | No tabs rendered — `activeTab` state removed | unit | `npx jest --testPathPattern="SyncDashboard" --passWithNoTests` | Existing (outdated) |
| UX-02 | Stat cards present; clicking expands detail below | unit | `npx jest --testPathPattern="StatCard" --passWithNoTests` | No test for StatCard — Wave 0 |
| UX-03 | Course rows ~44px tall, show color/name/count/toggle | unit | `npx jest --testPathPattern="CourseRow" --passWithNoTests` | ❌ Wave 0 |
| UX-04 | Drawer mounts; CourseAccordion starts expanded | unit | `npx jest --testPathPattern="CourseDrawer\|CourseAccordion" --passWithNoTests` | ❌ Wave 0 |
| UX-05 | Sync button renders inline (not fixed) | unit | `npx jest --testPathPattern="SyncButton" --passWithNoTests` | Existing (passWithNoTests) |

**Note on jsdom:** The project uses node test environment due to jsdom 26 hang on WSL/Node 22 (recorded in STATE.md). Tests must be written as pure function / behavior logic tests, not as full component render tests with jsdom. The existing `SyncDashboard.test.tsx` demonstrates the pattern (tests localStorage logic directly without rendering).

### Sampling Rate

- **Per task commit:** `npx jest --passWithNoTests --no-coverage 2>&1 | tail -5`
- **Per wave merge:** `npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/components/__tests__/CourseRow.test.tsx` — stubs for compact row render + stopPropagation on checkbox
- [ ] `src/components/__tests__/CourseAccordion.test.tsx` — stub for `defaultExpanded` prop behavior (logic test, no jsdom)

*(Existing jest infrastructure covers framework; only test stubs need to be created.)*

---

## Sources

### Primary (HIGH confidence)

- Direct read of `src/components/SyncDashboard.tsx` — full Phase 8 implementation, all state and render verified
- Direct read of `src/components/CourseDrawer.tsx` — backdrop structure confirmed
- Direct read of `src/components/CourseAccordion.tsx` — `useState(false)` on line 44 confirmed
- Direct read of `src/components/StatCard.tsx` — props interface and styling confirmed
- Direct read of `src/components/CourseCard.tsx` — current card structure confirmed
- Direct read of `src/app/globals.css` — CSS variables and Tailwind 4 `@import` confirmed
- Direct read of `package.json` — React 19.2.3, Next.js 16.1.6, Tailwind 4, jest 30
- Direct read of `.planning/phases/09-dashboard-layout-overhaul-horizontal-single-page/09-CONTEXT.md` — all decisions verified

### Secondary (MEDIUM confidence)

- Tailwind CSS 4 arbitrary value syntax (`grid-cols-[280px_1fr]`) — inferred from Tailwind 4's bracket notation pattern, consistent with project's existing use of arbitrary values like `bg-indigo-500/[0.04]`

### Tertiary (LOW confidence)

- None — all claims are backed by direct code inspection or established project patterns

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all packages confirmed from package.json; no new dependencies
- Architecture: HIGH — patterns derived directly from existing Phase 8 code; no external research needed
- Pitfalls: HIGH — each pitfall is traceable to specific code behaviors observed in the codebase
- Validation: MEDIUM — test stubs are speculative until written; jsdom constraint confirmed from STATE.md

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable — no external dependencies changing)
