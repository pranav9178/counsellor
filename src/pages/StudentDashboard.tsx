import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  User, Edit, Save, Compass, Map, LogOut,
  Loader2, CheckCircle, AlertCircle, X, BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ─── Toast ──────────────────────────────────────────────────────── */
type Toast = { type: 'success' | 'error'; text: string } | null;

function ToastBanner({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg border text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {toast.type === 'success'
            ? <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
            : <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />}
          {toast.text}
          <button onClick={onClose} className="ml-2 opacity-50 hover:opacity-100 transition-opacity">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */
export const StudentDashboard = () => {
  const { user, logout, updateUser } = useAuth();

  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    branch: user?.branch || 'Hospitality',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const [toast, setToast] = useState<Toast>(null);

  // Sync profile if context user changes (e.g. after impersonation)
  useEffect(() => {
    setProfile({
      name: user?.name || '',
      email: user?.email || '',
      branch: user?.branch || 'Hospitality',
    });
  }, [user]);

  const showToast = (type: 'success' | 'error', text: string) => setToast({ type, text });

  const handleSave = async () => {
    if (!profile.name.trim()) {
      setNameError('Name cannot be empty');
      return;
    }
    setNameError('');
    setSaving(true);
    try {
      await new Promise(r => setTimeout(r, 400));
      if (user) {
        await updateUser(user.id, { name: profile.name, branch: profile.branch });
        showToast('success', 'Profile updated successfully');
      }
      setIsEditing(false);
    } catch {
      showToast('error', 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    // Reset to stored values
    setProfile({
      name: user?.name || '',
      email: user?.email || '',
      branch: user?.branch || 'Hospitality',
    });
    setNameError('');
    setIsEditing(false);
  };

  const branches = ['Hospitality', 'Fine Arts', 'Psychology', 'Business Administration', 'Design', 'Commerce'];

  return (
    <div className="min-h-screen bg-slate-50">
      <ToastBanner toast={toast} onClose={() => setToast(null)} />

      {/* Navbar */}
      <nav className="bg-white shadow-sm px-6 py-4 flex justify-between items-center border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Compass className="text-blue-600 w-5 h-5" />
          <h1 className="text-xl font-bold text-slate-800">Student Portal</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              {user?.name?.charAt(0).toUpperCase() || 'S'}
            </div>
            <span className="text-sm font-medium text-slate-700">{user?.name}</span>
          </div>
          <button
            onClick={logout}
            className="text-sm bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 font-medium"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-6 mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* ── Profile Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="col-span-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 h-fit"
        >
          {/* Avatar */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl mb-3">
              {user?.name?.charAt(0).toUpperCase() || 'S'}
            </div>
            <p className="font-semibold text-slate-800">{user?.name}</p>
            <p className="text-xs text-slate-500">{profile.branch}</p>
          </div>

          <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" /> My Profile
            </h2>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
              >
                <Edit className="w-3.5 h-3.5" /> Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="text-slate-500 hover:text-slate-700 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1 disabled:opacity-60"
                >
                  {saving
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Save className="w-3.5 h-3.5" />}
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
              {isEditing ? (
                <div>
                  <input
                    value={profile.name}
                    onChange={e => { setProfile({ ...profile, name: e.target.value }); setNameError(''); }}
                    className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 transition-all ${
                      nameError ? 'border-red-400 bg-red-50 focus:ring-red-300' : 'border-slate-200 bg-slate-50 focus:ring-blue-300 focus:border-blue-400'
                    }`}
                  />
                  {nameError && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />{nameError}
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-slate-800 font-medium">{profile.name}</div>
              )}
            </div>

            {/* Email — read only */}
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Email</label>
              <div className="text-slate-700 text-sm">{profile.email}</div>
            </div>

            {/* Branch */}
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Branch</label>
              {isEditing ? (
                <select
                  value={profile.branch}
                  onChange={e => setProfile({ ...profile, branch: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all"
                >
                  {branches.map(b => <option key={b}>{b}</option>)}
                </select>
              ) : (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                  {profile.branch}
                </span>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Right Column ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="col-span-1 md:col-span-2 space-y-6"
        >
          {/* Hero Banner */}
          <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 rounded-2xl shadow-md p-8 text-white relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/10 blur-xl" />
            <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-indigo-500/20 blur-2xl" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-3 py-1 text-xs font-medium mb-3">
                <Compass className="w-3.5 h-3.5" /> Career Pathfinder
              </div>
              <h2 className="text-2xl font-bold mb-2">Explore Your Pathway</h2>
              <p className="text-blue-100 mb-5 max-w-md text-sm">
                Discover careers in <span className="font-semibold text-white">{profile.branch}</span>. Map your skills,
                track your progress, and get actionable steps towards your dream job.
              </p>
              <button className="bg-white text-blue-700 hover:bg-blue-50 font-semibold px-5 py-2 rounded-xl transition-colors flex items-center gap-2 text-sm shadow-sm">
                <Map className="w-4 h-4" /> Start Exploring
              </button>
            </div>
          </div>

          {/* Saved Paths */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-slate-400" /> Your Saved Paths
              </h3>
              <span className="text-xs text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full">0 paths</span>
            </div>

            {/* Empty state */}
            <div className="flex flex-col items-center justify-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <Map className="w-6 h-6 text-slate-300" />
              </div>
              <p className="font-medium text-slate-600 mb-1">No career paths saved yet</p>
              <p className="text-sm text-center max-w-xs">
                Start exploring to discover careers and build your personal roadmap.
              </p>
              <button className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                <Compass className="w-4 h-4" /> Browse Career Paths
              </button>
            </div>
          </div>
        </motion.div>

      </main>
    </div>
  );
};
