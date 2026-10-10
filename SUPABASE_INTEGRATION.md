# Career Path Navigator — Supabase Integration Guide

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Supabase Project Setup](#2-supabase-project-setup)
3. [Database Schema](#3-database-schema)
4. [Row Level Security (RLS) Policies](#4-row-level-security-rls-policies)
5. [API Keys — Which to Use & Where](#5-api-keys--which-to-use--where)
6. [Environment Variables](#6-environment-variables)
7. [Supabase Auth Configuration](#7-supabase-auth-configuration)
8. [Migration Plan (localStorage → Supabase)](#8-migration-plan-localstorage--supabase)
9. [Code Changes Required](#9-code-changes-required)
10. [Impersonation Pattern](#10-impersonation-pattern)
11. [Security Checklist](#11-security-checklist)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│  Login.tsx → AuthContext.tsx → Dashboard (role-based)   │
└─────────────────────┬───────────────────────────────────┘
                      │  @supabase/supabase-js (client SDK)
                      │  Uses: ANON KEY only
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   Supabase Cloud                         │
│                                                          │
│  ┌─────────────┐   ┌──────────────┐   ┌─────────────┐  │
│  │ Auth Service│   │  PostgreSQL   │   │   Storage   │  │
│  │(email/pass) │──▶│   Database   │   │  (future)   │  │
│  └─────────────┘   └──────────────┘   └─────────────┘  │
│         │                 │                              │
│         │   auto-creates  │  protected by               │
│         ▼                 ▼  RLS policies               │
│    auth.users ──── profiles table                       │
│                    ├── role (superadmin/councilor/student│
│                    ├── branch                           │
│                    └── name                             │
└─────────────────────────────────────────────────────────┘
```

### Data Flow
| Action | Flow |
|--------|------|
| Login | `supabase.auth.signInWithPassword()` → JWT stored in browser → RLS applies automatically |
| Register | `supabase.auth.signUp()` → trigger auto-creates `profiles` row |
| Read users | `supabase.from('profiles').select()` → RLS filters by role |
| Create user (admin) | Supabase Admin API (Edge Function) — never expose service key on client |
| Impersonate | Store target user ID in state; query their profile with service key via Edge Function |

---

## 2. Supabase Project Setup

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Choose a region close to your users (e.g. `ap-south-1` for India)
3. Set a strong **database password** — save it securely
4. Wait ~2 minutes for provisioning

---

## 3. Database Schema

Run this SQL in **Supabase Dashboard → SQL Editor**:

### Step 1 — Create the role enum and profiles table

```sql
-- Custom role type
CREATE TYPE public.app_role AS ENUM ('superadmin', 'councilor', 'student');

-- Profiles table (extends auth.users 1:1)
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  role        public.app_role NOT NULL DEFAULT 'student',
  branch      TEXT,                          -- only relevant for students
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep updated_at in sync automatically
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

### Step 2 — Auto-create profile on sign-up

```sql
-- Trigger: when a new auth user is created, insert a profile row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, branch)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'New User'),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'student'),
    NEW.raw_user_meta_data->>'branch'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Step 3 — Career paths table (for Student Dashboard future feature)

```sql
CREATE TABLE public.career_paths (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  branch      TEXT NOT NULL,
  industry    TEXT,
  job_roles   TEXT[],                        -- array of job titles
  skills      TEXT[],                        -- required skills
  is_saved    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Full Schema Summary

| Table | Column | Type | Notes |
|-------|--------|------|-------|
| `profiles` | `id` | `UUID` | FK → `auth.users.id` |
| | `name` | `TEXT` | Full name |
| | `email` | `TEXT` | Mirrors auth email |
| | `role` | `app_role` | `superadmin` / `councilor` / `student` |
| | `branch` | `TEXT` | nullable; students only |
| | `created_at` | `TIMESTAMPTZ` | auto |
| | `updated_at` | `TIMESTAMPTZ` | auto-updated by trigger |
| `career_paths` | `id` | `UUID` | PK |
| | `student_id` | `UUID` | FK → `profiles.id` |
| | `title` | `TEXT` | Path name |
| | `branch` | `TEXT` | Academic branch |
| | `industry` | `TEXT` | Target industry |
| | `job_roles` | `TEXT[]` | Array of role titles |
| | `skills` | `TEXT[]` | Required skills |
| | `is_saved` | `BOOLEAN` | Bookmarked by student |
| | `created_at` | `TIMESTAMPTZ` | auto |

---

## 4. Row Level Security (RLS) Policies

Run this SQL in **Supabase Dashboard → SQL Editor**:

```sql
-- Enable RLS on both tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_paths ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════
-- Helper function: get the role of the logged-in user
-- ══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.app_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ══════════════════════════════════════════════════════
-- PROFILES — SELECT policies
-- ══════════════════════════════════════════════════════

-- Superadmin can see every profile
CREATE POLICY "superadmin_select_all_profiles"
  ON public.profiles FOR SELECT
  USING (public.get_my_role() = 'superadmin');

-- Councilor can see all student profiles
CREATE POLICY "councilor_select_students"
  ON public.profiles FOR SELECT
  USING (
    public.get_my_role() = 'councilor'
    AND role = 'student'
  );

-- Any user can see their own profile
CREATE POLICY "user_select_own_profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());


-- ══════════════════════════════════════════════════════
-- PROFILES — INSERT policies
-- (Admin creation of users is done via Edge Function
--  using service key, so client INSERT is restricted)
-- ══════════════════════════════════════════════════════

-- Only the trigger (SECURITY DEFINER) inserts on signup.
-- Block direct client inserts from everyone.
CREATE POLICY "block_direct_insert"
  ON public.profiles FOR INSERT
  WITH CHECK (false);


-- ══════════════════════════════════════════════════════
-- PROFILES — UPDATE policies
-- ══════════════════════════════════════════════════════

-- Superadmin can update any profile (except cannot change own role away from superadmin)
CREATE POLICY "superadmin_update_any_profile"
  ON public.profiles FOR UPDATE
  USING (public.get_my_role() = 'superadmin')
  WITH CHECK (
    -- Prevent demoting themselves
    NOT (id = auth.uid() AND role != 'superadmin')
  );

-- Councilor can update student profiles only
CREATE POLICY "councilor_update_students"
  ON public.profiles FOR UPDATE
  USING (
    public.get_my_role() = 'councilor'
    AND role = 'student'
  )
  WITH CHECK (role = 'student');  -- cannot change role

-- Student can update their own name and branch only
CREATE POLICY "student_update_own_profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = 'student'  -- cannot change own role
  );


-- ══════════════════════════════════════════════════════
-- PROFILES — DELETE policies
-- ══════════════════════════════════════════════════════

-- Superadmin can delete any non-superadmin account
CREATE POLICY "superadmin_delete_non_superadmin"
  ON public.profiles FOR DELETE
  USING (
    public.get_my_role() = 'superadmin'
    AND role != 'superadmin'   -- cannot delete other superadmins
    AND id != auth.uid()       -- cannot delete themselves
  );

-- Councilor can delete student accounts
CREATE POLICY "councilor_delete_students"
  ON public.profiles FOR DELETE
  USING (
    public.get_my_role() = 'councilor'
    AND role = 'student'
  );

-- Students cannot delete any profile (no policy = denied)


-- ══════════════════════════════════════════════════════
-- CAREER_PATHS — policies
-- ══════════════════════════════════════════════════════

-- Student can see their own paths
CREATE POLICY "student_select_own_paths"
  ON public.career_paths FOR SELECT
  USING (student_id = auth.uid());

-- Councilor can see all student paths
CREATE POLICY "councilor_select_all_paths"
  ON public.career_paths FOR SELECT
  USING (public.get_my_role() = 'councilor');

-- Superadmin can see all paths
CREATE POLICY "superadmin_select_all_paths"
  ON public.career_paths FOR SELECT
  USING (public.get_my_role() = 'superadmin');

-- Student can insert their own paths
CREATE POLICY "student_insert_own_paths"
  ON public.career_paths FOR INSERT
  WITH CHECK (student_id = auth.uid());

-- Student can update their own paths
CREATE POLICY "student_update_own_paths"
  ON public.career_paths FOR UPDATE
  USING (student_id = auth.uid());

-- Student can delete their own paths
CREATE POLICY "student_delete_own_paths"
  ON public.career_paths FOR DELETE
  USING (student_id = auth.uid());
```

---

## 5. API Keys — Which to Use & Where

Supabase gives you **three keys**. Here is exactly what each does and where it belongs:

| Key | Found In | What It Does | Use In |
|-----|----------|--------------|--------|
| **Project URL** | Settings → API | Base URL for all API calls | `.env` → client |
| **`anon` (public) key** | Settings → API | Safe to expose. Respects RLS. Used for all client-side operations | `.env` → client code |
| **`service_role` key** | Settings → API | **BYPASSES RLS completely.** Full admin access. | `.env.server` → Edge Functions / server only. **NEVER in client code** |

### ✅ Use `anon` key for:
- `supabase.auth.signInWithPassword()`
- `supabase.auth.signUp()`
- `supabase.from('profiles').select()` — RLS will filter correctly
- `supabase.from('profiles').update()` — RLS enforces who can update what
- Any query initiated from the React app

### ⛔ Use `service_role` key ONLY for:
- Creating users on behalf of admins (e.g. SuperAdmin creates a councilor account)
- Bypassing RLS for admin-level bulk operations
- **Must live in a Supabase Edge Function** — never sent to the browser

---

## 6. Environment Variables

Create a `.env` file in the root of your project:

```env
# .env  (committed — these are safe public values)
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Create a `.env.local` file for local-only secrets (**add to `.gitignore`**):

```env
# .env.local  (NEVER commit this)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> **Where to find these keys:**  
> Supabase Dashboard → Your Project → **Settings** → **API**

Install the Supabase client:

```bash
npm install @supabase/supabase-js
```

Create `src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnon) {
  throw new Error('Missing Supabase environment variables. Check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnon);
```

---

## 7. Supabase Auth Configuration

In **Supabase Dashboard → Authentication → Settings**:

| Setting | Value | Why |
|---------|-------|-----|
| **Email confirmations** | Disable (for dev) | Avoids needing real email setup while testing |
| **Minimum password length** | 6 | Matches your current min |
| **Site URL** | `http://localhost:5173` | For redirects |
| **JWT expiry** | `3600` (1 hour) | Reasonable session length |
| **Refresh token rotation** | Enabled | Security best practice |

---

## 8. Migration Plan (localStorage → Supabase)

### Phase 1 — Setup (30 min)
- [ ] Create Supabase project
- [ ] Run Schema SQL (Section 3)
- [ ] Run RLS SQL (Section 4)
- [ ] Add `.env` with URL + anon key
- [ ] Install `@supabase/supabase-js`
- [ ] Create `src/lib/supabase.ts`

### Phase 2 — Auth Context Rewrite (1–2 hrs)
- [ ] Replace `login()` → `supabase.auth.signInWithPassword()`
- [ ] Replace `logout()` → `supabase.auth.signOut()`
- [ ] Replace `registerAccount()` → `supabase.auth.signUp()` with metadata
- [ ] Replace `users` state → `supabase.from('profiles').select()`
- [ ] Replace `updateUser()` → `supabase.from('profiles').update()`
- [ ] Replace `deleteUser()` → delete from `auth.users` via Edge Function
- [ ] Remove all `localStorage` logic

### Phase 3 — Admin User Creation via Edge Function (1 hr)
- [ ] Create Supabase Edge Function `create-user`
- [ ] Use `service_role` key inside the function to call `auth.admin.createUser()`
- [ ] Call the Edge Function from SuperAdmin / Councilor dashboards

### Phase 4 — Impersonation (1 hr)
- [ ] Create Edge Function `get-user-session` for impersonation
- [ ] Or use a simpler approach: fetch profile data and render their dashboard in a "preview" mode (see Section 10)

---

## 9. Code Changes Required

### New `AuthContext.tsx` structure

```ts
import { supabase } from '../lib/supabase';

// login
const login = async (email: string, pass: string) => {
  const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
  return !error;
};

// logout
const logout = async () => {
  await supabase.auth.signOut();
};

// register (student self-signup)
const registerAccount = async (name, email, pass, role, branch) => {
  const { error } = await supabase.auth.signUp({
    email,
    password: pass,
    options: {
      data: { name, role, branch }   // stored in raw_user_meta_data → picked up by trigger
    }
  });
  return !error;
};

// fetch all users (for admin/councilor)
const fetchUsers = async () => {
  const { data } = await supabase.from('profiles').select('*');
  setUsers(data ?? []);
};

// update profile
const updateUser = async (id: string, updates: Partial<User>) => {
  await supabase.from('profiles').update(updates).eq('id', id);
};

// delete user → must go through Edge Function (service key required)
const deleteUser = async (id: string) => {
  await supabase.functions.invoke('delete-user', { body: { userId: id } });
};
```

### Edge Function: `create-user`

```ts
// supabase/functions/create-user/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const { name, email, password, role, branch } = await req.json();

  // Verify caller is superadmin or councilor via their JWT
  const authHeader = req.headers.get('Authorization')!;
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user } } = await userClient.auth.getUser();
  const { data: profile } = await userClient
    .from('profiles').select('role').eq('id', user!.id).single();

  const callerRole = profile?.role;
  const allowed =
    callerRole === 'superadmin' ||
    (callerRole === 'councilor' && role === 'student');

  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  // Use service key to create the auth user
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role, branch }
  });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  return new Response(JSON.stringify({ user: data.user }), { status: 200 });
});
```

### Edge Function: `delete-user`

```ts
// supabase/functions/delete-user/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const { userId } = await req.json();
  const authHeader = req.headers.get('Authorization')!;

  // Verify caller role
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user } } = await userClient.auth.getUser();
  const { data: profile } = await userClient
    .from('profiles').select('role').eq('id', user!.id).single();
  const { data: target } = await userClient
    .from('profiles').select('role').eq('id', userId).single();

  const callerRole = profile?.role;
  const targetRole = target?.role;
  const allowed =
    (callerRole === 'superadmin' && targetRole !== 'superadmin') ||
    (callerRole === 'councilor' && targetRole === 'student');

  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  return new Response(JSON.stringify({ success: true }), { status: 200 });
});
```

---

## 10. Impersonation Pattern

The current "Portal" button (where admins access a student/councilor's view) **cannot** use Supabase's native JWT impersonation on the client side. The recommended pattern:

### Option A — Profile Preview Mode (Recommended for now)
Store the target user's profile in state and render their dashboard component in "read-only preview" mode, without switching auth sessions.

```ts
// In AuthContext
const [impersonating, setImpersonating] = useState<User | null>(null);

const impersonate = async (targetUserId: string) => {
  const { data } = await supabase
    .from('profiles').select('*').eq('id', targetUserId).single();
  setImpersonating(data);
};

const stopImpersonating = () => setImpersonating(null);
```

The dashboard then reads from `impersonating ?? user` to render the right view.

### Option B — Edge Function Token Exchange (Advanced)
Create an Edge Function that uses the service key to generate a short-lived token for the target user, then sign in with it client-side. More complex but gives true session impersonation.

---

## 11. Security Checklist

- [ ] `SUPABASE_SERVICE_ROLE_KEY` is **never** in any client-side code or committed to Git
- [ ] `.env.local` is in `.gitignore`
- [ ] RLS is enabled on **every** table
- [ ] All tables have a default-deny policy (no policies = no access)
- [ ] `get_my_role()` function is `SECURITY DEFINER` (runs as DB owner, safe)
- [ ] Edge Functions validate the caller's JWT before using the service key
- [ ] Councilors cannot create/delete other councilors (enforced at Edge Function + RLS level)
- [ ] SuperAdmin cannot delete themselves (enforced in RLS DELETE policy)
- [ ] Email confirmation disabled only in development — **enable it in production**
- [ ] Set Supabase project to **pause** protection in production settings

---

## Quick Reference

```
Supabase Dashboard → Settings → API
├── Project URL           → VITE_SUPABASE_URL
├── anon (public) key     → VITE_SUPABASE_ANON_KEY   ✅ safe for client
└── service_role key      → SUPABASE_SERVICE_ROLE_KEY  ⛔ server/Edge Function only
```

```
Tables
├── profiles         → user identity + role + branch
└── career_paths     → student's saved career paths

Auth trigger
└── on_auth_user_created → auto-creates profiles row on sign-up

Edge Functions (need service key)
├── create-user      → admin creates councilor/student accounts
└── delete-user      → admin deletes accounts from auth.users
```
