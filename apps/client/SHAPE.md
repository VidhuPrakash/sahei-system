# Shape — apps/client dashboard

Confirmed output of `/impeccable shape client` (Session 13). This is a planning brief, not a build-gating contract — Session 14+ builds from it.

## Job & audience

Org owner (salon/clinic/service-shop, non-technical) checks whether their AI phone agent is working — calls handled correctly, bookings landing. Operate mode: task completion outranks persuasion or exploration.

## Outcome & proof

Primary task: scan today's activity and trust it's correct without opening every transcript. Proof takes the form of itemized entries each carrying an honest status stamp; totals roll up visibly rather than sitting behind a settings-style page.

## Selected direction — "The Daybook Ledger"

Visual world: the bound appointment daybook — ruled rows, ink-stamped status — as the shop's own booking register, now kept by the AI.

- **Palette (Restrained strategy — neutrals + one accent, the Operate-mode default):** `#F3F7F3` off-white paper ground, `#031130` navy ink for structure/text/rules, `#185DF1` blue reserved for a single "live/active" role only.
- **Type:** workaday system stack (no display serif); tabular numerals for times and counts.
- **Composition:** ruled horizontal rows; the three sections (Calls/Transcripts, Bookings/Calendar, Analytics) read as ledger-tab dividers down the side, not top nav tabs.
- **Status:** an ink-stamp overprint — BOOKED / MISSED / CANCELLED / COMPLETED — set at a slight honest rotation, never a colored pill.
- **Craft borrowings** (from the direction round's runner-up challengers, fused into this world rather than copied wholesale):
  - Status changes snap into their stamped state in one decisive step — borrowed from a destination-blind board's step-and-settle discipline, not a soft cross-fade.
  - Anything needing urgent attention gets exactly one additional treatment, a boxed ink-on-paper inversion, never a third color — borrowed from a CRT terminal's disciplined two-state rule.

## Scope & boundaries

Whole system + all four screens (login, calls/transcripts, calendar/bookings, analytics) at this fidelity: shared tokens/components plus one representative populated-state layout per screen.

Anti-goals: nothing playful/gamified or marketing-glossy — no confetti, badges, hero sections, landing-page moves.

Must preserve: the brand colors/logo as given (`apps/client/public/logo.png`); multi-tenant data isolation (one org never sees another's rows).

## States & ranges

Anchored on populated steady-state — calls and bookings already flowing in, since that's what an owner sees day to day. Empty/first-run is a secondary state: a blank ledger page, not a big illustrated welcome screen.

## Interaction & layout

A row is the atomic unit throughout — one call, one booking, one analytics line-total. Mobile collapses rows into stacked index-card entries rather than a cramped table. Transitions are snaps and settles; never bouncy, glowing, or decorative.

## Constraints & open decisions

Left to the Session 14+ build: exact type family pairing, icon set, and the calendar screen's specific grid mechanics.

## Direction-round record

Assigned by the roll: "The Day's Receipt" (thermal-printer receipt roll world). Declined in favor of this session's own top-ranked candidate, "The Daybook Ledger" — a valid alternate pick per Impeccable's process. Runners-up weighed: Destination Blind Board and Starship Terminal (both competitive, craft borrowed above); Nixie Lab Counter, Mesophotic Deep Dive, Miura-Fold Sheet, and Four-Shade Field declined (no resonance with this audience's daily world, or — Four-Shade Field specifically — conflicts with the playful/gamified anti-goal).
