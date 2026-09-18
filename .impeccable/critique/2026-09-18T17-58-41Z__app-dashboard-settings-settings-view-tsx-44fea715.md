---
target: dashboard settings page (Manage Organization)
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:C:\\Users\\user\\Documents\\Development\\saHei\\apps\\client\\src\\app\\dashboard\\settings\\settings-view.tsx"
target_fingerprint: "sha256:42d41137b11c966904cdcb3a6b04b756f7162d596f6f901ddfb5bbe5e12141c5"
target_path: "C:\\Users\\user\\Documents\\Development\\saHei\\apps\\client\\src\\app\\dashboard\\settings\\settings-view.tsx"
timestamp: 2026-09-18T17-58-41Z
slug: app-dashboard-settings-settings-view-tsx-44fea715
---
Method: dual-agent (A: general-purpose design-review agent · B: general-purpose detector/browser-evidence agent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | "Saved." vanishes silently on next edit, no `aria-live` |
| 2 | Match System / Real World | 2 | Business hours model has no "closed" state — every day forced open/close |
| 3 | User Control and Freedom | 2 | No unsaved-changes guard; instant no-confirm delete on authority-number rows |
| 4 | Consistency and Standards | 2 | Business Hours + Authority Numbers get a bordered box, other 5 fields don't — no rule |
| 5 | Error Prevention | 1 | No close>open validation, no phone format check, one-click destructive delete |
| 6 | Recognition Rather Than Recall | 3 | Labels/placeholders clear, standard pattern |
| 7 | Flexibility and Efficiency | 2 | No "same hours every day" shortcut — 7 rows hand-edited even when identical |
| 8 | Aesthetic and Minimalist Design | 3 | Flat, minimal fields, decent whitespace; hurt by missing section headers |
| 9 | Error Recovery | 1 | Load/save errors are dead-end plain text, no retry action |
| 10 | Help and Documentation | 1 | One caption + placeholders only; nothing for a first-timer |
| **Total** | | **20/40** | **Acceptable — needs real work** |

## Design Specificity Verdict

**LLM assessment**: Generic. This is a stock shadcn form scaffold (Card, Label, Input, Textarea, gap-4 flex) that could belong to any SaaS — invoicing, CRM, gym management. No Wire Blue beyond the Save button, no phone/waveform motif, all borders neutral gray. Only SaHei-specific touches are the `nameLocal` Malayalam placeholder and the word "callers" in the notes placeholder. Nothing here says "this is where you check on your AI phone agent."

**Deterministic scan**: `impeccable detect --json` on `settings-view.tsx`, `business-details-fields.tsx`, `authority-numbers-field.tsx` — **0 findings, exit code 0**. Clean baseline: none of the banned AI-slop patterns (gradient text, kicker/eyebrow labels, colored left-borders, etc.) are present. This confirms the page isn't *sloppy*, just generic — the detector doesn't (and can't) catch "could be any product."

**Visual overlays**: Unavailable this run — no browser/screenshot or DOM-injection tool was exposed to either assessment agent in this environment (confirmed via `ToolSearch` across multiple queries; `WebFetch` explicitly can't reach `localhost`). No live-server injection was attempted since nothing could load `detect.js` into the page or read console output back. Source-level review only.

## Overall Impression

Functionally sound and honest (no fake data, no fake urgency), but generic and cognitively heavy for what PRODUCT.md says this audience actually does: short, interruptible sessions on a phone. The single biggest risk isn't visual — it's silent data loss with no unsaved-changes guard, on a page explicitly used in an interrupt-prone pattern.

## What's Working

1. **`onChange={() => setSaved(false)}` on the form** — invalidates a stale "Saved." message the instant the user touches a field again. Stops false confidence about save state.
2. **Honest async Save button** — disabled + "Saving…" while submitting, no double-submit possible.
3. **Authority Numbers helper copy** — "Not active yet — coming in a future update." Honest, no fake urgency, matches PRODUCT.md's "trust reads as clarity, not decoration."

## Priority Issues

**[P0] No unsaved-changes guard**
Why it matters: PRODUCT.md's usage pattern is interrupted short sessions ("reacting to a specific call or missed booking"). Navigating away mid-edit (sidebar click, browser back) discards everything silently — this is the exact failure mode most likely to hit real users.
Fix: track a dirty flag, block navigation or confirm on dirty unmount.
Suggested command: `/impeccable harden`

**[P1] Error states dead-end**
Why it matters: `loadError`/`saveError` render as bare alert text with no retry action — a user on a phone has no way forward but to manually reload.
Fix: add a "Try again" action beside both error states that re-triggers the fetch/submit.
Suggested command: `/impeccable harden`

**[P1] Business hours can't express "closed"**
Why it matters: `defaultBusinessHours()` seeds every day open 9-6 with no closed toggle. Real shops close a day a week; wrong hours feed straight into the AI agent's booking logic — this is a real-world mismatch, not cosmetic.
Fix: a per-row "Closed" checkbox that disables that row's time inputs.
Suggested command: `/impeccable adapt`

**[P2] Inconsistent section chrome**
Why it matters: Business Hours and Authority Numbers get a bordered box; the other five fields sit bare with no section headings anywhere in the card. Reads as arbitrary rather than authored.
Fix: add section headings and apply one consistent box treatment.
Suggested command: `/impeccable layout`

**[P2] Authority Numbers always fully expanded for a dead feature**
Why it matters: A full add/remove list is always visible for a feature that doesn't do anything yet, stacked directly under a 14-input hours grid — real cognitive load for zero present payoff on a scan-first page.
Fix: collapse it behind a closed-by-default disclosure ("Add authority numbers — optional, upcoming feature").
Suggested command: `/impeccable distill`

## Persona Red Flags

**Alex (Power User)**: No "same hours every day" shortcut — 7 rows hand-edited even when identical. Combined with the P0 data-loss gap, a fast power-user edit is the highest-risk pattern for silent loss.

**Sam (Accessibility-Dependent)**: "Saved." is a bare `<p>` with no `role="status"`/`aria-live` — sighted users get visual confirmation, screen-reader users get nothing (the error path correctly uses `role="alert"`; success doesn't match it).

**Jordan (First-Timer)**: No section headings, and no visible distinction between the one required field (`org-name`) and five optional ones. Authority Numbers' purpose (a dead feature) is explained only in one small caption easy to skip past.

## Minor Observations

- `type="time"` native input for hours is the right call — platform-native over a picker library.
- The remove-row button carries a per-row `aria-label` — good, just has no visible label/tooltip.
- Phone placeholder `+919999999999` implies India-only E.164 format but nothing validates or masks it — any string saves fine.
- `SettingsSkeleton` (4 generic bars) doesn't match the real form's shape (6 fields + 7-row grid + dynamic list) — causes a layout jump on load.
- Detector clean run (0 findings) is a real positive signal on its own: no banned slop patterns present anywhere in the three files.

## Questions to Consider

- Business Hours (changes rarely) and Authority Numbers (set-once, currently inert) share one big Save button with the identity fields — would per-section autosave fit the interruption-prone usage pattern better than one flat form?
- Authority Numbers does nothing today — does shipping the collection UI now net-negative on confusion versus holding it until the lookup feature ships alongside it?
- Is a flat scrolling form even right for this mix (identity + recurring schedule + contact list), or would a tabbed/stepped layout cut the "14 inputs visible at once" load?
