---
version: 1
slug: "client"
primary_target: "client"
related_targets: []
---

## Direction contract

**THESIS:** Navy Ink stops being rationed and becomes a real dominant dark field on the shell, not a thin restrained accent — breaking from the prior "Daybook Ledger" system's neutrals-plus-one-sliver-of-blue restraint.

**OWN-WORLD:** Deep navy (`#031130`-anchored) dark shell — sidebar nav, topbar, and all auth screens (sign-in/sign-up/org-new) — paper/off-white (`#F3F7F3`-anchored) content canvas for scan-heavy areas (tables, call/booking lists, empty states). Wire Blue (`#185DF1`) promoted from single-role focus-ring accent to primary interactive color: primary buttons, active nav state, links. New named status-accent set (green/orange/pink/cyan-family) carries call & booking outcomes as color-coded chips/badges — the functional, product-specific translation of salesport.io's scattered vivid accent dots, replacing the shelved ink-stamp idea. Inter typeface (replacing Geist). Rounded corners (12-16px range, undoing the old 4px "Crisper-Not-Sharper" rule). Soft shadow/elevation permitted again (dropping the old flat/ruled-border-only rule).

**STORY:** Same audience and job as before (non-technical shop owner verifying their AI phone agent between other tasks) — but the product now visually reads as a modern, confident SaaS tool the owner already trusts by category resemblance, not a bookish ledger metaphor.

**FIRST VIEWPORT:** Sign-in screen — full dark-navy surface, SaHei logo + wordmark prominent near top, a rounded card floating on the dark field (not paper-on-paper), Wire Blue filled primary button as the one confident color move.

**FORM:** User/brief-pinned direction (explicit reference: salesport.io — pulled actual CSS palette, not guessed). `impeccable concept-seed --scope direction --mode operate` run (seed key `d2427e8c`, assigned index 4); all six dealt catalog challengers (Crouwel grid specimen, starship elbow panel, origami crane sequence, alphabet storm, seven-segment display, one-bit desktop) declined as unrelated to a phone-dashboard product — brief-pinned decision beats the roll per process rule.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance. (No image-generation tool confirmed available this session, so this build is code-led: no comp round, no finish-reviewer/documenter subagents invoked — self-reviewed against this contract and DESIGN.md updated directly at finish; disclosed here as the substitution.)

## Scope and boundaries

Whole `apps/client` dashboard surface: sign-in, sign-up, org-new, app shell (SectionNav + MobileNav + topbar), and the three content screens (calls/transcripts, bookings/calendar, analytics). Dark shell/nav + light content canvas (user-confirmed split, not full dark theme). Must preserve: brand colors `#031130`/`#185DF1`/`#F3F7F3` as binding anchors (PRODUCT.md), SaHei logo, multi-tenant behavior, all existing routes/auth logic (visual-only redesign, no behavior change).

## Unresolved decisions

Exact status-accent hex values for call/booking outcome chips (BOOKED/MISSED/CANCELLED/COMPLETED) — decided at build time from the committed palette family, since no real call/booking data exists yet to calibrate against.
