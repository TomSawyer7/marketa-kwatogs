## Goal

Reorder KYC to: **ID Upload → Data Extraction → Liveness Check → Admin Review (full package) → Verified**. Liveness runs immediately after extraction, its frames and a short video clip are stored, and the admin approves only after seeing the ID data, the liveness footage, and the confidence score.

## New status flow

| Status | Meaning |
|---|---|
| `awaiting_liveness` | ID uploaded + OCR extracted, liveness not yet done |
| `pending` | Liveness completed and submitted — awaiting admin review |
| `verified` | Admin approved the full package (grants marketplace access) |
| `rejected` | Admin rejected |

`id_approved` is retired as a gate; existing rows in that state get migrated to `awaiting_liveness`, existing `verified` rows stay verified.

## Database & storage

- New private bucket `liveness-media` (user-scoped paths `{user_id}/...`), RLS: user can insert/read own, admins read all, service role full.
- `verifications` new columns: `liveness_frame_paths text[]`, `liveness_video_path text`, `liveness_checked_at timestamptz`, `liveness_score numeric` (score already exists as `face_match_score`, keep it as the confidence value and add the recording fields).
- Update the `status` check constraint to include `awaiting_liveness`.
- Admin approval writes `status='verified'`, `verified_at`, sets `profiles.is_verified = true`, and upserts `verified_users` (moved from the current `approve_id` path).

## Frontend — `src/pages/Verify.tsx`

- Stepper becomes: ID Upload → Liveness → Admin Review → Verified.
- Routing by status: `null`/`rejected` → `IDVerification`; `awaiting_liveness` → `Step2Liveness`; `pending` → `PendingPanel` (now shows extracted data + "liveness submitted, awaiting review"); `verified` → success.
- `Step2Liveness`: alongside the existing MediaPipe challenge logic, start a `MediaRecorder` on the camera stream at session start and stop it at finalize. On finalize, upload the webm clip and the collected JPEG frames to `liveness-media`, then call `verify-liveness` with the frame data plus the storage paths.
- After a pass, the user lands on the pending-review panel instead of the marketplace.

## Backend

**`verify-liveness`**: accept `awaiting_liveness` (instead of requiring `id_approved`); persist `liveness_passed`, `face_match_score`, `liveness_frame_paths`, `liveness_video_path`, `liveness_checked_at`; set status to `pending` on pass (retry allowed on fail, status stays `awaiting_liveness`). It no longer sets `profiles.is_verified`.

**`admin-verification-action`**:
- `list` / `signed_urls` also return signed URLs for the liveness video and each frame.
- Rename the decision action to `approve` → sets `verified` + `is_verified` + `verified_users` upsert; keeps the existing eVerify-passed precondition.

## Admin UI — `src/components/admin/SubmissionDetail.tsx`

Add a **Liveness check** section between the extracted data and the ID document images:
- video player for the recorded clip,
- horizontal thumbnail strip of captured frames (click to enlarge),
- confidence score shown prominently as a numeric badge with a pass/fail chip,
- ID front photo rendered next to the liveness media for side-by-side face comparison.

Filters/stat counts in `Admin.tsx`, `StatsHeader`, `SubmissionList`, and `StatusBadges` updated for the new status set.

## Technical notes

- MediaRecorder uses `video/webm;codecs=vp9` with fallbacks; clip capped by stopping at finalize (typically 15–30s).
- Frames stay JPEG data URLs for the AI call, and are additionally uploaded as files for admin playback.
- `VerificationGate` / `use-auth` need no change — access still keys off `profiles.is_verified`, which now only flips on admin approval.
