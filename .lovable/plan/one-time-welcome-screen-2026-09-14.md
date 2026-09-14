# One-Time Welcome Screen

## Goal
Add a friendly, mobile-first welcome page for newly verified Marketa users. It will appear once, after identity verification and MPIN setup, before the marketplace feed.

## User experience
- Add a protected `/welcome` page using Marketa’s existing blue, white, and neutral design system.
- Show a personalized heading using the profile first name, with a safe account-name fallback.
- Confirm that the account is verified and ready.
- Present one concise introduction and three responsive cards:
  1. **Post** — add photos, price, description, and category.
  2. **Browse** — use search, filters, categories, and saved items.
  3. **Buy** — contact the seller, agree through the transaction flow, follow its status, and confirm completion.
- Use clear line icons and a single-page layout: stacked cards on phones, three columns on wider screens.
- Add **Explore the Marketplace** as the primary action and **I’ll explore on my own** as the secondary action. Both complete onboarding and open `/browse`.
- Include a subtle three-step progress treatment within the walkthrough, without turning the page into a carousel.

## One-time behavior
- Add `has_seen_onboarding` to each profile, defaulting to `false` for future accounts.
- Backfill existing profiles to `true`, so this screen is limited to new users as requested.
- Extend the authenticated user status with the onboarding flag and a refresh method.
- After email verification, KYC approval, and required MPIN setup, route a new user to `/welcome`.
- If a verified user with an MPIN has not completed onboarding, prevent direct marketplace navigation from bypassing the welcome page.
- On either welcome-page action, save the flag first, then navigate to `/browse`; show a retryable error if saving fails.
- Admin accounts continue directly to the admin area.

## Technical changes
- Database migration: extend `public.profiles`; preserve its current ownership rules and grants.
- Authentication/gating: update the existing profile-status load and verification gate.
- Navigation: update the successful MPIN setup destination and verified-login destination handling.
- UI: add the welcome page and register its route.
- Use the existing Button component, semantic color tokens, Lucide icons, and current typography.

## Validation
- Test a new verified user through MPIN setup, welcome completion, refresh, sign-out, and later sign-in.
- Confirm both actions persist completion and land on `/browse`.
- Confirm existing users and admins do not receive the new-user welcome.
- Confirm unverified users cannot open `/welcome` and direct URL bypass is blocked.
- Check phone and desktop layouts for readable, non-overlapping cards and controls.
