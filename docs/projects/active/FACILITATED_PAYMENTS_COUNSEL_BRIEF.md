# Counsel Briefing Memo — Payment Facilitation for FieldLogicHQ

> **Purpose:** Pre-read for a short engagement with Canadian fintech/payments counsel. Everything below is our intended design; we are seeking confirmation of the regulatory posture **before** building. Prepared 2026-07-28.

## 1. Who we are

FieldLogicHQ — a small Ontario-based SaaS (sole operator) providing club/league/tournament management software to Canadian amateur sports organizations. Today we bill our customers (the organizations) subscription fees via Stripe. **No participant money moves through the platform today** — organizers collect team registration fees offline (e-transfer/cheque) and record them manually in our software.

## 2. What we intend to build

Tournament organizers (our customers — Canadian sports clubs/associations) collect team registration fees (typically CAD $300–$1,500 per team, dozens of teams per event) from registering teams/parents **through our web app**, using **Stripe Connect**:

- Each organizer opens their **own Stripe connected account** (Express-type hosted onboarding; **Stripe performs all KYC/identity collection**, not us).
- At registration, the payer completes a **Stripe-hosted checkout**; the charge is created **directly on the organizer's connected account** (Stripe "direct charges"). Card data never touches our servers (PCI SAQ-A posture).
- **Funds never enter a bank account or Stripe balance that FieldLogicHQ owns or controls.** The payer's funds settle to the organizer's connected account; Stripe pays out to the organizer's bank.
- FieldLogicHQ earns a **platform application fee** per transaction, which Stripe routes to our own (separate) Stripe balance as part of the charge mechanics.
- Payment rails: credit/debit cards and Stripe's Canadian **pre-authorized debit (ACSS/PAD)**.
- Risk controls we intend to configure on organizer accounts: **delayed payouts until after the event** and/or **rolling reserves**, using Stripe's per-connected-account settings; dispute/chargeback liability sits with the organizer's account first (loss backstop configuration TBD with your input).
- Three-party terms of service: organizer is the merchant of record, sets and honors the refund/cancellation policy, and indemnifies the platform.

## 3. Questions we need answered

1. **RPAA (Bank of Canada):** Under the December 2025 marketplace case scenarios / supervisory policy for online marketplaces, does the design above keep FieldLogicHQ **outside** "payment service provider" registration? Specifically:
   a. Does the direct-charges flow (funds never in an account we own/control) match the non-PSP marketplace scenarios?
   b. Does our **application fee** being routed through the payment rail to our Stripe balance change the analysis?
   c. Does our ability to **configure payout timing / reserves** on the organizer's connected account amount to "control" over funds?
   d. Fallback: if we instead used Stripe "destination charges" (funds transit our platform balance momentarily), is that squarely the must-register scenario, or is momentary automated pass-through distinguishable?
2. **FINTRAC / PCMLTFA:** Are we an MSB ("receiving payment instructions and acting as an intermediary between payer and payee")? Does the direct-charges design place Stripe — not us — as the intermediary? Any registration or reporting obligation either way?
3. **GST/HST:** Confirm our platform application fee is a taxable supply (software/service fee), not an exempt financial service — and how it should be invoiced/collected (we charge the organizer's account via Stripe's fee mechanics).
4. **CRA Reporting Rules for Digital Platform Operators:** Confirm team-registration fees paid to sports clubs fall outside the four "relevant activities" (goods, immovable property, transport rental, personal services), so we have no platform reporting obligation.
5. **Terms of service:** Review/draft the three-party structure — organizer as merchant of record; refund/cancellation responsibility; event-cancellation scenario (fees collected, event cancelled); indemnification; consumer-protection considerations (Ontario CPA or equivalent) for registrants; anything needed given payers are often parents paying on behalf of minors (PIPEDA disclosure language for Stripe processing incl. cross-border).
6. **Anything we're not asking:** e.g., provincial money-services regimes (Québec), whether our marketing may say "collect payments through FieldLogicHQ," record-keeping/retention obligations for payment metadata.

## 4. Facts that may matter

- Scale at launch: single-digit organizer accounts, low four-figure monthly transaction counts at most; Canada-only; CAD-only.
- We already have Stripe's standard platform agreements and DPA in place for our subscription billing.
- We do not and will not store card data; payment pages are Stripe-hosted.
- Launch target is H1 2027; we want the compliance posture settled before build starts.
