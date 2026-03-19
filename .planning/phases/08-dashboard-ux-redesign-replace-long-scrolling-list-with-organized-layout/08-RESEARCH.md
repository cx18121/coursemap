# Phase 8: Dashboard UX Redesign - Research

**Researched:** 2026-03-19
**Domain:** React component architecture, Tailwind CSS layout patterns, slide-in drawer UX
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Dashboard structure**
- Two-tab layout: **Overview** and **Courses**
- Overview tab: countdown deadlines (primary focus), three stat cards, sync button inline
- Courses tab: canvas course card grid + school calendars list
- Default tab on load: **Overview** — always resets to Overview on page load (no localStorage persistence)
- Tab UI: standard tab strip near the top of the dashboard content area

**Course list display**
- Replace per-course accordion list with a **compact card grid** (2 columns)
- Each card shows: color swatch, course name, enabled/disabled toggle, event count (e.g., "35 events")
- Clicking a card opens a **slide-in drawer** from the right with the full course detail: individual event list, type grouping checkboxes, color picker
- School calendars remain as a list section below the course card grid within the Courses tab

**Status panels (Overview tab)**
- Three **side-by-side mini stat cards** in a row: Deadlines · Synced · Conflicts
- Each card shows a count/summary number at a glance
- Clicking a stat card **expands a detail section below the card row** — only one expanded at a time
- The expanded detail area shows the existing panel content (deadline list, dedupe breakdown, conflict list)

**Information hierarchy**
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

Phase 8 is a pure UI reorganization: no new data, no new APIs, no schema changes. Every existing component (CountdownPanel, DedupePanel, ConflictPanel, CourseAccordion, SchoolCalendarList, SyncButton, SyncSummary) continues to exist and owns its own internal logic. The work is entirely in `SyncDashboard.tsx`, which needs three new architectural pieces: a tab-strip system, a stat-card expand/collapse system, and a slide-in drawer.

All state management remains in `SyncDashboard.tsx` as local `useState`. The new state additions are minimal: `activeTab` ('overview' | 'courses'), `expandedPanel` (null | 'countdown' | 'dedupe' | 'conflicts'), and `openCourseDrawer` (string | null for course name). The drawer requires `createPortal` (same pattern as `ColorPicker`) to escape the `backdrop-blur-lg` stacking context. SyncButton and SyncSummary change from fixed-position to inline rendering — the component JSX changes but props are unchanged.

The primary technical risk is the drawer z-index / stacking context. The project already has an established solution: `createPortal` to `document.body` with `position: fixed`. Apply the same pattern to the course drawer. The secondary risk is inadvertently breaking existing functionality (toggles, color picker, event exclusions) when CourseAccordion content moves into the drawer — none of those props or handlers change.

**Primary recommendation:** Refactor `SyncDashboard.tsx` render section into tabbed layout with three new local state vars; extract `SyncButton`/`SyncSummary` to inline wrappers; build a new `CourseDrawer` component (portal-based) that wraps the existing `CourseAccordion` body content; build a `StatCard` component for the three summary cards with expand-below behavior.

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.3 | Component rendering, hooks, portal | Already used throughout |
| Tailwind CSS | ^4 | All styling — glassmorphic utility classes | Established project pattern |
| TypeScript | ^5 | Type safety on new props/state | Project standard |
| Next.js App Router | 16.1.6 | Page/component rendering framework | Project standard |

### No new dependencies required

This phase is entirely UI composition. No animation library, no headless UI, no portal library — all needed primitives exist in React and Tailwind.

**Tailwind v4 note:** Project uses Tailwind v4 with `@import "tailwindcss"` (no `tailwind.config.js`). The `@theme` block in `globals.css` defines all CSS variables. Adding new utility classes is zero-config — just write them inline as Tailwind classes.

---

## Architecture Patterns

### New Component File Map

```
src/components/
├── SyncDashboard.tsx          # Refactored: tab state, drawer state, inline sync
├── StatCard.tsx               # NEW: mini summary card + expand/collapse
├── CourseDrawer.tsx           # NEW: slide-in drawer wrapping CourseAccordion content
├── CourseCard.tsx             # NEW: compact card for the 2-col grid
├── CountdownPanel.tsx         # Unchanged
├── DedupePanel.tsx            # Unchanged
├── ConflictPanel.tsx          # Unchanged
├── CourseAccordion.tsx        # Unchanged (content reused in drawer)
├── SchoolCalendarList.tsx     # Unchanged
├── SyncButton.tsx             # Unchanged props; caller changes from fixed to inline
├── SyncSummary.tsx            # Unchanged props; caller changes from fixed to inline
└── ColorPicker.tsx            # Unchanged
```

### Pattern 1: Tab Strip with Active Indicator

**What:** Two tabs near the top of the dashboard content area. Local state in `SyncDashboard`.
**When to use:** Always — `activeTab` controls which content block renders.

```typescript
// State in SyncDashboard
const [activeTab, setActiveTab] = useState<'overview' | 'courses'>('overview');

// Tab strip — underline or pill style consistent with glassmorphic aesthetic
// Example: underline variant
<div className="flex gap-1 border-b border-[--color-border]">
  {(['overview', 'courses'] as const).map((tab) => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
        activeTab === tab
          ? 'text-[--color-text-primary] border-b-2 border-indigo-400 -mb-px'
          : 'text-[--color-text-secondary] hover:text-[--color-text-primary]'
      }`}
    >
      {tab === 'overview' ? 'Overview' : 'Courses'}
    </button>
  ))}
</div>

{/* Conditional render — no animation needed */}
{activeTab === 'overview' && <OverviewTabContent ... />}
{activeTab === 'courses' && <CoursesTabContent ... />}
```

**Note:** No tab state in localStorage — resets to 'overview' on every page load (locked decision).

### Pattern 2: Stat Card with Expand-Below

**What:** Three cards side-by-side. Only one expanded at a time. Expanded content renders in a full-width section below the card row.
**When to use:** Overview tab stat cards — Deadlines, Synced, Conflicts.

```typescript
// State in SyncDashboard (or Overview wrapper)
const [expandedPanel, setExpandedPanel] = useState<'countdown' | 'dedupe' | 'conflicts' | null>(null);

function handleStatCardClick(panel: 'countdown' | 'dedupe' | 'conflicts') {
  setExpandedPanel((prev) => (prev === panel ? null : panel));
}

// Stat card row
<div className="grid grid-cols-3 gap-3">
  <StatCard
    label="Deadlines"
    value={upcomingCount}
    active={expandedPanel === 'countdown'}
    onClick={() => handleStatCardClick('countdown')}
  />
  <StatCard
    label="Synced"
    value={dedupeTotal}
    active={expandedPanel === 'dedupe'}
    onClick={() => handleStatCardClick('dedupe')}
  />
  <StatCard
    label="Conflicts"
    value={conflictCount}
    active={expandedPanel === 'conflicts'}
    onClick={() => handleStatCardClick('conflicts')}
  />
</div>

{/* Expanded detail area — full width, below card row */}
{expandedPanel === 'countdown' && <CountdownPanel events={countdownEvents} />}
{expandedPanel === 'dedupe' && <DedupePanel />}
{expandedPanel === 'conflicts' && <ConflictPanel key={syncVersion} />}
```

**StatCard props:**
```typescript
interface StatCardProps {
  label: string;
  value: number | string;   // the count/summary shown at a glance
  active: boolean;           // highlighted ring when this panel is expanded
  onClick: () => void;
}
```

**StatCard styling — glassmorphic + active state:**
```typescript
// base: bg-white/10 backdrop-blur-lg rounded-2xl border border-[--color-border]
// active: ring-1 ring-indigo-400/60  (or border-color changes)
// hover: bg-white/[0.15]
```

**Challenge: populating value before user expands.** DedupePanel and ConflictPanel currently lazy-fetch on expand. For the stat card summary numbers, two options:
1. Stat card shows "—" until user expands (simplest; lazy stays lazy)
2. SyncDashboard fetches `/api/sync/preview` and `/api/sync/conflicts` on mount for summary counts

Option 2 is better UX (numbers visible immediately). SyncDashboard already fetches on mount for other data; add two parallel fetches. The full detail content can still lazy-load inside the expanded panel — only the count is eagerly fetched.

### Pattern 3: Slide-In Course Drawer

**What:** Right-side panel that slides in when a course card is clicked. Contains the CourseAccordion detail content (event type checkboxes, individual event list, color picker).
**Portal required:** `backdrop-blur-lg` creates a stacking context — same problem as ColorPicker. Use `createPortal(content, document.body)`.

```typescript
// State in SyncDashboard
const [openCourseDrawer, setOpenCourseDrawer] = useState<string | null>(null); // courseName

// Pass down or inline in CourseCard click handler
<CourseCard
  key={course.courseName}
  course={course}
  onClick={() => setOpenCourseDrawer(course.courseName)}
/>

// Drawer (rendered at bottom of SyncDashboard return, outside tab content)
{openCourseDrawer && (() => {
  const course = courses.find((c) => c.courseName === openCourseDrawer);
  if (!course) return null;
  return (
    <CourseDrawer
      course={course}
      courseTypeSettings={derivedCourseTypeSettings.filter(
        (s) => s.courseName === openCourseDrawer
      )}
      onClose={() => setOpenCourseDrawer(null)}
      onToggleCourse={handleToggleCourse}
      onToggleEvent={handleToggleEvent}
      onChangeColor={handleChangeColor}
      onToggleEventType={handleToggleEventType}
      onChangeEventTypeColor={handleChangeEventTypeColor}
    />
  );
})()}
```

**CourseDrawer implementation pattern:**
```typescript
// src/components/CourseDrawer.tsx
'use client';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function CourseDrawer({ course, onClose, ... }) {
  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      {/* Drawer panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md z-50
                      bg-[--color-surface] border-l border-[--color-border]
                      overflow-y-auto shadow-2xl
                      animate-in slide-in-from-right-full duration-200">
        {/* Close button */}
        <div className="flex items-center justify-between p-4 border-b border-[--color-border]">
          <span className="text-sm font-semibold text-[--color-text-primary]">
            {course.courseName}
          </span>
          <button onClick={onClose} aria-label="Close drawer">
            {/* X icon */}
          </button>
        </div>
        {/* CourseAccordion content — reuse existing component */}
        <div className="p-4">
          <CourseAccordion
            courseName={course.courseName}
            colorId={course.colorId}
            enabled={course.enabled}
            events={course.events}
            courseTypeSettings={...}
            onToggleCourse={...}
            ...
          />
        </div>
      </div>
    </>,
    document.body
  );
}
```

**Tailwind v4 note:** `animate-in slide-in-from-right-full` uses the built-in `tailwindcss-animate` style classes. These work in Tailwind v4 via the same `@import "tailwindcss"` mechanism. If `slide-in-from-right-full` is not available, fallback to a CSS transition approach (translate-x with transition).

### Pattern 4: CourseCard (2-col grid item)

**What:** Compact card replacing accordion header row. Shows color swatch, course name, toggle, event count.

```typescript
interface CourseCardProps {
  courseName: string;
  colorId: string;
  enabled: boolean;
  eventCount: number;
  onClick: () => void;
  onToggle: (courseName: string, enabled: boolean) => void;
}

// Card layout
<div
  onClick={onClick}
  className="bg-white/10 backdrop-blur-lg rounded-2xl border border-[--color-border]
             p-4 cursor-pointer hover:bg-white/[0.15] transition-colors space-y-3"
>
  {/* Top row: color swatch + toggle */}
  <div className="flex items-center justify-between">
    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: colorHex }} />
    <input
      type="checkbox"
      checked={enabled}
      onChange={(e) => { e.stopPropagation(); onToggle(courseName, e.target.checked); }}
      onClick={(e) => e.stopPropagation()}
      className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
    />
  </div>
  {/* Course name */}
  <p className="text-sm font-medium text-[--color-text-primary] line-clamp-2">
    {courseName}
  </p>
  {/* Event count */}
  <p className="text-xs text-[--color-text-secondary]">{eventCount} events</p>
</div>
```

**Grid:**
```typescript
<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
  {courses.map((course) => (
    <CourseCard key={course.courseName} ... />
  ))}
</div>
```

### Pattern 5: Inline SyncButton

**What:** SyncButton currently renders with `position: fixed` at the bottom. In the new design, it's inline in the Overview tab below stat cards.

**Change:** SyncButton's own JSX uses `fixed bottom-0 left-0 right-0`. Two options:
1. Add a prop `variant: 'fixed' | 'inline'` to SyncButton
2. Create a thin inline wrapper in SyncDashboard that replaces the fixed SyncButton

Option 2 is simpler — pass all the same props to SyncButton but wrap it differently:

```typescript
// Instead of <SyncButton ... /> which renders fixed bottom bar,
// wrap it so the outer container is not fixed:
<div className="rounded-2xl overflow-hidden">
  <SyncButton ... />
</div>
```

This won't work because SyncButton's own JSX hardcodes `fixed bottom-0`. The cleanest approach is adding an `inline` prop to SyncButton that switches the outer div from `fixed bottom-0 left-0 right-0` to normal flow. Alternatively, extract the button/progress content into a sub-component and render it without the fixed wrapper.

**Recommendation:** Add `inline?: boolean` prop to SyncButton. When `inline === true`, render a `<div className="rounded-xl overflow-hidden border border-[--color-border] bg-white/5 p-4">` instead of the fixed bar. SyncSummary gets the same treatment with an `inline?: boolean` prop.

### Anti-Patterns to Avoid

- **Recreating existing panel internals in stat cards:** The stat card just shows a count. The panel content renders unchanged below the card row. Do not redesign CountdownPanel/DedupePanel/ConflictPanel internals.
- **Moving state out of SyncDashboard:** The CONTEXT.md explicitly says keep state here. No Zustand, no Context, no prop-drilling workarounds.
- **Animating tab content:** Tab switching should be instantaneous (conditional render). Animating the tab content area creates layout jank with variable-height content.
- **Rendering CourseDrawer inside a card:** Always portal to `document.body`. Never render the drawer inside the card grid wrapper — `backdrop-blur-lg` stacking contexts will clip it.
- **localStorage for tab state:** Explicitly locked out. Do not persist active tab.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Portal z-index escape | Custom stacking context hack | `createPortal(content, document.body)` | Already used in `ColorPicker`; proven pattern for this project |
| Drawer slide animation | Custom keyframe CSS | Tailwind's `animate-in slide-in-from-right-full` or CSS transition on `translate-x` | One utility class |
| Click-outside detection | Custom global click tracker | Standard `mousedown` listener pattern (already used in ColorPicker) | Same pattern applies to drawer backdrop |
| Escape key dismiss | Custom key map | Single `keydown` useEffect (same as ColorPicker pattern) | Straightforward |
| Stat card count fetching | New custom hook | Parallel `fetch` calls inside existing `loadData` in `useEffect` | Already established pattern in SyncDashboard |

**Key insight:** Every mechanism needed for this phase already exists in the codebase. The drawer is a larger ColorPicker. The stat cards are smaller accordion headers. The tab system is a simple conditional render.

---

## Common Pitfalls

### Pitfall 1: backdrop-blur-lg Stacking Context Clips Drawer

**What goes wrong:** CourseDrawer rendered inside `<div className="bg-white/10 backdrop-blur-lg ...">` will be clipped to that ancestor's bounds. Drawer appears under the card grid or doesn't show on top of the page.
**Why it happens:** `backdrop-filter` creates a new stacking context in all browsers. Fixed/absolute children cannot escape it visually.
**How to avoid:** Always render CourseDrawer via `createPortal(drawer, document.body)`. The portal must be rendered unconditionally (not inside a backdrop-blur ancestor) — pull it to the bottom of SyncDashboard's return, outside all tab content wrappers.
**Warning signs:** Drawer appears clipped, truncated, or behind other elements.

### Pitfall 2: SyncButton Fixed Positioning Persists After Refactor

**What goes wrong:** If SyncButton's `fixed bottom-0` CSS is left in place, it overlaps the inline Overview tab content even after the `position:fixed` wrapper is no longer intended.
**Why it happens:** The `fixed` class is in SyncButton's own JSX, not the caller.
**How to avoid:** Add `inline?: boolean` prop to SyncButton. When inline, replace the fixed wrapper div with an unstyled flow div. Ensure the old `pb-32` padding on the outer container (which compensated for the fixed bar) is removed from SyncDashboard.
**Warning signs:** Blank space at bottom of page, button overlapping content.

### Pitfall 3: DedupePanel / ConflictPanel Lazy Fetch Hides Stat Card Counts

**What goes wrong:** Stat cards show "—" or 0 forever because DedupePanel and ConflictPanel only fetch when expanded. The count displayed in the closed stat card will always be stale.
**Why it happens:** These components own their own data fetching state. They don't surface their counts as props.
**How to avoid:** SyncDashboard eagerly fetches summary counts from `/api/sync/preview` and `/api/sync/conflicts` on mount (just the count numbers). Pass counts down to StatCard as props. The panels' internal data fetching remains unchanged — they do a full fetch when expanded.
**Warning signs:** Stat card always shows "0" or "—" even when there is data.

### Pitfall 4: key={syncVersion} on ConflictPanel Must Be Preserved

**What goes wrong:** Moving ConflictPanel to the expanded-below area without preserving `key={syncVersion}` causes stale conflict data to persist after a sync completes.
**Why it happens:** Without the key, React does not remount ConflictPanel; the component caches its `data` state from before the sync.
**How to avoid:** Wherever ConflictPanel is rendered in the new layout, keep `key={syncVersion}`. This is documented in STATE.md.
**Warning signs:** Conflicts list doesn't refresh after clicking Sync Now.

### Pitfall 5: Course Drawer Open While Tab Changes

**What goes wrong:** User opens course drawer on Courses tab, then switches to Overview tab. Drawer stays open on top of Overview content.
**Why it happens:** `openCourseDrawer` state is independent of `activeTab` state.
**How to avoid:** When `setActiveTab` is called, also call `setOpenCourseDrawer(null)`. Or conditionally render the drawer only when `activeTab === 'courses'`.

### Pitfall 6: Tailwind v4 animate-in Availability

**What goes wrong:** `animate-in slide-in-from-right-full` classes are from `tailwindcss-animate` plugin. In Tailwind v4, the plugin model changed. If these classes are not available, the drawer appears without animation.
**Why it happens:** `tailwindcss-animate` may not be installed or configured.
**How to avoid:** Check if `animate-in` is already used in the codebase. If not, use a CSS transition on `transform: translateX`. Safe fallback:
```css
/* In component */
className="translate-x-0 transition-transform duration-200"
/* Initially: translate-x-full, then set to translate-x-0 on mount */
```
**Warning signs:** `animate-in` class has no effect; drawer appears instantaneously.

---

## Code Examples

Verified patterns from existing source:

### createPortal (from ColorPicker.tsx)
```typescript
// Source: src/components/ColorPicker.tsx
import { createPortal } from 'react-dom';

return createPortal(
  <div
    ref={popoverRef}
    style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
    className="bg-[--color-surface] border border-[--color-border] rounded-xl shadow-xl p-2 w-44"
  >
    {/* content */}
  </div>,
  document.body
);
```

### Click-outside detection (from ColorPicker.tsx)
```typescript
// Source: src/components/ColorPicker.tsx
useEffect(() => {
  function handleClickOutside(e: MouseEvent) {
    if (
      popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
      anchorRef.current && !anchorRef.current.contains(e.target as Node)
    ) {
      onClose();
    }
  }
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, [onClose, anchorRef]);
```

### Glassmorphic card (project standard)
```typescript
// Source: SyncDashboard.tsx, CourseAccordion.tsx, SchoolCalendarList.tsx
className="bg-white/10 backdrop-blur-lg rounded-2xl border border-[--color-border]"

// Lower opacity variant (panels):
className="bg-white/[0.04] backdrop-blur-lg rounded-2xl border border-[--color-border]"
```

### Optimistic toggle (from SyncDashboard.tsx)
```typescript
// Source: src/components/SyncDashboard.tsx handleToggleCourse
const handleToggleCourse = useCallback(async (courseName: string, enabled: boolean) => {
  setCourses((prev) =>
    prev.map((c) => c.courseName === courseName ? { ...c, enabled } : c)
  );
  clearSummary();
  await fetch('/api/user-selections', { method: 'PUT', ... }).catch(console.error);
}, []);
```

### Parallel fetch on mount (from SyncDashboard.tsx)
```typescript
// Source: src/components/SyncDashboard.tsx loadData
const promises: Promise<void>[] = [];
if (hasCanvasUrl) {
  promises.push(
    fetch('/api/parse-ics').then((r) => r.json()).then((data) => { ... })
  );
}
// Add new count fetches here in the same pattern
await Promise.all(promises);
```

### CSS variable usage (from globals.css)
```css
/* Source: src/app/globals.css */
--color-surface: #18181b;
--color-border: rgba(255, 255, 255, 0.06);
--color-text-primary: #fafaf9;
--color-text-secondary: rgba(250, 250, 249, 0.55);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fixed-bottom SyncButton | Inline SyncButton in Overview tab | Phase 8 | Remove `pb-32` on outer container |
| Fixed-position SyncSummary overlay | Inline SyncSummary below SyncButton | Phase 8 | Remove `fixed bottom-24 left-0 right-0` wrapper |
| All panels stacked vertically | Stat card row + expand-below | Phase 8 | CountdownPanel becomes expandable section |
| Per-course accordion list | 2-col CourseCard grid + slide-in drawer | Phase 8 | CourseAccordion content moves into drawer |

**Deprecated in this phase:**
- `pb-32` bottom padding on `SyncDashboard`'s outer `<div>` — was compensating for fixed sync button. Remove it.
- Fixed SyncButton bottom bar styling — replaced by inline variant.
- Fixed SyncSummary portal — replaced by inline rendering near sync button.

---

## Open Questions

1. **animate-in availability in Tailwind v4**
   - What we know: Project uses Tailwind v4 (`^4`), which changed the plugin model. `tailwindcss-animate` was the source of `animate-in` in v3.
   - What's unclear: Whether `animate-in slide-in-from-right-full` works out of the box in this project's Tailwind v4 setup.
   - Recommendation: Implementer should check whether `animate-in` is used anywhere in the codebase before using it for the drawer. If not present, use a `translate-x` CSS transition instead (always works).

2. **Stat card count for Deadlines**
   - What we know: `countdownEvents` is already computed in SyncDashboard (a `useMemo` over courses). The count of upcoming events is derivable from this array using `getBucket`.
   - What's unclear: Whether to compute this inline in the render or in the existing `countdownEvents` useMemo.
   - Recommendation: Add a `upcomingDeadlineCount` derived value from `countdownEvents` — count events where `getBucket(new Date(e.end || e.start))` is not null. No new fetch needed.

3. **CourseAccordion in drawer: expanded by default?**
   - What we know: `CourseAccordion` has its own `expanded` state starting `false`. When used in a drawer, the user has already "opened" the course by clicking the card.
   - What's unclear: The CONTEXT.md doesn't specify whether the accordion inside the drawer starts expanded.
   - Recommendation: Either pass an `initialExpanded` prop to `CourseAccordion`, or use the existing content directly by inlining the expanded section (since the drawer is already the "expanded" state). The simplest approach: render the drawer with the full event list directly rather than wrapping in an accordion — the drawer IS the expansion.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest ^30.3.0 + ts-jest ^29.4.6 |
| Config file | `jest.config.js` (root) |
| Quick run command | `npx jest --testPathPattern="CourseCard\|StatCard\|CourseDrawer" --no-coverage` |
| Full suite command | `npx jest --no-coverage` |

**Environment note:** `testEnvironment: 'jest-environment-node'` (not jsdom). The project uses pure-function / logic tests for components, NOT full React render tests, because jsdom 26 hangs on Node 22/WSL. This is a documented project decision. New component tests must follow this pattern.

### Phase Requirements → Test Map

Phase 8 has no formal requirement IDs (UI-only refactor of existing v1/v1.1 features). Testing focus is regression prevention on existing behavior.

| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| Tab state defaults to 'overview' on mount | unit (logic) | `npx jest --testPathPattern="SyncDashboard" --no-coverage` | Partial — existing SyncDashboard.test.tsx tests localStorage logic, not tab state |
| StatCard expand/collapse — only one expanded at a time | unit (logic) | `npx jest --testPathPattern="StatCard" --no-coverage` | ❌ Wave 0 |
| CourseCard toggle does not open drawer | unit (logic) | `npx jest --testPathPattern="CourseCard" --no-coverage` | ❌ Wave 0 |
| Drawer closes on Escape key | unit (logic) | `npx jest --testPathPattern="CourseDrawer" --no-coverage` | ❌ Wave 0 |
| key={syncVersion} preserved on ConflictPanel | manual smoke | visual inspection | N/A |
| SyncButton inline variant renders without fixed CSS | unit (logic) | `npx jest --testPathPattern="SyncButton" --no-coverage` | ❌ Wave 0 |
| CountdownPanel getBucket logic unchanged | unit | `npx jest --testPathPattern="CountdownPanel" --no-coverage` | ✅ existing |

### Sampling Rate
- **Per task commit:** `npx jest --testPathPattern="CountdownPanel\|SyncDashboard" --no-coverage`
- **Per wave merge:** `npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/__tests__/StatCard.test.tsx` — expand/collapse exclusive state logic
- [ ] `src/components/__tests__/CourseCard.test.tsx` — toggle propagation, click-to-open callback
- [ ] `src/components/__tests__/CourseDrawer.test.tsx` — Escape key handler, close on backdrop click
- [ ] `src/components/__tests__/SyncButton.test.tsx` — inline vs fixed variant prop

These test files test pure logic/callbacks, not React rendering (consistent with project's node environment constraint).

---

## Sources

### Primary (HIGH confidence)
- Direct code reads: `src/components/SyncDashboard.tsx`, `ColorPicker.tsx`, `CourseAccordion.tsx`, `SyncButton.tsx`, `SyncSummary.tsx`, `CountdownPanel.tsx`, `DedupePanel.tsx`, `ConflictPanel.tsx`, `SchoolCalendarList.tsx`
- `src/app/globals.css` — CSS variable definitions verified
- `.planning/phases/08-.../08-CONTEXT.md` — locked decisions read verbatim
- `package.json` — exact versions verified (React 19.2.3, Next 16.1.6, Tailwind ^4, Jest ^30.3.0)
- `jest.config.js` — test environment (node, not jsdom) confirmed

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` accumulated context — `key={syncVersion}` pattern, `createPortal` rationale, jsdom/WSL constraint — all verified against source files

### Tertiary (LOW confidence)
- Tailwind v4 `animate-in` availability — not verified in codebase; flagged as Open Question

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages read from package.json directly
- Architecture: HIGH — patterns derived from existing source code, no speculation
- Pitfalls: HIGH — stacking context pitfall proven by existing ColorPicker solution; other pitfalls traceable to specific source code behaviors
- Test patterns: HIGH — test environment constraint confirmed in jest.config.js and STATE.md

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable UI refactor domain; no external API changes)
