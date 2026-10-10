import { supabase } from './supabase';
import type { Role } from '../context/AuthContext';

// ─── Types that mirror the SQL tables ─────────────────────────────────────────

export interface DbUser {
  id: string;
  auth_uid: string | null;
  name: string;
  email: string;
  role: Role;
  branch: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbCareerPath {
  id: string;
  title: string;
  description: string | null;
  branch: string | null;
  icon_name: string | null;
  tags: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbSavedPath {
  id: string;
  student_id: string;
  career_path_id: string;
  notes: string | null;
  saved_at: string;
  career_paths?: DbCareerPath; // joined
}

// ─── Users ─────────────────────────────────────────────────────────────────────

/** Fetch all users (uses vw_user_profiles so password_hash is never sent). */
export async function fetchAllUsers(): Promise<DbUser[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('vw_user_profiles')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as DbUser[];
}

/** Verify credentials and return the matching user or null. */
export async function verifyCredentials(
  email: string,
  password: string
): Promise<DbUser | null> {
  if (!supabase) return null;
  // Uses Postgres crypt() via RPC to compare the hash safely on the server.
  const { data, error } = await supabase.rpc('verify_user_password', {
    p_email: email,
    p_password: password,
  });

  if (error) throw error;
  return (data as DbUser) ?? null;
}

/** Create a new user account. */
export async function createUser(params: {
  name: string;
  email: string;
  password: string;
  role: Role;
  branch?: string;
}): Promise<DbUser> {
  if (!supabase) throw new Error('Cannot create DB user in offline mode');
  const { data, error } = await supabase.rpc('create_user_account', {
    p_name:     params.name,
    p_email:    params.email,
    p_password: params.password,
    p_role:     params.role,
    p_branch:   params.branch ?? null,
  });

  if (error) throw error;
  return data as DbUser;
}

/** Update a user's name and/or branch. */
export async function patchUser(
  id: string,
  updates: Partial<Pick<DbUser, 'name' | 'branch' | 'email' | 'role' | 'is_active'>>
): Promise<DbUser> {
  if (!supabase) throw new Error('Cannot patch DB user in offline mode');
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', id)
    .select('id, auth_uid, name, email, role, branch, is_active, created_at, updated_at')
    .single();

  if (error) throw error;
  return data as DbUser;
}

/** Soft-delete: mark a user as inactive. */
export async function softDeleteUser(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('users')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw error;
}

// ─── Career Paths ─────────────────────────────────────────────────────────────

/** Fetch all active career paths. */
export async function fetchCareerPaths(branch?: string): Promise<DbCareerPath[]> {
  if (!supabase) return [];
  let query = supabase
    .from('career_paths')
    .select('*')
    .eq('is_active', true)
    .order('title');

  if (branch) {
    // Returns paths specific to this branch OR paths that apply to all branches (branch = NULL)
    query = query.or(`branch.eq.${branch},branch.is.null`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as DbCareerPath[];
}

// ─── Saved Paths ──────────────────────────────────────────────────────────────

/** Fetch all career paths a student has saved, with career path details joined. */
export async function fetchSavedPaths(studentId: string): Promise<DbSavedPath[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('saved_paths')
    .select('*, career_paths(*)')
    .eq('student_id', studentId)
    .order('saved_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as DbSavedPath[];
}

/** Save a career path for a student. */
export async function saveCareerPath(
  studentId: string,
  careerPathId: string,
  notes?: string
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('saved_paths').insert({
    student_id:     studentId,
    career_path_id: careerPathId,
    notes:          notes ?? null,
  });
  if (error) throw error;
}

/** Remove a saved career path. */
export async function unsaveCareerPath(
  studentId: string,
  careerPathId: string
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('saved_paths')
    .delete()
    .match({ student_id: studentId, career_path_id: careerPathId });

  if (error) throw error;
}

// ─── Impersonation Log ────────────────────────────────────────────────────────

/** Log that actorId impersonated impersonatedId. Returns the log row id. */
export async function logImpersonationStart(
  actorId: string,
  impersonatedId: string
): Promise<string> {
  if (!supabase) return 'offline-log-id';
  const { data, error } = await supabase
    .from('impersonation_log')
    .insert({ actor_id: actorId, impersonated_id: impersonatedId })
    .select('id')
    .single();

  if (error) throw error;
  return (data as { id: string }).id;
}

/** Mark an impersonation session as ended. */
export async function logImpersonationEnd(logId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('impersonation_log')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', logId);

  if (error) throw error;
}
