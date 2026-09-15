---
name: SaHei
description: AI phone agent dashboard for Malayalam-speaking small businesses
colors:
  navy-ink: "#031130"
  paper: "#f3f7f3"
  wire-blue: "#185df1"
  ledger-rule: "#768193"
  surface: "#e7ebf3"
  error: "#e7000b"
rounded:
  sm: "0px"
  md: "2px"
  lg: "4px"
  xl: "8px"
components:
  button-primary:
    backgroundColor: "{colors.navy-ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 1rem"
  button-primary-hover:
    backgroundColor: "{colors.navy-ink}"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.lg}"
    padding: "0.5rem 1rem"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.navy-ink}"
    rounded: "{rounded.xl}"
    padding: "1.5rem"
---

# Design System: SaHei

## Overview

**Creative North Star: "The Daybook Ledger"**

SaHei's dashboard reads as the shop's own bound appointment daybook — ruled rows, ink-stamped status — now kept by an AI. The audience is a non-technical small-business owner (salon, clinic, service-shop) checking, in short sessions often on a phone, whether calls are being handled and bookings are landing. Operate mode: task completion outranks persuasion or decoration.

The system commits to one accent, used rarely: a wire-blue reserved for a single "live/active" role, not a general-purpose brand color. Everything else is navy ink on off-white paper. This is a restrained system, not a colorful one — the rarity of blue is what gives it meaning.

Confirmed anti-goals: nothing playful, gamified, or marketing-glossy. No confetti, badges, hero sections, or landing-page moves.

**Key Characteristics:**
- One accent color, deliberately rationed
- Ruled rows and visible borders over soft shadow-based separation
- Status shown as a stamped label, never a colored pill
- Crisper, less-rounded corners than default shadcn

## Colors

Two neutrals and one accent — the palette is built to be read, not decorated with.

### Primary
- **Navy Ink** (#031130): structure, body text, and the default button fill. Doubles as `--primary` — this system treats "primary action" as "the ink," not the accent color.

### Secondary
- **Wire Blue** (#185df1): reserved for exactly one role — the focus ring and the active-state rule on navigation. **The One Role Rule.** Blue never fills a button or a background; if it did, it would stop meaning "this is live."

### Neutral
- **Paper** (#f3f7f3): page and card background — the ledger's page.
- **Ledger Rule** (#768193): borders and dividers. Deliberately darker than a typical soft-SaaS hairline (measured 3.65:1 against Paper, WCAG non-text minimum) — a ruled-row system needs a rule you can actually see.
- **Surface** (#e7ebf3): secondary/muted backgrounds — hover washes, muted badges. Do not read this as "the brand accent"; it is a neutral tint of navy, not blue.

### Named Rules
**The One Role Rule.** Wire Blue appears in exactly one place at a time: the thing that is currently focused or currently active. It is never a fill color.

## Typography

**Body Font:** Geist (current, via `next/font` in `apps/client`) — provisional, not a confirmed brand pairing. SHAPE.md (Session 13) explicitly leaves "exact type family pairing" open; this entry records what is wired today, not a decision.

**Character:** workaday system sans; tabular numerals for times and counts (times/call durations should not visually jitter as digits change).

### Named Rules
**The No Display Serif Rule.** No display serif anywhere in this system — confirmed exclusion from SHAPE.md, not a default.

## Elevation & Depth

Flat by default. `Card` carries a minimal `shadow` (shadcn's stock `shadow-sm`-equivalent) rather than a token — not yet elevated to a named elevation scale, since nothing in the shipped system uses more than one shadow step. Depth in this system comes from the ruled border, not from lifting surfaces.

## Shapes

Corners are tighter than default shadcn: `--radius` is `4px` (down from stock's `10px`), giving `sm: 0px`, `md: 2px`, `lg: 4px`, `xl: 8px`. Small utilitarian controls (the dialog close button) land at `0px` — reading as crisp and square rather than soft, on purpose. Cards and dialogs keep a small visible radius (`8px`/`4px`) so the system doesn't tip into brutalist.

### Named Rules
**The Crisper-Not-Sharper Rule.** Corners are tighter than stock shadcn to read as structured/ledger-like, but never fully square on a content surface — only on small in-line controls.

## Components

### Buttons
- **Shape:** `4px` radius (`rounded-md` role)
- **Primary:** navy-ink fill, paper text, `hover:bg-primary/90`
- **Outline:** paper fill, `1px` ledger-rule border, navy-ink text
- **Focus:** `2px` wire-blue ring — the accent's one reserved appearance

### Cards / Containers
- **Corner Style:** `8px` (`rounded-xl`)
- **Background:** Paper
- **Shadow Strategy:** minimal (see Elevation & Depth) — not a named elevation step
- **Border:** `1px` ledger-rule
- **Internal Padding:** `1.5rem` header/content, `0` top padding on content directly under a header

### Tables
- **Style:** ruled rows — `1px` ledger-rule border under header and every row except the last; no zebra striping
- **Header:** ledger-rule-adjacent muted text, left-aligned, no background fill
- **Hover:** subtle Surface wash on row hover
- **Status column:** intentionally undecorated in this base primitive — SHAPE.md's ink-stamp status treatment (BOOKED/MISSED/CANCELLED/COMPLETED as a rotated overprint, never a colored pill) is scoped to a future session once real call/booking data exists

### Dialog
- **Style:** centered, `8px`-radius panel on Paper, `1px` ledger-rule border, `black/80` scrim (deliberately the one hardcoded, non-token color in the system — a modal scrim dims by absolute darkness, not by theme role)
- **Motion:** 200ms fade + zoom + slight slide — a snap-and-settle, never a bounce or glow, per SHAPE.md's transition rule
- **Focus:** full focus-trap and Escape-to-close via Radix; wire-blue ring on the close control

### Navigation (SectionNav)
- **Style:** vertical list, not a top nav bar — the three product sections (Calls/Transcripts, Bookings/Calendar, Analytics) are meant to read as ledger-tab dividers down the side
- **Default/Active:** muted text with a transparent left rule at rest; navy text, Surface wash, and a `2px` wire-blue left rule when active — this is the accent's other reserved appearance
- **Mobile treatment:** not yet resolved — Session 14 shipped the primitive only; the responsive collapse behavior for this nav is open for a future session

## Do's and Don'ts

### Do:
- **Do** keep Wire Blue to exactly one live/active signal at a time (focus ring, active nav rule).
- **Do** use a visible, measured-contrast rule for dividers and borders — this system's rows are meant to be seen, not implied by whitespace.
- **Do** keep buttons and cards flat; reach for the ledger-rule border before reaching for a shadow.

### Don't:
- **Don't** fill a button, badge, or background with Wire Blue — it reads as "the brand color" only because it is rare.
- **Don't** add a colored status pill; SHAPE.md specifies an ink-stamp overprint treatment instead, once that work is scoped.
- **Don't** add playful, gamified, or marketing-glossy elements (confetti, badges, hero sections) — this is an operational tool, not a marketing surface.
