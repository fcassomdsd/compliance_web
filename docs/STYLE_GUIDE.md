# Compliance Web — UI Style Guide & Contributor Reference

This document defines the design tokens, component conventions, and layout patterns for the Compliance Web frontend. All contributors should follow these conventions to maintain visual consistency.

## Table of Contents

 1. [Design Tokens](#1-design-tokens)
 2. [Component Library](#2-component-library)
 3. [Layout Conventions](#3-layout-conventions)
 4. [Button System](#4-button-system)
 5. [Status Badges](#5-status-badges)
 6. [Loading States](#6-loading-states)
 7. [Responsive Breakpoints](#7-responsive-breakpoints)
 8. [Color Semantics](#8-color-semantics)
 9. [Quick Reference](#9-quick-reference)
10. [View-Specific Patterns](#10-view-specific-patterns)
11. [Date Smart Defaults](#11-date-smart-defaults)
12. [Inspection Status Lifecycle](#12-inspection-status-lifecycle)
13. [Internationalization (i18n)](#13-internationalization-i18n)

---

## 1. Design Tokens

All tokens are defined in `/style.css` under `:root`. Never use hardcoded hex values or raw pixel values in new code.

### Color Palette

```
Brand
  --color-primary-900   #0d2b45   Darkest blue (text on light)
  --color-primary-700   #214d72   Deep blue (headers, table headings)
  --color-primary-500   #1e88e5   Bright blue (buttons, accents)
  --color-primary-300   #90caf9   Pale blue (disabled buttons)
  --color-primary-100   #e3f2fd   Very light blue (backgrounds)
  --color-primary-50    #f5f9fd   Near-white blue

Neutral
  --color-gray-900      #212121   Body text
  --color-gray-700      #616161   Secondary text
  --color-gray-500      #9e9e9e   Muted text
  --color-gray-300      #cfd8dc   Borders
  --color-gray-100      #f5f5f5   Light backgrounds
  --color-white         #ffffff   Card backgrounds

Semantic
  --color-success-700   #2e7d32   Success text
  --color-success-500   #4caf50   Success button
  --color-success-100   #e8f5e9   Success background
  --color-warning-700   #e65100   Warning text
  --color-warning-500   #ff9800   Warning button
  --color-warning-100   #fff3e0   Warning background
  --color-error-700     #c62828   Error text
  --color-error-500     #d32f2f   Error button (danger)
  --color-error-100     #ffebee   Error background
  --color-info-700      #1565c0   Info text
  --color-info-500      #42a5f5   Info accents
  --color-info-100      #e3f2fd   Info background
```

**Legacy aliases** (deprecated, use new tokens): `--primary-color`, `--secondary-color`, `--light-blue`, `--text-dark`, `--text-light`, `--border-color`, `--shadow-color`.

### Spacing Scale (4px base)

```
--space-1    0.25rem   4px
--space-2    0.5rem    8px
--space-3    0.75rem   12px
--space-4    1rem      16px
--space-5    1.25rem   20px
--space-6    1.5rem    24px
--space-8    2rem      32px
--space-10   2.5rem    40px
--space-12   3rem      48px
```

**Rule**: Use `--space-*` for all padding, margin, and gap values. Never use raw `rem`/`px` for spacing.

### Border Radius

```
--radius-sm     4px     Inputs, small elements
--radius-md     8px     Buttons, cards, selects (default)
--radius-lg     12px    Data tables, larger cards
--radius-xl     16px    Modals
--radius-full   9999px  Pill shapes
```

### Typography

```
--text-xs      0.75rem   12px   Captions, helper text
--text-sm      0.85rem   14px   Secondary text, button labels, nav links
--text-base    1rem      16px   Body text
--text-lg      1.125rem  18px   Subtitles
--text-xl      1.25rem   20px   Section headings
--text-2xl     1.5rem    24px   Page headings
--text-3xl     1.875rem  30px   Hero titles

--leading-tight    1.25
--leading-normal   1.5    (default for body)
--leading-relaxed  1.625
```

### Shadows & Transitions

```
--shadow-sm     0 1px 3px   rgba(0,0,0,0.1)
--shadow-md     0 4px 8px   rgba(0,0,0,0.1)   (default for buttons/cards)
--shadow-lg     0 6px 12px  rgba(0,0,0,0.1)
--shadow-xl     0 10px 24px rgba(0,0,0,0.12)

--transition-fast    0.15s ease
--transition-normal  0.3s ease   (default)
--transition-slow    0.5s ease
```

---

## 2. Component Library

All reusable base components live in `src/components/base/`.

| Component | Path | Props | Usage |
|---|---|---|---|
| `BaseManager` | `base/BaseManager.vue` | `title: String` | Page layout wrapper. Shows page title with border. |
| `BaseButton` | `base/BaseButton.vue` | `variant`, `size`, `icon`, `loading`, `disabled`, `pill`, `block` | **Always use instead of raw `<button>`.** |
| `StatusBadge` | `base/StatusBadge.vue` | `status: String` | Colored status label. Handles null/empty gracefully. |
| `LoadingSpinner` | `base/LoadingSpinner.vue` | `visible: Boolean`, `text: String`, `size: String` (sm/md/lg), `fullscreen: Boolean` | **Always use instead of raw `<div class="loader">`.** |
| `SiteVisitHeader` | `inspection/SiteVisitHeader.vue` | `code`, `locationName`, `startDate`, `endDate`, `providerName` | Context header for per-provider inspection views. |

### Adding a New Base Component

1. Place in `src/components/base/` (generic) or `src/components/common/` (domain-specific)
2. Use `<script setup>` with TypeScript-style prop definitions
3. Use scoped `<style>` with design token variables
4. Never use hardcoded hex values or raw pixel units
5. Add to this document

---

## 3. Layout Conventions

### Input Forms

Use a **2-column CSS Grid with named areas**. This is the standard for all management views:

```vue
<div class="input-group">
  <div class="grid-cell1 grid-item">
    <label>Field 1</label>
    <input ... />
  </div>
  <div class="grid-cell2 grid-item">
    <label>Field 2</label>
    <input ... />
  </div>
  <div class="input-buttons">
    <BaseButton ... />
  </div>
</div>
```

```css
.input-group {
  display: grid;
  grid-template-areas: "grid-cell1 grid-cell2" "input-buttons input-buttons";
  gap: 1rem;
  grid-template-columns: 1fr 1fr;
}
.grid-cell1 { grid-area: grid-cell1; }
.grid-cell2 { grid-area: grid-cell2; }
.input-buttons { grid-area: input-buttons; justify-self: center; display: flex; gap: var(--space-2); }
```

### Rules

- **Every `.grid-cellN` in `grid-template-areas` MUST have a corresponding CSS `{ grid-area: grid-cellN; }` rule**
- **Every `.grid-cellN` in CSS MUST have a corresponding HTML element with that class**
- **Buttons row always spans full width**: `"input-buttons input-buttons"` (two columns)
- **Buttons are always centered**: `justify-self: center`
- **Single full-width field**: `"grid-cellN grid-cellN"` (spans both columns)
- **Every view must have a responsive breakpoint** at 768px that collapses to single column

### Multi-Dropdown Filters (ChecklistManager pattern)

For compact horizontal filter rows, use a dedicated CSS class:

```css
.checklist-filters {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--space-6);
}
```

### Responsive Breakpoints

```css
@media (max-width: 768px) {
  .input-group {
    grid-template-columns: 1fr;
    grid-template-areas: "grid-cell1" "grid-cell2" "grid-cell3" "grid-cell4" "input-buttons";
  }
}
```

---

## 4. Button System

**Always use `<BaseButton>` instead of raw `<button>` elements.**

### Variants

| Variant | Color | Use for |
|---|---|---|
| `primary` | Blue | Main actions (Save, Generate, Submit) |
| `secondary` | White + blue border | Toggle buttons (Services, Schedules) |
| `danger` | Red | Destructive actions (Delete, Inactivate, Logout) |
| `ghost` | Transparent + border | Icon buttons, table actions (Edit, View, Cancel) |
| `success` | Green | Positive actions (Select All, Approve) |
| `warning` | Orange | Caution actions (Clear All, Reset) |

### Sizes

| Size | Use for |
|---|---|
| `sm` | Table actions, icon buttons, inline buttons |
| `md` | Default form buttons |
| `lg` | Primary CTA buttons |

### Icon Buttons

```vue
<BaseButton variant="ghost" size="sm" :icon="editImg" alt="Edit" @click="..." />
```

### Text Buttons

```vue
<BaseButton variant="primary" @click="...">Save</BaseButton>
```

### Loading State

```vue
<BaseButton variant="primary" :loading="submitting" @click="...">Submit</BaseButton>
```

---

## 5. Status Badges

```vue
<StatusBadge :status="inspection.status" />
```

The component handles all 8 status values: `Created`, `Defined`, `Assigned`, `Planned`, `Uploaded`, `Reported`, `Complete`, `Inactive`. Empty/null shows "N/A" in gray.

**Never duplicate status badge CSS** — use the component.

---

## 6. Loading States

```vue
<!-- Inline spinner with text -->
<LoadingSpinner :visible="loading" text="Loading data..." />

<!-- Fullscreen overlay -->
<LoadingSpinner :visible="loading" fullscreen />

<!-- Small inline -->
<LoadingSpinner :visible="loading" size="sm" />

<!-- On buttons, use the built-in loading prop -->
<BaseButton :loading="saving" @click="...">Save</BaseButton>
```

**Never use `<div class="loader">` or inline `Loading...` text** — use the component.

---

## 7. Responsive Breakpoints

| Breakpoint | Target |
|---|---|
| `max-width: 1024px` | Navigation collapse (hamburger menu) |
| `max-width: 768px` | Form fields single-column, table font-size reduction |

Every `.input-group` using CSS Grid must have an `@media (max-width: 768px)` that collapses to single column.

---

## 8. Color Semantics

| Concept | Token | Visual |
|---|---|---|
| Page background | `--color-primary-100` (#e3f2fd) | Light blue |
| Card/table background | `--color-white` (#ffffff) | White |
| Body text | `--color-gray-900` (#212121) | Near black |
| Primary action | `--color-primary-500` (#1e88e5) | Bright blue |
| Success | `--color-success-500` (#4caf50) | Green |
| Warning | `--color-warning-500` (#ff9800) | Orange |
| Danger / Error | `--color-error-500` (#d32f2f) | Red |
| Borders | `--color-gray-300` (#cfd8dc) | Light gray |
| Disabled | `--color-primary-300` (#90caf9) | Pale blue |

---

## 9. Quick Reference

### Do

- Use design tokens for all colors, spacing, typography, borders, shadows
- Use `<BaseButton>`, `<StatusBadge>`, `<LoadingSpinner>` components
- Use 2-column CSS Grid with named areas for input forms
- Center action buttons in the form
- Add `@media (max-width: 768px)` single-column fallback to every `.input-group`
- Use `var(--space-*)` for all gap/padding/margin values

### Don't

- Don't use hardcoded hex colors (e.g., `#1565c0`, `#4caf50`, `#e65100`)
- Don't use raw `<button>` elements — use `<BaseButton>`
- Don't use `<div class="loader">` or text "Loading..." — use `<LoadingSpinner>`
- Don't duplicate status badge CSS — use `<StatusBadge>`
- Don't define `grid-template-areas` without corresponding `grid-area` CSS rules
- Don't use raw pixel values for spacing or font sizes
- Don't use raw `rem` values that could be design tokens
- Don't create more than one `.input-group` per view for form fields

---

## 10. View-Specific Patterns

### SiteVisitManager

The site visit form manages basic metadata only: code, location, dates, main/secondary inspectors, and status. Services, schedules, objective, and scope are managed per-provider in `InspectionManager.vue`.

- **No Services/Schedules buttons** — these belong to per-provider inspections
- **Inactivate/Reactivate buttons** appear in the input-buttons row alongside Save/Cancel
- **Provider cards** show added providers with a "Manage Inspection" link to the per-provider view
- **Provider selection** is gated on `canAssignServices(status)`: only available when status is `Created` or `Defined`

### InspectionManager (per-provider)

This is the operational view for a single provider within a site visit. It shows:

- **SiteVisitHeader**: site visit code, location, dates, provider name (read from stores)
- **Editable fields**: inspection type, objective, scope (gated on per-inspection status)
- **Read-only fields**: description, conclusion (populated after report generation)
- **Services panel**: filtered by provider via `locationStore.getLocationServices(locationId, providerId)`
- **Schedules panel**: 2×2 grid layout (Name/Place, Start Date/Time, End Date/Time). Auto-generated opening/closing meetings.
- **Status badge**: per-inspection status with same color coding
- **Schedule defaults**: start date defaults to site visit start date 10:00 on focus

### Inspection Plan

Select a site visit → select a provider → optionally select a service area → generate.

- Uses provider filtering (not service area) to preserve per-provider confidentiality
- Generate button disabled until a site visit and provider are selected
- Plan regenerable at `Assigned` and `Planned` status

### Inspection Report

Select a site visit → select a provider → fill report date, description, conclusion → generate.

- **Objective, Scope, Inspection Type**: read-only, pre-filled from per-provider Inspection
- **Description, Conclusion**: editable textareas per-provider, saved to Inspection on generate
- **Report Date**: defaults to today
- **Provider dropdown**: uses `serviceProviderId` from `InspectedProvider` records

### Checklist Manager

Single horizontal filter row with 3 columns: Site Visit | Provider | Specialty. Select All / Clear All buttons appear below when a specialty is selected. Questions appear below without requiring scrolling.

### Findings / Corrective Actions / Follow-ups

- All use `BaseButton` for actions (View, Submit, Review, Create)
- Cards use design tokens for borders, padding, backgrounds
- **Corrective Actions**: listing at top; Submit/Review sections toggled by buttons
- **Follow-ups**: listing at top; Register form toggled by button
- **Findings**: detail panel above table for immediate visibility

---

## 11. Date Smart Defaults

| Context | Field | Default |
|---|---|---|
| Site Visit | Start Date | Today + 20 days (set on `startAdd()`) |
| Site Visit | End Date | Start Date + 1 day (set on `@blur` of start date, if end is empty) |
| Schedule (New) | Start Date/Time | Site visit start date at 10:00 (set on `@focus`) |
| Schedule (New) | End Date/Time | Same as start (set on `@blur` of start, if end is empty) |
| Inspection Report | Report Date | Today's date (set on `onMounted()`) |

Implementation: `@focus` and `@blur` event handlers on the respective input fields. Defaults only apply when the field is empty.

---

## 12. Inspection Status Lifecycle

Each per-provider `Inspection` has its own independent status. The site visit status is no longer used for operational gating.

| Status | Set by | Next available actions |
|---|---|---|
| `Created` | Auto-set on inspection creation | Edit basics, assign services, assign schedules |
| `Defined` | `InspectionManager` (after services + schedules exist) | Assign inspectors |
| `Assigned` | `AssignInspectors` (after inspector assignments saved) | Process checklists, generate plan |
| `Planned` | Node-RED (after plan generation) | Upload checklists, regenerate plan |
| `Uploaded` | Node-RED (after canonical import) | Generate report |
| `Reported` | Node-RED (after report generation) | Regenerate report |
| `Complete` | External system only | Read-only |
| `Inactive` | `SiteVisitManager` (manual inactivation, pre-Uploaded only) | Read-only |

**Status transitions are per-inspection, not per site visit.** One inspection can be at `Planned` while another is at `Created` — they progress independently. This prevents a slow inspection from blocking a fast one.

### File Organization

```
src/
├── components/
│   ├── base/           # Generic reusable: BaseManager, BaseButton, StatusBadge, LoadingSpinner
│   ├── common/         # Domain-specific reusable: ScopePicker, ModalWindow
│   └── inspection/     # Inspection-specific: SiteVisitHeader, TopicChecklistGroup
├── views/              # Page-level components (one per route)
├── stores/             # Pinia stores
├── services/           # API service functions
└── utils/              # Utility modules
```

---

## 13. Internationalization (i18n)

The app supports English and Spanish via `vue-i18n` (Composition API mode). Translation resources live in `src/i18n/locales/en.json` and `es.json`; the configured instance is `src/i18n/index.js`.

Keys are namespaced per view, matching the component name: `findingManager.title`, `findingManager.table.findingId`, etc. `BaseButton`/`StatusBadge`/`LoadingSpinner` take text via props/slots and hold no strings of their own — translate at the call site, not inside the base component.

The active locale is resolved once, in `src/router/guards.js`, in this order: the user's persisted session preference (`POST /api/auth/locale`, see `docs/auth/AUTH_CHUNK1_API_SPEC.md` §4.4) → browser language → `en` fallback. Server-side strings (notification subject/body in `server/notifications/messages.cjs`) are separate — see `NOTIFICATION_LOCALE` in the root `README.md`, since those go to fixed shared inboxes rather than a browsing session.

### Do

- Add new UI strings to both `en.json` and `es.json` in the same commit — never let one locale fall behind.
- Use `useI18n()` inside components; import the `i18n` instance directly in non-component code (services, stores).
- Keep keys namespaced by view/component so two views can use a short key like `title` without colliding.

### Don't

- Don't hardcode user-facing text in a `.vue` template or a server-side string the client displays — route it through `t()` or the message catalog.
- Don't put translated strings inside `src/components/base/*.vue` — they take text as props/slots so callers can localize it.
- Don't assume `formatDate`/`formatDateTime` (`src/utils/formatDate.js`) default to a fixed locale — they follow the active i18n locale.

---

*Last updated: September 2026. Maintained by the compliance_web development team.*
