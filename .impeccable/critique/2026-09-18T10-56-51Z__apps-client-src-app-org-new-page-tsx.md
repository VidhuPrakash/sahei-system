---
target: phone number request step (apps/client/src/app/org/new/page.tsx PhoneNumberStep)
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\user\\Documents\\Development\\saHei\\apps\\client\\src\\app\\org\\new\\page.tsx"
target_fingerprint: "sha256:b967e9f5570882db5c568e79d73cf80023271504fe8ef4e3c6f1faaefc574a3e"
target_path: "C:\\Users\\user\\Documents\\Development\\saHei\\apps\\client\\src\\app\\org\\new\\page.tsx"
timestamp: 2026-09-18T10-56-51Z
slug: apps-client-src-app-org-new-page-tsx
---
Method: dual-agent (A: isolated code-level review — no browser tool exposed in its sandbox, disclosed by the agent itself · B: isolated detector + live Playwright browser evidence against the running dev server). Both ran as separate sub-agents per the critique's isolation requirement; A's own lack of browser access is a coverage gap within its report, not an orchestration degradation, and B's live evidence fills that gap below.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Loading/submit/confirmation states all exist; B confirms the two 403/404 network responses during load are expected-and-handled, not app errors. No inline validation before submit. |
| 2 | Match Between System and Real World | 3 | Grounded, correct Indian telecom copy (Mobile/Landline/Toll-free), but "Plan amount" collides in name with the unrelated subscription-tier "Plan" step one screen earlier. |
| 3 | User Control and Freedom | 1 | The `Stepper` is decorative only — no back navigation anywhere in the 3-step wizard, no way to revisit business details or plan tier once past them. |
| 4 | Consistency and Standards | 3 | Shares `RadioCard`/`Stepper`/`Button` with sibling steps correctly; one small labeling inconsistency (below). |
| 5 | Error Prevention | 1 | No client-side format hint for the E.164 forwarding-number field; no pre-submit recap of source + line type + price before an irreversible-feeling "Request phone number" click. |
| 6 | Recognition Rather Than Recall | 2 | B confirms only the currently-selected line type's price renders at a time (Mobile ₹999 → Landline ₹599 → Toll-free ₹1799, one at a time) — comparing options means remembering the previous price. |
| 7 | Flexibility and Efficiency of Use | 2 | B confirms the line-type group has real native keyboard accelerators (arrow-key move-and-select with a visible focus ring, verified via computed `box-shadow`) — genuine credit A couldn't give without browser access. Still no way to skip/defer the step. |
| 8 | Aesthetic and Minimalist Design | 3 | Clean, matches the design system's rounded/lifted-card idiom (B's detector scan found zero pattern-level issues); hierarchy is uniformly flat — the highest-stakes decision on the page carries no more visual weight than any toggle. |
| 9 | Help Users Recognize/Diagnose/Recover from Errors | 1 | Raw backend text (`forwardingFromNumber must be in E.164 format`) and `lastError` render verbatim with no field association. |
| 10 | Help and Documentation | 1 | No guidance anywhere distinguishing Mobile/Landline/Toll-free for a salon/clinic/shop use case; no support link. |
| **Total** | | **20/40** | **Acceptable** (bottom edge — revised up one point from the code-only pass once B's keyboard evidence came in) |

## Design Specificity Verdict

**Mixed, leaning specific in content, generic in execution.** `LINE_TYPE_COPY` models real Indian telecom categories precisely (10-digit mobile, city-code-tied landline, 1800 toll-free) and the whole step encodes a genuine, non-generic product decision: a *request* a staff member fulfills within 48 hours, not an instant self-serve purchase. That's real product thinking, not a copied SaaS pattern.

The execution doesn't carry that specificity forward visually: `RadioCard` has no icon slot, so Mobile/Landline/Toll-free — three products 3x apart in price — render as three identical shells differing only in two lines of text. The "phone + network + waveform" motif PRODUCT.md calls out lives only in the static side panel, never in the form content the user is actually deciding in.

**Deterministic scan**: `impeccable detect --json` on the target file returned exit code 0, zero findings (`[]`) — confirmed genuine (no ignore config or inline suppressions found). This mode is regex-based for non-HTML files, not a full computed-style/layout scan, so a clean result here is weak positive signal, not strong evidence of quality — several real issues below (the sub-44px touch target, the missing `aria-live` regions) are exactly the class of thing this scan mode cannot see and needed the live-browser pass to catch.

**Browser evidence**: no live-server overlay injection was run — the target requires an authenticated app-router session, not a servable static file, so B used direct Playwright automation against the real running dev server instead of the static-file overlay flow. No user-visible overlay is claimed; the findings below come from direct DOM/computed-style/screenshot evidence.

## Overall Impression

The product decision underneath this step is sound and well-modeled; the screen it produced is functionally correct but visually and reassurance-wise flat for what is both a real financial commitment and the last moment of the entire onboarding experience. The single biggest opportunity: this step ends the whole signup flow on "trust us for 48 hours" with no way to check back on it and no summary of what was just requested — for a non-technical owner about to commit to a recurring charge, that's the moment that most needs polish, and today it gets the least.

## What's Working

1. **Progressive disclosure is genuinely well done.** The forwarding-number field and the price line each appear only when contextually relevant, keeping the initial view uncluttered.
2. **Domain-specific, non-generic copy.** `LINE_TYPE_COPY` models real Indian telecom categories instead of a generic "Basic/Pro/Enterprise" abstraction.
3. **The RadioCard group's keyboard semantics are solid, confirmed live.** B's browser evidence shows real native radio-group behavior: Tab lands once on the group, ArrowDown moves and selects between Mobile → Landline → Toll-free with a visible focus ring at every step (confirmed via computed `box-shadow`, not just a screenshot glance) — a genuinely accessible foundation, not just a styled-to-look-right control.

## Priority Issues

**[P1] No way back once you reach this step**
- **What:** The `Stepper` is display-only; nothing in the wizard offers back navigation to revisit business details or the plan tier.
- **Why it matters:** An owner who realizes on this financial-commitment screen that they picked the wrong plan tier has no in-product way to fix it — only abandon or push forward blind.
- **Fix:** Make completed Stepper steps clickable/navigable back, or add an explicit "Back" control on this step.
- **Suggested command:** `/impeccable shape`

**[P1] Submit button falls under the 44×44 touch-target reference on mobile**
- **What:** B's measured bounding box for "Request phone number" is 342×**36**px on the 390px viewport — 8px short of the 44px reference. The three line-type cards themselves are fine (78–98px tall).
- **Why it matters:** This is the single action that commits the request — exactly the control that shouldn't be the one under-sized. Notably, this project already fixed the same class of issue once this session (the shared `Dialog` close button, sized up to 44×44 after a Playwright measurement) — this is a regression against a standard the codebase has already established for itself.
- **Fix:** Increase the submit button's height to at least 44px on this breakpoint (or system-wide, if other primary buttons share the same size).
- **Suggested command:** `/impeccable audit`

**[P1] Backend validation leaks to the user, with no pre-submit safeguard**
- **What:** The forwarding-number field has no client-side format example beyond a placeholder that disappears on typing; a mismatch surfaces the backend's raw message ("forwardingFromNumber must be in E.164 format") verbatim. There's no recap of source + line type + price before the commit click.
- **Why it matters:** A camelCase field name and "E.164" mean nothing to a salon or clinic owner, and there's no chance to double-check the choice before committing to a recurring charge — at odds with the product's own "trust reads as clarity" principle at the exact moment money is implied.
- **Fix:** Map known validation errors to plain-language copy client-side; add a one-line recap ("Requesting: New Mobile number · ₹999/month") above the submit button.
- **Suggested command:** `/impeccable harden`

**[P2] Comparing line-type prices forces recall, not recognition**
- **What:** B confirmed only the active selection's price renders at a time: pick Landline, see ₹599; move to Toll-free, ₹599 disappears and ₹1799 appears. With a 3x spread across the three options, this is exactly the moment price should stay visible, not disappear.
- **Why it matters:** Undermines rather than serves the deliberate "no price until picked" design intent — once the user is actively comparing, hiding prior prices makes the comparison harder, not more considered.
- **Fix:** Once any card has been selected once, show all three prices simultaneously rather than gating to only the current selection.
- **Suggested command:** `/impeccable clarify`

**[P2] "Plan amount" collides with the unrelated subscription-tier "Plan" step**
- **What:** This step's price line is labeled "Plan amount," but "Plan" already names the Starter/Growth/Pro subscription tier chosen one screen earlier — which is itself never priced anywhere.
- **Why it matters:** An owner reading "Plan amount: ₹999/month" here has no way to know if that's the total bill, an add-on, or related to the tier picked minutes ago.
- **Fix:** Rename to something unambiguous ("Number rental: ₹999/month") and disclose the subscription tier's price somewhere in the Plan step.
- **Suggested command:** `/impeccable clarify`

## Persona Red Flags

**Jordan (Confused First-Timer):** No explanation anywhere of *why* she'd pick Mobile vs. Landline vs. Toll-free for her specific shop — just a one-line definition with no recommendation. A mistyped forwarding number surfaces raw backend jargon. Nothing on this screen (or the two before it) explains how or when billing actually happens, so clicking "Request phone number" is a leap of faith — and if she has second thoughts, there's no back button.

**Sam (Accessibility-dependent user):** The good news, confirmed live by B rather than assumed: the RadioCard group's native radio semantics work correctly — real keyboard nav, a visible focus ring at every step, checked state announced correctly. The real gap is what happens *after* a selection: the price line that appears has no `aria-live` region, so a screen-reader user won't hear it appear and must manually re-navigate to find it. The "Request received" success panel has the same gap — no `role="status"`/`aria-live` — while the error paths correctly use `role="alert"`. The negative path is more accessible than the positive one.

**Casey (Distracted mobile user):** Selections live only in `useState` with no draft persistence; an interruption mid-decision (her defining behavior) and a reload loses everything. The sub-44px submit button (P1 above) is exactly the kind of thing that costs her a mis-tap one-handed.

## Minor Observations

- Two uncoordinated "Loading…" states can fire in sequence: the parent page's onboarding-status check, then this step's own `/phone-numbers/me` + `/phone-numbers/pricing` fetch.
- "Go to dashboard" is worded identically for the `PURCHASED` state ("your number is live") and the `AWAITING_APPROVAL` state ("still waiting 48 hours") — two very different states, same button copy.
- `status.lastError` renders with no indication of which field it relates to.
- The "Select a number type" label exists on the line-type group but not on the structurally identical source group above it — a small, unexplained inconsistency.
- B noted the Next.js dev-mode toolbar (the floating "N" circle) visually overlaps the price text at one mobile scroll position — a dev-only artifact, won't appear in production, not a code issue.
- `numberType` deliberately starts unselected with no "recommended for most businesses" signal — reasonable given the pricing-reveal design, but leaves the user with nothing to break the tie among three unfamiliar categories.

## Questions to Consider

- If hiding price at first glance is meant to prevent anchoring, why does the UI also hide the *previous* price the moment a different option is selected — is that serving the original goal, or accidentally blocking comparison once someone is actively deciding?
- The subscription "Plan" tier is never priced anywhere in this wizard — is "Plan amount" on this screen meant to imply that's the only recurring charge, and is that actually true?
- This is the last screen of the entire onboarding. Should "wait up to 48 hours, no visible tracking" really be the note the whole signup ends on, or does the dashboard need to carry this pending request forward?
