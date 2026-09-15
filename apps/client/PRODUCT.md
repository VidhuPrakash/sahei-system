# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users: small business owners and staff running a SaHei-connected phone line — salon, clinic, or service-shop operators managing their own bookings and customer calls. Not developers; they use the dashboard to check what already happened (calls, transcripts, bookings), not to configure anything technical. The business's own callers never see this dashboard — they only ever talk to the AI phone agent.

## Product Purpose

SaHei lets an organization connect a phone number to an AI agent that answers inbound calls, converses in Malayalam, collects/responds to caller data, and books appointments. The dashboard is where the org owner checks whether that agent is actually doing its job: call outcomes, transcripts, and booking/analytics. Success = an owner can tell, at a glance, that calls are being handled correctly and appointments are landing on the calendar, without needing to listen to every call.

## Positioning

Fluent Malayalam voice conversation (Sarvam STT/TTS tuned for call-center audio) combined with live booking and analytics in one product — not a generic IVR/call-answering add-on bolted onto a CRM. A neighboring English-first or generic-multilingual call bot could not truthfully claim the same call-center-tuned Malayalam quality bundled with real-time appointment booking.

## Operating Context

Org owners check the dashboard between other tasks — likely on a phone or a shared front-desk computer, in short sessions, often reacting to a specific call or missed booking rather than doing systematic review. Multi-tenant: each organization only sees its own org's calls, bookings, and transcripts (better-auth organization plugin).

## Capabilities and Constraints

- Built on Next.js (`apps/client`) + `@sahei/ui` (shadcn/ui primitives — currently only `Button` and `Card` exist, stock neutral theme, not yet themed to brand)
- Auth via better-auth (organization plugin) — login is part of this surface
- Core dashboard content: call outcomes, transcripts, calendar/bookings, analytics
- Backend: NestJS + PostgreSQL + Redis via `apps/api`; the voice pipeline (Exotel/Pipecat/Sarvam/Claude) is a separate real-time service — the dashboard renders its recorded outputs, not a live call feed

## Brand Commitments

- Name: "SaHei" (wordmark capitalizes both halves: Sa/Hei)
- Logo: `apps/client/public/logo.png` — a phone-handset mark built from small connected nodes (network/AI motif) with a blue audio-waveform through the center; dark navy handset + wordmark, bright blue accent for the waveform/nodes, white background.
- Brand colors (binding): `#031130` (dark navy — handset, wordmark), `#185DF1` (blue accent — waveform, nodes), `#F3F7F3` (off-white background)
- Motif to preserve: phone + network/connectivity + soundwave — reads as "AI is listening and connected"; should inform iconography generally, not just literal logo placement

## Evidence on Hand

No screenshots, transcripts, testimonials, or case studies yet — pre-launch. Only concrete asset on hand is `logo.png`. Future work must not fabricate customer quotes, call volume numbers, or before/after metrics.

## Product Principles

1. Verification over configuration — the dashboard proves the agent is working; it isn't a settings/admin surface first.
2. Scan first, read second — an owner should get the "is everything okay" answer without opening a transcript.
3. Multi-tenant boundaries are load-bearing, not decorative — one org's data must never bleed into the visual assumptions of a shared page.
4. Trust reads as clarity, not decoration — this is an operational tool for non-technical owners, not a marketing surface.
