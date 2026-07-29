## Goal
Replace the current "open legal page in a new tab" pattern on the signup form with two in-page modals (Terms, Privacy) that require an explicit "I have read and understood" acknowledgement before the user can click **Agree**. Acceptance for each doc must independently unlock the existing signup checkbox and gate the **Create Account** button. No auth, KYC, MPIN, or business logic changes.

## Scope (files touched)
- New: `src/components/legal/LegalAgreementModal.tsx` — reusable modal shell.
- Edit: `src/pages/Auth.tsx` — swap the single "agreed" checkbox for two independent flags (`termsAgreed`, `privacyAgreed`), wire modal triggers, update button gating and acceptance recording.

Nothing else changes. Legal content (`src/content/legal/terms.tsx`, `privacy.tsx`), versioning (`src/lib/legal-version.ts`), acceptance recording (`src/lib/legal.ts`), and the standalone `/legal/*` pages stay exactly as they are.

## Modal component
`LegalAgreementModal` built on the existing shadcn `Dialog` primitive to match the design system.

Props:
- `open`, `onOpenChange`
- `doc: LegalDoc` (reuses existing `termsDoc` / `privacyDoc`)
- `version: string`
- `onAgree: () => void`

Behavior:
- Sticky header: title + version/last-updated line + close (X) button.
- Scrollable body: renders `doc.intro` and `doc.sections` using the same typography as `LegalLayout`, so formatting stays consistent.
- Sticky footer: acknowledgement checkbox ("I have read and understood this document.") + `Close` and `Agree` buttons. `Agree` is disabled until the checkbox is ticked.
- ESC and outside-click close the modal but do NOT call `onAgree` (override Radix defaults via `onEscapeKeyDown` / `onPointerDownOutside` — they still close, they just don't accept).
- Accessibility: `DialogTitle`, `DialogDescription`, focus trap from Radix, checkbox has a proper `<Label>`, `Agree` is keyboard reachable.
- Responsive: `max-w-2xl w-[95vw] max-h-[90vh]` with an inner scroll container; body scroll locked by Dialog, background page unaffected.
- Resets the internal "understood" checkbox each time the modal opens so re-opening requires a fresh acknowledgement.

## Auth page changes
In `src/pages/Auth.tsx`:
- Replace `agreed` state with `termsAgreed` and `privacyAgreed`.
- Add `termsOpen` / `privacyOpen` modal state.
- Rebuild the consent row: a single disabled checkbox reflecting `termsAgreed && privacyAgreed` (kept visible for clarity, but users toggle it via the modals per requirement #6, so the checkbox itself is read-only). Two inline links "Terms & Conditions" and "Privacy Policy" open their respective modals instead of navigating.
- On modal `onAgree`, set the matching flag to `true` and close the modal.
- `Create Account` button `disabled={busy || !termsAgreed || !privacyAgreed}`.
- `onSignup` guard updated to check both flags; existing `recordAcceptance("terms", …)` and `recordAcceptance("privacy", …)` calls stay — they already persist user id, document, version (from `LEGAL_VERSIONS`), context, and timestamp, satisfying requirement #8.

## Out of scope (explicitly untouched)
- KYC certification checkbox in `IDVerification.tsx`.
- Settings → Legal section.
- Footer, routing, existing `/legal/*` pages.
- `legal_acceptances` schema, RLS, or `recordAcceptance` implementation.

## Verification
- `tsgo` typecheck.
- Manual: open `/auth` → Sign up tab → confirm Create Account disabled, click each link → modal opens with sticky header/footer, Agree disabled until "understood" ticked, ESC closes without accepting, Agree flips the consent flag, both flags required to enable Create Account, submit records acceptance rows with correct versions.
