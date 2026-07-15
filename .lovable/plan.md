
## Goal

Swap the current `Step2Liveness` inside `src/pages/Verify.tsx` for a new active-liveness implementation powered by MediaPipe FaceMesh (loaded via CDN). Nothing else in the file changes.

## Scope

- Only `Step2Liveness` in `src/pages/Verify.tsx` is rewritten.
- `IDVerification`, `Stepper`, `PendingPanel`, `SuccessPanel`, and the default `Verify` export stay byte-identical.
- No npm installs; MediaPipe loaded via `<script>` tags injected into `document.head`.
- Existing edge function contract preserved: `supabase.functions.invoke("verify-liveness", { body: { action, frames } })`.

## New Step2Liveness behavior

1. **CDN loader**
   - On mount, inject (if not already present) two script tags into `<head>`:
     - `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js`
     - `https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js`
   - Await both `load` events, then instantiate `FaceMesh` (with `locateFile` pointing at the jsdelivr CDN) and `Camera`. Show a "Loading face detection…" state until ready.

2. **Challenge pool** (pick 4 at random per session, no repeats):
   - `blink` — EAR from left `[362,385,387,263,373,380]` + right `[33,160,158,133,153,144]`; count a blink when avg EAR drops below `0.20` then recovers above `0.25`. Require **2 blinks**.
   - `smile` — `dist(61,291) / dist(234,454) > 0.48`.
   - `turn_left` — `landmark[1].x - (landmark[234].x + landmark[454].x)/2 < -0.07`.
   - `turn_right` — same expression `> 0.07`.
   - `look_up` — `(y1 - y10) / (y152 - y10) < 0.40`.
   - `look_down` — same ratio `> 0.60`.

3. **Sequential UX**
   - Show one challenge at a time with prompt + "Challenge N of 4" progress.
   - On pass, wait 1s (with a brief "✓ Passed" flash), then advance.
   - Live video preview with an overlay showing current instruction.

4. **Frame collection**
   - While challenges run, every 800ms draw the current video frame to an offscreen canvas (640×480) and push the JPEG base64 (`toDataURL('image/jpeg', 0.82)`) into a `frames` array, capped at **10 frames**.
   - After all 4 challenges pass, capture one final snapshot and append (still respecting the 10-frame cap; final frame replaces oldest if full).

5. **Server call**
   - Map first challenge → `action.key`:
     - `blink` → `"blink"`
     - `smile` → `"smile"`
     - `turn_left` / `turn_right` → `"turn_head"`
     - `look_up` / `look_down` → `"turn_head"` (fallback)
   - Call:
     ```ts
     supabase.functions.invoke("verify-liveness", {
       body: { action: action.key, frames },
     })
     ```

6. **Result UI**
   - Same visual pattern as current version: green card on pass (with score + reason), red card on fail, "Try again" resets state.
   - Uses existing shadcn `Button` and current Tailwind card classes.

7. **Cleanup**
   - On unmount or reset: stop `MediaStream` tracks, call `camera.stop()`, close `faceMesh`, clear interval for frame capture, and null refs.

## Technical notes (for implementer)

- Types: declare `window.FaceMesh` / `window.Camera` as `any` locally to avoid adding `@types/*`.
- Phases: `loading | ready | running | submitting | result`.
- Use refs for `videoRef`, `canvasRef`, `faceMeshRef`, `cameraRef`, `framesRef`, `blinkStateRef` (below-threshold latch + count).
- Randomize challenges with a Fisher–Yates shuffle over the 6 keys, take first 4.
- Guard against double-advance by using a "cooldown" flag per challenge; smile/turn/look require the condition to hold for ~300ms (3 consecutive detections) to avoid flicker.
- Keep imports already present in `Verify.tsx` (Button, supabase, etc.); no new deps.

## Out of scope

- No changes to the edge function.
- No changes to other components, styling primitives, or the routing.
- No new packages.
