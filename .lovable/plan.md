
## Connect Marketa login/sign-up to your Supabase project

I’ll connect the app to your existing Supabase project:

```text
Supabase URL: https://gsawquzxlrkraylbyitt.supabase.co
Auth key: anon/public key provided
```

The key you shared is the Supabase **anon/public** key, which is safe to use in a frontend app as long as Row Level Security is enabled.

## What will be built

### 1. Supabase client setup

Add Supabase support to the app:

- Install `@supabase/supabase-js`
- Create `src/integrations/supabase/client.ts`
- Store the Supabase URL and anon key in the client setup
- Add a typed placeholder file for future generated database types

### 2. Authentication system

Create a reusable auth provider:

- New `src/hooks/use-auth.tsx`
- Tracks:
  - current user
  - current session
  - loading state
  - sign in
  - sign up
  - sign out
- Uses Supabase best practice:
  - register `onAuthStateChange` first
  - then call `getSession()`

### 3. Login / sign-up page

Add a new `/auth` page with a clean Marketa-style card:

- Tabs for **Log in** and **Sign up**
- Email/password login
- Sign-up with:
  - full name
  - email
  - password
  - confirm password
- Zod validation
- Friendly toast messages
- Redirect logged-in users back to the marketplace/profile flow

### 4. Protected routes

Protect pages that require an account:

- `/sell`
- `/saved`
- `/profile`
- `/settings`

Public pages stay open:

- `/`
- `/item/:id`
- `/seller/:id`
- `/auth`

If a logged-out user clicks Sell, Saved, Profile, or Settings, they will be sent to `/auth`.

### 5. Header updates

Update the top navigation:

Logged out:

- Show **Log in** button
- Keep browsing/search/category navigation available

Logged in:

- Show the user avatar
- Add a dropdown menu with:
  - Profile
  - Settings
  - Log out

### 6. Supabase profiles table

Because Marketa needs user profile/settings data, the database should include a `profiles` table connected to Supabase Auth.

I’ll provide a SQL script for your Supabase SQL Editor that creates:

- `public.profiles`
- Row Level Security
- policies
- trigger to auto-create a profile after signup

Planned schema:

```sql
profiles
- id uuid primary key references auth.users(id) on delete cascade
- name text
- email text
- location text
- bio text
- avatar_url text
- visibility text default 'public'
- notifications jsonb default '{"messages":true,"deals":true,"newsletter":false}'
- created_at timestamptz default now()
- updated_at timestamptz default now()
```

Security rules:

- Users can read their own profile
- Users can update only their own profile
- Profile rows are automatically created on signup
- No roles will be stored on the profile table

### 7. Profile/settings sync

Update Marketa’s existing profile system:

- Logged-out/demo users can still use the current localStorage fallback
- Logged-in users load profile data from Supabase
- Settings page saves profile updates back to Supabase
- Avatar, display name, location, bio, notifications, and visibility sync with the `profiles` table

### 8. Keep listings local for now

For this step, only authentication and profiles move to Supabase.

Existing listing behavior remains localStorage-based:

- create listings
- edit listings
- delete listings
- saved items

This keeps the connection smaller and safer. Listings and saved items can be migrated to Supabase in the next step.

## Files to add

- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`
- `src/hooks/use-auth.tsx`
- `src/components/auth/ProtectedRoute.tsx`
- `src/pages/Auth.tsx`

## Files to update

- `package.json`
- lockfile
- `src/App.tsx`
- `src/components/layout/Header.tsx`
- `src/store/marketa.tsx`
- `src/pages/Settings.tsx`
- `src/pages/Sell.tsx`

Also fix the remaining label in the Sell page from:

```text
Price (USD)
```

to:

```text
Price (PHP)
```

## Supabase dashboard settings to check

In your Supabase dashboard:

1. Go to **Authentication → Providers → Email**
2. For demo/testing, disable **Confirm email** if you want users to sign up and log in immediately
3. Go to **Authentication → URL Configuration**
4. Add the preview URL as an allowed redirect URL:

```text
https://id-preview--d2e6c658-84bf-42ac-8874-628be1dd1513.lovable.app
```

When the app is published later, add the published URL too.

## Testing plan

After implementation:

1. Open `/auth`
2. Create a new account
3. Confirm the profile row appears in Supabase
4. Log out
5. Log back in
6. Check protected routes redirect correctly
7. Update profile/settings
8. Refresh the page and confirm profile data persists from Supabase
9. Verify Sell/Saved/Profile/Settings work only when logged in
