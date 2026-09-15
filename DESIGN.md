---
name: SaHei
description: AI phone agent dashboard for Malayalam-speaking small businesses
colors:
  navy-shell: "#031130"
  shell-surface: "#0b1b3d"
  shell-accent: "#14264c"
  shell-border: "#253a66"
  shell-foreground: "#f3f7f3"
  shell-muted-foreground: "#a9b8d9"
  wire-blue: "#185df1"
  wire-blue-hover: "#144fcd"
  paper: "#f3f7f3"
  card: "#ffffff"
  surface: "#e7ebf3"
  border: "#d8deea"
  muted-foreground: "#5b6472"
  status-success: "#16a34a"
  status-warning: "#f97316"
  status-danger: "#e11d48"
  error: "#e11d48"
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "16px"
components:
  button-primary:
    backgroundColor: "{colors.wire-blue}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-primary-hover:
    backgroundColor: "{colors.wire-blue-hover}"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.navy-shell}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.navy-shell}"
    rounded: "{rounded.lg}"
    padding: "1.5rem"
---

# Design System: SaHei

## Overview

**Creative North Star: "Confident SaaS Console"**

SaHei's dashboard reads as a modern, trustworthy SaaS operations tool, not a bookish ledger metaphor (the superseded "Daybook Ledger" direction). A deep navy shell — sidebar, topbar, and all three auth screens — frames the product's identity; a light off-white canvas carries the scan-heavy content (tables, call/booking lists, empty states) where a non-technical shop owner needs fast legibility, not atmosphere. Wire Blue is the one confident color move: a filled, promoted primary interactive color rather than a rationed accent.

This is a category-resemblance move, not a decorative one: PRODUCT.md's owner audience already trusts this shell/canvas SaaS pattern by sight, and the redesign leans into that recognition instead of asking them to learn a bespoke ledger visual language. Rounded corners and soft shadows replace the old flat, ruled-border, crisp-corner system — the product now reads as approachable software, not a stamped paper record.

Confirmed anti-goals carried forward: nothing playful, gamified, or marketing-glossy. No confetti, badges, hero sections, or landing-page moves — this remains an operational verification tool.

**Key Characteristics:**
- Dark navy shell (nav/topbar/auth) + light off-white content canvas — a deliberate split, not a full dark theme
- Wire Blue as primary interactive color system-wide (buttons, links, active nav, focus rings), not a single rationed role
- Rounded, soft-shadowed surfaces (12px base radius, `shadow-lg` cards) replacing the old sharp/flat ledger system
- Named status-accent tokens reserved for future call/booking outcome chips — not yet wired into any shipped component
- Text wordmark ("SaHei") on the dark shell in place of the opaque-white-background logo asset

## Colors

Two palettes on two fields: a dark navy shell palette and a light paper/card content palette, unified by one primary interactive blue.

### Primary
- **Wire Blue** (#185df1): the system's primary interactive color — primary button fill, links, active nav state (`bg-shell-accent` combined with this blue for focus rings), and every focus ring. Promoted from the prior system's single "focus ring only" role to a general-purpose primary; hover state uses **Wire Blue Hover** (#144fcd, `--primary-hover`).

### Neutral — Shell (dark)
- **Navy Shell** (#031130, `--shell-background`): the dominant dark field for the sidebar, topbar, and all three auth screens (sign-in, sign-up, org/new).
- **Shell Surface** (#0b1b3d, `--shell-surface`): reserved surface token for elevated elements on the dark field.
- **Shell Accent** (#14264c, `--shell-accent`): active/hover fill for nav items on the dark shell.
- **Shell Border** (#253a66, `--shell-border`): dividers between shell regions (header/sidebar borders).
- **Shell Foreground** (#f3f7f3, `--shell-foreground`): primary text on the dark shell.
- **Shell Muted Foreground** (#a9b8d9, `--shell-muted-foreground`): secondary text on the dark shell (inactive nav labels, org name).

### Neutral — Canvas (light)
- **Paper** (#f3f7f3, `--background`): the light content canvas background for scan-heavy areas (tables, empty states).
- **Card White** (#ffffff, `--card`): card surfaces sitting on the paper canvas.
- **Surface** (#e7ebf3, `--secondary`/`--accent`): muted/secondary backgrounds and hover washes on the light canvas.
- **Border** (#d8deea, `--border`): dividers and hairlines on the light canvas.
- **Muted Foreground** (#5b6472, `--muted-foreground`): secondary text on the light canvas.

### Reserved (not yet componentized)
- **Status Success** (#16a34a), **Status Warning** (#f97316), **Status Danger** (#e11d48): named tokens defined in `globals.css` for future call/booking outcome chips/badges. No shipped component currently reads these — no real call/booking data exists yet. Treat as reserved roles, not an already-shipped chip pattern.

### Named Rules
**The Shell/Canvas Split Rule.** Navy Shell owns navigation and auth surfaces; Paper owns scan-heavy content surfaces. Never mix the two within one region — a table or empty-state card does not sit on the dark field, and nav/topbar does not sit on paper.

## Typography

**Body Font:** Inter (via `next/font/google` in `apps/client/src/app/layout.tsx`), replacing the prior system's Geist.

**Character:** a neutral, high-legibility grotesque appropriate to an operational verification tool checked in short sessions.

### Named Rules
**The No Display Serif Rule.** Carried forward unchanged: no display serif anywhere in this system.

## Layout

Two-region shell: a fixed dark header (`border-b border-shell-border`, `bg-shell-background`) and, at `md` and above, a fixed 224px (`w-56`) dark sidebar (`border-r border-shell-border`) holding `SectionNav`. Main content renders on the light `bg-background` canvas at `p-4 md:p-6`. Below `md`, the sidebar collapses entirely and navigation moves into `MobileNav`, an off-canvas left-edge slide-in panel triggered by a header hamburger button, reusing `SectionNav`/`SectionNavItem` unchanged. Auth screens (sign-in, sign-up, org/new) are single-column, centered on the full dark shell field, with a `max-w-sm` card floating on the dark background rather than paper-on-paper.

## Elevation & Depth

Shadows are back: `Card` ships `shadow-lg` (not the prior system's flat/ruled-border-only treatment), and `Dialog`/`MobileNav` panels also carry `shadow-lg`. Depth now comes from lifting surfaces, not solely from a visible rule.

### Named Rules
**The Lifted-Card Rule.** Content cards on the light canvas carry a real shadow (`shadow-lg`) plus a hairline `border`; this reverses the prior "flat by default" system.

## Shapes

Corners are rounded, not crisp: `--radius` is `12px` (`0.75rem`, up from the prior system's `4px`), giving `sm: 8px`, `md: 10px`, `lg: 12px`, `xl: 16px`. Buttons and inputs use `rounded-md` (10px); Cards use `rounded-xl` (16px, per Card's literal `rounded-xl` class — note this maps to the `xl` step, not `lg`, despite the frontmatter's card `rounded: {rounded.lg}` slot being the closest Stitch-schema primitive); Dialog panels use `sm:rounded-lg` (12px).

### Named Rules
**The Rounded-Not-Crisp Rule.** Corners read as soft/approachable, reversing the prior "Crisper-Not-Sharper" 4px system. No small in-line control is deliberately squared off in this system.

## Components

### Buttons
- **Shape:** `10px` radius (`rounded-md`)
- **Primary (`default` variant):** Wire Blue fill (#185df1), white text, `shadow`, `hover:bg-primary/90`
- **Outline:** paper/background fill, `1px` input-border, hover fills with `accent`
- **Ghost:** transparent, used for icon/utility actions (mobile nav trigger, sign-out) — on the dark shell these override to `text-shell-foreground hover:bg-shell-accent`
- **Focus:** `2px` Wire Blue ring (`focus-visible:ring-2 focus-visible:ring-ring`)

### Cards / Containers
- **Corner Style:** `16px` (`rounded-xl`)
- **Background:** Card White (#ffffff) on the light canvas
- **Shadow Strategy:** `shadow-lg` (see Elevation & Depth) — not flat
- **Border:** `1px` border token
- **Internal Padding:** `1.5rem` header/content, `0` top padding on content directly under a header

### Inputs / Fields
- **Style:** `10px` radius, `1px` input border, `bg-background`, `shadow-sm`
- **Focus:** `2px` Wire Blue ring, same reserved-primary role as Button focus
- **Label:** plain `<label>`, `text-sm font-medium`
- **Used by:** sign-in, sign-up, org/new forms

### Dialog / MobileNav
- **Style:** `Dialog` is a centered panel (`sm:rounded-lg`, 12px) on `bg-background`, `black/80` scrim, `shadow-lg`. `MobileNav` reuses the same Radix Dialog primitive as an off-canvas left-edge slide-in panel (`w-3/4 max-w-xs`) on `bg-shell-background`, same `black/80` scrim and 200ms duration.
- **Motion:** 200ms fade + zoom (Dialog) or slide-in-from-left (MobileNav); Radix `animate-in`/`animate-out` state-driven transitions, no bounce.
- **Focus:** full focus-trap and Escape-to-close via Radix; Wire Blue ring on the close control.

### Navigation (SectionNav)
- **Style:** vertical list on the dark shell (sidebar on desktop, `MobileNav` panel on mobile) for the three product sections (Calls & Transcripts, Bookings & Calendar, Analytics).
- **Default:** `text-shell-muted-foreground`, transparent background.
- **Hover:** `bg-shell-accent`, `text-shell-foreground`.
- **Active:** filled `bg-shell-accent` background + `font-semibold` + `text-shell-foreground`. There is no left-border/side-stripe indicator in the shipped component — an earlier `border-l-2` treatment (a leftover from the discarded ledger-tab motif) was flagged by `impeccable detect` as a recognized AI-slop tell and removed; the filled/bold treatment is the current and correct pattern.
- **Focus:** `2px` Wire Blue ring (`focus-visible:ring-2 focus-visible:ring-ring`).
- **Mobile treatment:** below `md`, `SectionNav` moves into `MobileNav`, a left-edge slide-in panel opened via a header hamburger trigger; reuses `SectionNav`/`SectionNavItem` unchanged so active/default states match the desktop rail.

### Wordmark (in place of logo.png on the shell)
`apps/client/public/logo.png` has an opaque white background and is not used on the dark shell — it would render as a visible white box. Sign-in, sign-up, org/new, and the dashboard topbar instead use a styled text wordmark (`<span className="text-2xl font-semibold tracking-tight text-shell-foreground">SaHei</span>` on auth screens, `text-lg font-semibold` in the topbar). **Follow-up asset needed:** a transparent-background or dark-mode logo variant from the user before the image asset can be reintroduced on the dark shell.

## Do's and Don'ts

### Do:
- **Do** use Wire Blue as the general-purpose primary interactive color (buttons, links, active nav, focus) — this system deliberately reverses the prior "One Role Rule."
- **Do** keep navigation and auth surfaces on the dark shell (`--shell-*` tokens) and scan-heavy content surfaces on the light paper canvas (`--background`/`--card`) — never mix the two within one region.
- **Do** use `shadow-lg` on cards and dialog/nav panels; this system uses real elevation, not a flat/ruled-border-only strategy.

### Don't:
- **Don't** reintroduce a colored left-border/side-stripe on `SectionNavItem` — that treatment was flagged as an AI-slop tell and removed; active state is filled background + weight only.
- **Don't** place `apps/client/public/logo.png` directly on the dark shell — its opaque white background shows as a visible box; use the text wordmark until a transparent/dark-mode logo variant exists.
- **Don't** wire the `--status-success`/`--status-warning`/`--status-danger` tokens into a chip/badge component by guessing values — they are reserved for real call/booking outcome data, not yet a shipped pattern.
- **Don't** add playful, gamified, or marketing-glossy elements (confetti, badges, hero sections) — this remains an operational tool, not a marketing surface.
