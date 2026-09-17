---
target: Calls & Transcripts dashboard page (apps/client/src/app/dashboard/calls)
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:C:\\Users\\user\\Documents\\Development\\saHei\\apps\\client\\src\\app\\dashboard\\calls\\page.tsx"
target_fingerprint: "sha256:f88b56653bdb10cec92a01978d966459d0b1aecf2bcb9bf00a320dfd89e6ec4f"
target_path: "C:\\Users\\user\\Documents\\Development\\saHei\\apps\\client\\src\\app\\dashboard\\calls\\page.tsx"
timestamp: 2026-09-17T11-13-02Z
slug: apps-client-src-app-dashboard-calls-page-tsx
---
Method: dual-agent (Assessment A: design review sub-agent · Assessment B: detector + browser-evidence sub-agent, run isolated and in parallel)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Loading/error states are bare text, no skeleton, no retry action |
| 2 | Match System / Real World | 3 | Good domain words (Booked/Inquiry/Booking reference); "No outcome" is a system word, not how an owner would phrase it |
| 3 | User Control and Freedom | 2 | Dialog closes fine (X/Esc/outside-click); no way to move to next/prev call without closing and re-opening |
| 4 | Consistency and Standards | 3 | Built from shared @sahei/ui Table/Dialog, tokens match DESIGN.md; OutcomeBadge is a one-off style map, not yet a shared pattern |
| 5 | Error Prevention | 3 | Read-only page, little to prevent; row target has role=button + keyboard handling |
| 6 | Recognition Rather Than Recall | 2 | No legend for what the outcome colors mean; no speaker label on chat bubbles — side/color must be memorized |
| 7 | Flexibility and Efficiency | 1 | No sort, filter UI, date grouping, or shortcuts for an owner who checks this many times a day |
| 8 | Aesthetic and Minimalist Design | 3 | Clean single table, good whitespace; long transcript text has no hierarchy, table breaks on mobile (see below) |
| 9 | Error Recovery | 2 | Raw ApiError message shown, no retry button, no distinction between network/auth/empty |
| 10 | Help and Documentation | 1 | No tooltip or hint explaining the outcome taxonomy to a non-technical owner |
| **Total** | | **22/40** | **Acceptable — real gaps, but foundation is sound** |

## Design Specificity Verdict

**LLM assessment:** Half specific, half generic. The color/copy layer is authored for SaHei — status tokens wired exactly per DESIGN.md (BOOKED=green, INQUIRY=Wire Blue, danger correctly left unused), en-IN date formatting, +91 phone numbers, domain-correct nav labels. But the structural skeleton — a plain table + a plain two-tone chat dialog — is category-generic; it could serve any SaaS call log unchanged. Nothing in the transcript view signals "Malayalam phone call transcript" specifically (no language tag, no call duration, no speaker label), and there's no mobile-specific treatment despite PRODUCT.md stating owners check this "often on a phone."

**Deterministic scan:** `impeccable detect --json` on all 4 target files (page.tsx, calls-view.tsx, outcome-badge.tsx, empty-state.tsx) returned `[]`, exit 0 — zero rule violations, no AI-slop tells caught (e.g. no reintroduced side-stripe nav border, no guessed status-color misuse). Clean scan, but a clean detector run measures absence of known bad patterns, not presence of product-specific craft — the specificity gap above is a judgment call the detector isn't built to catch.

**Visual evidence:** No live overlay available — this Impeccable CLI build ships `detect / ignores / help / install / link / update / check` only, no `live-server` command, so injected-overlay visualization was skipped (not a target-compatibility issue, the command simply doesn't exist in this install). Evidence instead comes from real Playwright screenshots against the live, data-populated app (both desktop 1280×800 and mobile 390×844, signed in as a real seeded org).

## Overall Impression

The page is honest, functional, and correctly wired into the existing design system — it does not embarrass the "Confident SaaS Console" direction. The real gap is that it was built to the shape of a generic data table, not to the shape of how PRODUCT.md says this page actually gets used: on a phone, in short bursts, repeated all day, by someone who is not technical. The single biggest opportunity is making the table itself — not just the dialog — work at phone width, since that's where the current build measurably breaks.

## What's Working

1. **Token discipline.** The outcome-color mapping is an exact, disciplined translation of DESIGN.md's reserved status tokens — BOOKED→success, INQUIRY→Wire Blue, and danger deliberately left unused rather than forced onto "No outcome." That restraint is easy to get wrong and wasn't.
2. **Dialog-over-inline-expand.** Keeping the list scannable and pushing the dense transcript text into a Dialog matches the "scan first, read second" product principle directly, and the transcript view itself reads cleanly once open.
3. **Real accessibility effort on the row click.** `role="button"` + `tabIndex` + Enter/Space handling on table rows is more than the shadcn default gives you for free — someone thought about keyboard users here, and it shows up as zero console errors across both desktop and mobile automated passes.

## Priority Issues

**[P0] Table doesn't adapt to phone width — confirmed by measurement, not just visual inspection.**
- **Why it matters:** PRODUCT.md: owners check this "often on a phone." At 390×844, the page measurably overflows horizontally (`scrollWidth` 495px vs `clientWidth` 390px, a 105px overflow) and the first table row's right edge lands at ~454px — past the viewport. The "Booking reference" header visibly wraps and crowds the card edge in the mobile screenshot. This is the exact scan-first moment PRODUCT.md cares about most, breaking on the exact device it's supposed to work on.
- **Fix:** Add a stacked/card layout for the table below the `sm` breakpoint, with Outcome kept visually first since it's the highest-signal column.
- **Suggested command:** `/impeccable shape calls-list-mobile`

**[P1] No error-recovery action.**
- **Why it matters:** The error branch (`calls-view.tsx`) renders the raw `ApiError` message with no retry button. For a non-technical owner on a shared front-desk computer, that's a dead end — the only fix is a manual page refresh, right at the moment the page is supposed to be reassuring them.
- **Fix:** Add a "Try again" action that re-runs the fetch; distinguish network/auth/empty failure copy.
- **Suggested command:** `/impeccable polish apps/client/src/app/dashboard/calls/calls-view.tsx`

**[P1] No legend for the outcome taxonomy or transcript speaker side.**
- **Why it matters:** "No outcome" is ambiguous to an owner who didn't design the taxonomy — hang-up? wrong number? annoyed caller? Chat bubble side/color (assistant vs. caller) has to be memorized on every visit, with no label. Both work against "verification over configuration" — the page should explain itself, not require the owner to have absorbed the data model.
- **Fix:** A small inline hint or tooltip near the Outcome header defining each state in plain language; a subtle "Agent"/"Caller" label on each chat bubble.
- **Suggested command:** `/impeccable shape calls-outcome-legend`

**[P2] Zero efficiency tooling for repeat, all-day use.**
- **Why it matters:** PRODUCT.md frames this as checked "between other tasks... short sessions," repeatedly. No sort control, no date grouping, and the outcome/q filters that already exist server-side aren't exposed anywhere in the UI (a deliberate scope decision this session, not an oversight — flagging it here as the natural next increment, not a defect).
- **Fix:** At minimum, confirm/display newest-first ordering and a lightweight "Today / Earlier" grouping before adding full filter UI.
- **Suggested command:** `/impeccable shape calls-list-scanning`

**[P2] Dialog close button measures 16×16px — below the 44×44 minimum tap target, and this is shared, not page-specific.**
- **Why it matters:** Measured directly in the mobile Playwright pass. This comes from `packages/ui/src/components/dialog.tsx`'s `DialogPrimitive.Close` (no padding beyond the icon's own box), so it affects every Dialog in the app — MobileNav included — not just this page. Small but real friction for a shop owner tapping on a phone.
- **Fix:** Add `p-2` (or similar) padding to the Close trigger in the shared Dialog component so the visual icon stays small while the hit area grows to ~44×44.
- **Suggested command:** `/impeccable audit packages/ui/src/components/dialog.tsx`

**Not counted as a priority issue — a seed-data artifact worth a real question anyway:** the org-B screenshot shows a "No outcome" row with a "REF-b-1" booking reference. Verified this is an artifact of my own manual-verification seed script (it attached a bookingReference to the first seeded call unconditionally, regardless of outcome) — not a bug in the page or the API. It does surface a legitimate question for the underlying `call-transcripts` service (out of this session's scope, which only added the read/list path): should the API reject or null out `bookingReference` when `outcome !== BOOKED`? Flagging, not fixing.

## Persona Red Flags

**Alex (power/analytical user):** No sort, filter, export, or keyboard way to jump between rows without closing the dialog each time — tedious past roughly 10 calls in one sitting.

**Sam / non-technical shop owner (project persona, primary audience per PRODUCT.md):** Two flags. (1) The same mobile-overflow gap as P0 — this persona is explicitly described as checking on a phone. (2) The full customer phone number and full private conversation render with no masking and no dialog auto-timeout; multi-tenant isolation is solid server-side (proven by the two-org screenshots — org A sees only its 2 rows, org B only its 1), but a walk-up customer standing near a shared front-desk screen isn't stopped by a login boundary, and the design gives that scenario no attention.

**Riley (stress tester):** Nothing broke technically — zero console errors or page errors across desktop and mobile automated passes, and the dialog itself (as opposed to the table) adapts correctly to phone width with no text truncation.

## Minor Observations

- Loading state is plain, unstyled text — doesn't match the shadow-lg/rounded card language the rest of the page uses, feels unfinished as the first thing a user sees.
- `empty-state.tsx` stacks two near-duplicate messages (the passed `description` plus a hardcoded "Nothing here yet.") inside one small card.
- Desktop dialog width (`sm:max-w-lg`, ~512px) leaves a lot of unused canvas on a wide monitor for a long transcript.
- No call duration or turn-count visible in the table row — an owner can't tell a 10-second hang-up from a 5-minute conversation before opening the dialog, which cuts against "scan first."
- Detector confirms: no reintroduced side-stripe nav border, no guessed status-color misuse — the known anti-patterns this project has hit before were not repeated here.

## Questions to Consider

1. "No outcome" could mean a wrong number, a hang-up, or an annoyed caller — should the AI classify a sub-reason before this label reaches an owner who never designed the taxonomy?
2. Multi-tenant isolation is proven solid at the data layer — should the design layer also defend the shared front-desk screen (e.g., blur the phone number until hover, auto-close the dialog after idle), since who's standing near the screen isn't controlled by login?
3. `GET /call-transcripts` returns every call ever, unpaginated — fine at 1-2 rows now, but does "scan first" quietly become "scroll forever" once an org passes ~50 calls, and is that worth designing for now rather than retrofitting under pressure later?
