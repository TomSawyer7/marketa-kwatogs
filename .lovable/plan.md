

## Plan: Reduce redundant auth buttons on the landing page

The landing page currently shows **4 auth-related buttons** for logged-out users, which is redundant:
- Header: `Log in` + `Sign up`
- Hero: `Get Started` + `Sign In`

All four point to the same `/auth` route.

### Recommended approach (best practice)

Keep **one primary CTA per zone**, with clear hierarchy:

**Header** (utility nav — secondary):
- Keep `Log in` (ghost button) — for returning users
- **Remove** `Sign up` (redundant with hero CTA)

**Hero** (primary conversion zone):
- Keep `Get Started →` (primary button) — main CTA for new users
- **Remove** `Sign In` (already available in header)

### Result
From 4 buttons → 2 buttons, with a clean hierarchy:
- New visitor's eye goes to the bold `Get Started` in the hero
- Returning users glance to the top-right `Log in`
- No duplicate actions competing for attention

### Files to change
- `src/pages/Landing.tsx`
  - Remove the `Sign up` button in the header (lines ~59-61)
  - Remove the `Sign In` outline button in the hero (lines ~104-106)

This follows the standard SaaS landing pattern used by Stripe, Linear, Vercel, etc. — one hero CTA, one header login link.

