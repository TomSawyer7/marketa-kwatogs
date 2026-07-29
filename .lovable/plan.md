## Goal
Users can no longer edit their display name. It is always the name established by identity verification (the name extracted from their ID during KYC).

## What changes

**Account settings (`src/pages/Settings.tsx`)**
- Display name becomes a read-only field: disabled input (muted styling), not editable, no validation errors possible.
- Helper text under it:
  - Verified users: "Locked to your verified ID name. Contact support if this is incorrect."
  - Not-yet-verified users: "Your display name will be set automatically once your ID is verified."
- Remove `name` from the edit form's validation schema and from the "Reset" behavior's editable fields (email, location, bio, avatar, notifications, privacy stay editable).

**Profile save (`src/store/marketa.tsx`)**
- `updateProfile` stops writing `name` to the `profiles` table, so the field can't be changed via the client even if the UI is bypassed.

**Where the name comes from**
- No backend change needed: the admin approval path already writes the verified full name from the ID into `profiles.name` (and `verified_users.full_name`) when a submission is approved. Settings will simply display whatever that produced.

## Technical notes
- Verified state read from `useAuth().isVerified` (already available).
- No database migration and no RLS change in this plan. Note: a determined user could still update `profiles.name` directly through the API; if you want it hard-locked server-side too, say so and I'll add a trigger that blocks name changes for verified accounts.
