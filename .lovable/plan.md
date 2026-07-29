## Plano: Ayusin ang Step2Liveness Bugs

Gagawin ang mga sumusunod na surgical edits sa `src/pages/Verify.tsx` sa loob ng `Step2Liveness` component. Hindi babaguhin ang UI, imports, o iba pang logic.

### 1. Smile detection ratio fix
Palitan ang `smile` condition sa `evaluateChallenge`:
- Tanggalin ang `dist()` para sa `mouthW` at `faceW`.
- Gumamit ng `Math.abs(x1 - x2)` ratio.
- I-baba ang threshold mula `0.48` patungo `0.42`.

### 2. Mas malalaking frames para sa Gemini AI
Palitan ang `captureFrame` function:
- Gamitin ang buong native `videoWidth`/`videoHeight` sa halip na fixed 640×480.
- Taasan ang JPEG quality mula `0.82` patungo `0.92`.

### 3. Head turn thresholds
Palitan ang `turn_left` at `turn_right` thresholds sa `evaluateChallenge`:
- Mula `±0.07` patungo `±0.05`.

### 4. Look up / look down thresholds
Palitan ang ratio condition para sa `look_up` at `look_down`:
- Mula `< 0.4` / `> 0.6` patungo `< 0.42` / `> 0.58`.

### 5. Hold frames threshold
Palitan ang hold check:
- Mula `holdRef.current < 3` patungo `holdRef.current < 2`.

### Files to edit
- `src/pages/Verify.tsx` — 5 localized replacements sa `Step2Liveness`.

### Verification
- Typecheck via `tsgo` o `bun run build`.
- Hindi kailangang baguhin ang edge function dahil ang `face_match_score` ay tama nang ginagamit sa success path; ang error path lamang ang nagre-return ng `score: 0`, na inaasahan.