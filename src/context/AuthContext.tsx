import {
  createContext, useContext, useState,
  useEffect, useCallback, type ReactNode,
} from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

// ─── Public types ─────────────────────────────────────────────────────────────

export type Role = 'superadmin' | 'councilor' | 'student';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  password?: string;   // only present in localStorage mode
  branch?: string;
}

interface AuthContextType {
  user: User | null;
  users: User[];
  loading: boolean;
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => void;
  registerAccount: (
    name: string, email: string, pass: string,
    role: Role, branch?: string
  ) => Promise<boolean>;
  impersonate: (target: User) => Promise<void>;
  addUser: (u: Omit<User, 'id'> & { password: string }) => Promise<void>;
  updateUser: (id: string, updates: Partial<User>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
}

// ─── localStorage helpers (fallback mode) ────────────────────────────────────

const STORAGE_VERSION     = 'v3';
const STORAGE_USERS_KEY   = 'cpn_users';
const STORAGE_VERSION_KEY = 'cpn_storage_version';

const MOCK_USERS: User[] = [
  { id: '1', name: 'Admin', email: 'admin@college.edu', role: 'superadmin', password: 'admin' },
  { id: '2', name: 'Jane Smith', email: 'jane@college.edu', role: 'councilor', password: 'pass' },
  { id: '3', name: 'Alex Johnson', email: 'alex@student.edu', role: 'student', password: 'pass', branch: 'CS' }
];

function loadLocalUsers(): User[] {
  const ver = localStorage.getItem(STORAGE_VERSION_KEY);
  if (ver !== STORAGE_VERSION) {
    localStorage.removeItem(STORAGE_USERS_KEY);
    localStorage.removeItem('mock_users');
    localStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
    saveLocalUsers(MOCK_USERS);
    return MOCK_USERS;
  }
  const saved = localStorage.getItem(STORAGE_USERS_KEY);
  return saved ? (JSON.parse(saved) as User[]) : MOCK_USERS;
}

function saveLocalUsers(users: User[]) {
  localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user,    setUser]    = useState<User | null>(null);
  const [users,   setUsers]   = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── Initial load ──────────────────────────────────────────────────────────

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        // ── Supabase mode ──────────────────────────────────────────────────
        const { data, error } = await supabase
          .from('vw_user_profiles')
          .select('*')
          .eq('is_active', true)
          .order('created_at');
        if (error) throw error;
        setUsers((data ?? []) as User[]);
      } else {
        // ── localStorage mode ──────────────────────────────────────────────
        setUsers(loadLocalUsers());
      }
    } catch (err) {
      console.error('[AuthContext] loadUsers error:', err);
      // Graceful fallback: show nothing rather than crash
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // Persist to localStorage whenever users list changes (localStorage mode only)
  useEffect(() => {
    if (!isSupabaseConfigured) saveLocalUsers(users);
  }, [users]);

  // ─── Login ─────────────────────────────────────────────────────────────────

  const login = async (email: string, pass: string): Promise<boolean> => {
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.rpc('verify_user_password', {
          p_email: email, p_password: pass,
        });
        if (error) throw error;
        const found = Array.isArray(data) ? data[0] : data;
        if (found) { setUser(found as User); return true; }
        return false;
      } else {
        const found = users.find(u => u.email === email && u.password === pass);
        if (found) { setUser(found); return true; }
        return false;
      }
    } catch (err) {
      console.error('[AuthContext] login error:', err);
      return false;
    }
  };

  // ─── Logout ────────────────────────────────────────────────────────────────

  const logout = () => setUser(null);

  // ─── Register ──────────────────────────────────────────────────────────────

  const registerAccount = async (
    name: string, email: string, pass: string,
    role: Role, branch?: string
  ): Promise<boolean> => {
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.rpc('create_user_account', {
          p_name: name, p_email: email, p_password: pass,
          p_role: role, p_branch: branch ?? null,
        });
        if (error) {
          if (error.message?.includes('EMAIL_ALREADY_EXISTS')) return false;
          throw error;
        }
        const newUser = Array.isArray(data) ? data[0] : data;
        setUsers(prev => [...prev, newUser as User]);
        setUser(newUser as User);
        return true;
      } else {
        if (users.find(u => u.email === email)) return false;
        const newUser: User = {
          id: Date.now().toString(), name, email, password: pass, role, branch,
        };
        setUsers(prev => [...prev, newUser]);
        setUser(newUser);
        return true;
      }
    } catch (err) {
      console.error('[AuthContext] registerAccount error:', err);
      return false;
    }
  };

  // ─── Impersonate ───────────────────────────────────────────────────────────

  const impersonate = async (target: User): Promise<void> => {
    if (isSupabaseConfigured && supabase && user) {
      try {
        await supabase.from('impersonation_log').insert({
          actor_id: user.id, impersonated_id: target.id,
        });
      } catch (err) {
        console.warn('[AuthContext] impersonation log failed:', err);
      }
    }
    setUser(target);
  };

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  const addUser = async (u: Omit<User, 'id'> & { password: string }): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('create_user_account', {
        p_name: u.name, p_email: u.email, p_password: u.password,
        p_role: u.role, p_branch: u.branch ?? null,
      });
      if (error) throw error;
      const newUser = Array.isArray(data) ? data[0] : data;
      setUsers(prev => [...prev, newUser as User]);
    } else {
      const newUser: User = { ...u, id: Date.now().toString() };
      setUsers(prev => [...prev, newUser]);
    }
  };

  const updateUser = async (id: string, updates: Partial<User>): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('users')
        .update({
          name:   updates.name,
          branch: updates.branch ?? null,
          email:  updates.email,
          role:   updates.role,
        })
        .eq('id', id)
        .select('id, auth_uid, name, email, role, branch, is_active, created_at, updated_at')
        .single();
      if (error) throw error;
      const updated = data as User;
      setUsers(prev => prev.map(u => u.id === id ? updated : u));
      if (user?.id === id) setUser(updated);
    } else {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
      if (user?.id === id) setUser(prev => prev ? { ...prev, ...updates } : prev);
    }
  };

  const deleteUser = async (id: string): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('users')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    }
    setUsers(prev => prev.filter(u => u.id !== id));
    if (user?.id === id) logout();
  };

  return (
    <AuthContext.Provider value={{
      user, users, loading,
      login, logout, registerAccount,
      impersonate, addUser, updateUser, deleteUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
