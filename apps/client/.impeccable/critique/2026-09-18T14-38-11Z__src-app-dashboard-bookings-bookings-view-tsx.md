---
target: bookings calendar page
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 1
target_identity: "file:C:\\Users\\user\\Documents\\Development\\saHei\\apps\\client\\src\\app\\dashboard\\bookings\\bookings-view.tsx"
target_fingerprint: "sha256:688ad3439aa794bb5e152c9dd3bba6d761e7806b0065a63dbb49a80a7f93f3c3"
target_path: "C:\\Users\\user\\Documents\\Development\\saHei\\apps\\client\\src\\app\\dashboard\\bookings\\bookings-view.tsx"
timestamp: 2026-09-18T14-38-11Z
slug: src-app-dashboard-bookings-bookings-view-tsx
---
Method: dual-agent (A: design-review sub-agent · B: detector-scan sub-agent)

# Critique: Bookings & Calendar (agenda-list appointment page)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | No count/filter-state indicator; no shape-matched loading skeleton |
| 2 | Match System / Real World | 4 | Status vocabulary and en-IN time formatting match shop-owner mental model |
| 3 | User Control and Freedom | 1 | API already supports status/q filters; client calls /appointments with none |
| 4 | Consistency and Standards | 2 | Grouping granularity diverges from Calls page; COMPLETED reuses Wire Blue, which means "neutral" on the sibling badge |
| 5 | Error Prevention | 3 | Read-only view; retry flow is clean |
| 6 | Recognition Rather Than Recall | 3 | Per-row date only lives in the day header, not the row itself |
| 7 | Flexibility and Efficiency | 1 | Zero filters/search/sort on a list that shows an org's entire history by design |
| 8 | Aesthetic and Minimalist Design | 4 | Clean, single-purpose, no marketing chrome |
| 9 | Error Recovery | 3 | Retry pattern works cleanly |
| 10 | Help and Documentation | 1 | Calls page has an OUTCOME_LEGEND; Bookings has no equivalent for "No-show" |
| **Total** | | **25/40** | **Acceptable** |

## Design Specificity Verdict

LLM assessment: This page could be dropped into almost any generic appointment-CRUD product unchanged. bookingReference already exists on both the Calls transcript and the Appointment record, but the two are never linked. What is done well is disciplined, faithful reuse of the sibling Calls page's plumbing.

Deterministic scan: Clean across the board — bookings-view.tsx, appointment-status-badge.tsx, and the unchanged calls-view.tsx baseline all returned exit 0 / [] from the real detector engine (impeccable-engine 0.1.5, verified genuine via a deliberate bad-file probe). No mechanical rule fires, no false positives to weigh.

Visual overlays: Unavailable this run — no browser-automation tool exposed in this session, and /dashboard/bookings sits behind an authenticated, org-scoped route with no test credentials on hand. Reported fallback, not a skipped step.

## Overall Impression

Solid, disciplined plumbing inherited faithfully from the Calls page — but the page ships "show everything, forever, unfiltered" with none of the already-built server-side filtering wired up, and it's not yet doing anything that couldn't belong to a generic booking product.

## What's Working

1. Structural discipline mirroring Calls — identical retry/loading/empty control flow, responsive split, and keyboard handling.
2. Domain-accurate copy — "No-show" is precise service-industry vocabulary; en-IN 12-hour time formatting matches the target market.
3. Status conveyed by text label, not color alone — accessible by construction.

## Priority Issues

[P0] Unbounded, unfiltered "wall of history" with server-side filtering already built and unused
- Why it matters: findByOrgId returns every matching appointment ever, no pagination; the view calls it with zero query params despite ListAppointmentsQueryDto already supporting status and q.
- Fix: Default to a bounded recent window and/or paginate; surface the status/search filters that already exist server-side.
- Suggested command: /impeccable harden

[P1] Fake-button rows/cards skip the app's standard focus ring, and the table row loses assistive-tech semantics
- Why it matters: role="button" tabIndex={0} on a <tr> and mobile Card gets no focus-visible styling, unlike every real control elsewhere. Overriding a <tr>'s implicit role also strips column/header relationships from screen readers. Inherited unchanged from calls-view.tsx — systemic.
- Fix: Add the branded focus ring at minimum; for the table, keep native row semantics and put the activatable affordance on a focusable element inside a cell.
- Suggested command: /impeccable audit

[P2] Status-color tokens carry conflicting meanings across the two badge components
- Why it matters: COMPLETED uses Wire Blue (--primary) here, but blue means neutral/uncertain INQUIRY on OutcomeBadge. Separately, --status-danger and --destructive share the identical hex.
- Fix: Give COMPLETED a neutral/resolved tone instead of --primary; give "Cancelled" its own token distinct from system-error red.
- Suggested command: /impeccable polish

[P2] The detail dialog rarely reveals anything the mobile card didn't already show
- Why it matters: The mobile card already shows every dialog field except notes, which is often absent. Most taps open an overlay revealing nothing new.
- Fix: On mobile, replace with an inline expand revealing only the delta, or ensure card/dialog have a genuine informational gap.
- Suggested command: /impeccable distill

[P3] Literal calendar-day grouping strips the one thing it could have kept: per-row date
- Why it matters: Rows show time-only; the day header becomes the sole carrier of date, and headers multiply indefinitely as history grows.
- Fix: Put the date back in each row, or adopt Calls' coarser Today/Earlier bucketing.
- Suggested command: /impeccable layout

## Persona Red Flags

Alex (power user, months of history): Hits P0 hardest — no search/filter/sort despite the backend already supporting it.

Sam (accessibility, keyboard/screen reader): Tabbing into the desktop table lands on a <tr role="button"> that loses column semantics and shows the browser's native focus outline instead of the app's Wire Blue ring.

Priya (anxious first-check owner — the product's stated core user): groupByDay only renders a section for a day with >=1 appointment, so a quiet day and a broken agent look identical.

## Minor Observations

- Mobile tap-target size is fine — the real gap is affordance/focus (P1), not size.
- Nav item reads "Bookings & Calendar" but the shipped UI is a flat list, no grid — confirm this is a deliberate MVP scope-down.
- NO_SHOW's orange-on-white text is a plausible AA-contrast risk near the threshold — unverified, no rendering available this run.
- No legend for what "No-show" means operationally, unlike Calls' OUTCOME_LEGEND.

## Questions to Consider

1. Should Bookings and Calls become two filtered views of one call+booking timeline rather than two structurally identical but disconnected pages?
2. Is "every appointment ever, unfiltered" a considered decision for a live org at month six, or one made for the empty/demo state that hasn't been revisited?
