# Legal & User Agreement Module

Additive module — no changes to auth/KYC/MPIN/marketplace/messaging/trust/behavioral/audit logic. Only integration points are: registration checkbox, KYC certification checkbox, footer, Settings tab, and one new DB table for acceptance records.

## 1. Database (migration)

New table `public.legal_acceptances` to persist consent for audit:

```
user_id uuid, document text ('terms'|'privacy'|'kyc_certification'),
version text, accepted_at timestamptz, ip inet null, user_agent text null,
context text ('registration'|'kyc'|'settings')
```

- GRANTs: `authenticated` insert/select own; `service_role` all. RLS: users read/insert own; admins read all (via `has_role`).
- Constants file `src/lib/legal-version.ts` exports current version string (e.g. `"2026-07-29"`).

## 2. Legal content

- `src/content/legal/terms.tsx`, `privacy.tsx`, `community.tsx` — structured section arrays `{ id, title, body }` so pages auto-generate the TOC.
- Full professional copy for all sections listed in the request; Privacy Policy aligned with RA 10173 (Philippine DPA); Terms governed by Philippine law.

## 3. Pages (public routes)

New routes in `src/App.tsx`, above catch-all, unauthenticated-friendly:
- `/legal/terms` → `Terms.tsx`
- `/legal/privacy` → `Privacy.tsx`
- `/legal/community` → `Community.tsx`
- `/contact` → `Contact.tsx` (simple email + form info; no backend)

Shared `LegalLayout` component:
- Sticky sidebar TOC (desktop) / collapsible TOC (mobile)
- Reuses `AppShell` (Header + Footer), Back button, `prose` typography via Tailwind
- Section anchors, "Last updated" date, print-friendly

## 4. Footer

New `src/components/layout/Footer.tsx` with **Legal** column: Terms, Privacy, Community, Contact.
Add `<Footer />` inside `AppShell` after `<main>`. Existing pages remain untouched because they render through `AppShell`. For pages that don't use AppShell (Landing, Auth, Verify), include the footer directly or wrap in a minimal `PublicShell`.

## 5. Registration (Auth.tsx)

- Add controlled `agreed` state + `Checkbox` above Create Account.
- Label: "I have read and agree to the [Terms & Conditions](/legal/terms) and [Privacy Policy](/legal/privacy)." Links open in new tab.
- Zod schema requires `agreed === true`.
- Button `disabled={!agreed || busy}`.
- On successful signUp, insert two `legal_acceptances` rows (terms, privacy) with current version + `context:'registration'`. Done client-side after session available; failure is logged but does not block signup.

## 6. KYC (IDVerification component)

- Add certification `Checkbox` on the review/submit step with the required text.
- Submit button disabled until checked.
- On submit success, insert `legal_acceptances` row `document:'kyc_certification'`, `context:'kyc'`.

## 7. Settings — Legal tab

Add new "Legal" section to `src/pages/Settings.tsx`:
- Three cards linking to Terms, Privacy, Community
- Shows current document version + user's last-accepted version (from `legal_acceptances`)
- "Re-accept latest" button when version differs → inserts row with `context:'settings'`

## 8. Audit logging

Fire-and-forget `logEvent({ category:'legal', action:'accept_terms'|'accept_privacy'|'accept_kyc_certification', metadata:{ version, context } })` at each acceptance so it appears in the existing Audit Logs workspace.

## 9. Files

**Created**
- `supabase/migrations/<ts>_legal_acceptances.sql`
- `src/lib/legal-version.ts`
- `src/lib/legal.ts` (recordAcceptance helper)
- `src/content/legal/{terms,privacy,community}.tsx`
- `src/components/legal/LegalLayout.tsx`
- `src/components/layout/Footer.tsx`
- `src/pages/legal/{Terms,Privacy,Community}.tsx`
- `src/pages/Contact.tsx`

**Edited (minimal, additive)**
- `src/App.tsx` — 4 new routes
- `src/components/layout/AppShell.tsx` — render `<Footer />`
- `src/pages/Auth.tsx` — checkbox + gate + acceptance insert
- `src/components/verify/IDVerification.tsx` — certification checkbox + insert
- `src/pages/Settings.tsx` — Legal section

## Technical notes

- No changes to `use-auth`, MPIN, audit chain, RLS on existing tables.
- Version stored per acceptance enables future re-consent flows without migration.
- Terms/Privacy/Community rendered from typed section arrays → single source drives page + TOC + Settings summary.
- Dark mode inherited from existing tokens; typography via `prose prose-neutral dark:prose-invert`.
