import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import type { User, Role } from '../context/AuthContext';
import {
  LogOut, GraduationCap, UserPlus, Edit, Trash2, ExternalLink,
  Briefcase, Users, Loader2, CheckCircle, AlertCircle, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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

/* ─── Confirm Delete Dialog ──────────────────────────────────────── */
function ConfirmDialog({
  open, name, onConfirm, onCancel, loading
}: { open: boolean; name: string; onConfirm: () => void; onCancel: () => void; loading: boolean }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4"
          >
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Delete Student Account</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Are you sure you want to remove{' '}
                  <span className="font-semibold text-slate-700">{name}</span>? This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={onCancel}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-70"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */
export const CouncilorDashboard = () => {
  const { user, users, logout, addUser, updateUser, deleteUser, impersonate } = useAuth();
  const navigate = useNavigate();

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [accessing, setAccessing] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'student' as Role });
  const [formErrors, setFormErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const studentUsers = users.filter(u => u.role === 'student');

  const showToast = (type: 'success' | 'error', text: string) => setToast({ type, text });

  const validate = () => {
    const errs: typeof formErrors = {};
    if (!formData.name.trim()) errs.name = 'Name is required';
    if (!formData.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errs.email = 'Enter a valid email';
    if (!formData.password.trim()) errs.password = 'Password is required';
    else if (formData.password.length < 4) errs.password = 'Minimum 4 characters';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const openNewForm = () => {
    setEditingId(null);
    setFormData({ name: '', email: '', password: '', role: 'student' });
    setFormErrors({});
    setShowForm(true);
  };

  const startEdit = (u: User) => {
    setEditingId(u.id);
    setFormData({ name: u.name, email: u.email, password: u.password || '', role: 'student' });
    setFormErrors({});
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await new Promise(r => setTimeout(r, 400));
      if (editingId) {
        await updateUser(editingId, { ...formData, role: 'student' });
        showToast('success', 'Student account updated');
      } else {
        if (users.find(u => u.email === formData.email)) {
          setFormErrors({ email: 'This email is already in use' });
          setSaving(false);
          return;
        }
        await addUser({ ...formData, role: 'student' });
        showToast('success', 'Student account created');
      }
      setShowForm(false);
      setEditingId(null);
    } catch {
      showToast('error', 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await new Promise(r => setTimeout(r, 400));
      await deleteUser(deleteTarget.id);
      showToast('success', `${deleteTarget.name}'s account removed`);
    } catch {
      showToast('error', 'Failed to delete account');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleAccessAccount = async (u: User) => {
    setAccessing(u.id);
    await new Promise(r => setTimeout(r, 500));
    impersonate(u);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      <ToastBanner toast={toast} onClose={() => setToast(null)} />
      <ConfirmDialog
        open={!!deleteTarget}
        name={deleteTarget?.name || ''}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />

      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-white flex flex-col md:min-h-screen shadow-xl z-10">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <Briefcase className="text-purple-400 w-8 h-8" />
          <h1 className="text-xl font-bold tracking-wide">Councilor Hub</h1>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-4">Manage Accounts</p>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors bg-purple-600 text-white">
            <GraduationCap className="w-5 h-5" />
            All Students
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium bg-purple-500 text-white">
              {studentUsers.length}
            </span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800 mt-auto">
          <div className="mb-4 px-2">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white py-2 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 lg:p-10 overflow-y-auto">
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <div>
              <h2 className="text-3xl font-bold text-slate-800">Student Directory</h2>
              <p className="text-slate-500 mt-1">Manage and access your assigned students.</p>
            </div>
            <button
              onClick={openNewForm}
              className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-medium transition-colors shadow-sm"
            >
              <UserPlus className="w-5 h-5" /> Add Student
            </button>
          </div>

          {/* Form */}
          <AnimatePresence>
            {showForm && (
              <motion.form
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                onSubmit={handleSave}
                className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4 overflow-hidden"
              >
                <h3 className="text-lg font-bold text-slate-800">
                  {editingId ? 'Edit Student Details' : 'Create New Student'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                    <input
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className={`w-full border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all ${
                        formErrors.name ? 'border-red-400 bg-red-50' : 'border-slate-300'
                      }`}
                    />
                    {formErrors.name && (
                      <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />{formErrors.name}
                      </p>
                    )}
                  </div>
                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className={`w-full border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all ${
                        formErrors.email ? 'border-red-400 bg-red-50' : 'border-slate-300'
                      }`}
                    />
                    {formErrors.email && (
                      <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />{formErrors.email}
                      </p>
                    )}
                  </div>
                  {/* Password */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                    <input
                      type="text"
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      className={`w-full border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all ${
                        formErrors.password ? 'border-red-400 bg-red-50' : 'border-slate-300'
                      }`}
                    />
                    {formErrors.password && (
                      <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />{formErrors.password}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    disabled={saving}
                    className="px-5 py-2.5 font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 font-medium bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-70 transition-colors shadow-sm flex items-center gap-2"
                  >
                    {saving && <Loader2 className="animate-spin w-4 h-4" />}
                    {saving ? 'Saving…' : 'Save Student'}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200">
                    <th className="py-4 px-6 font-semibold text-sm text-slate-600">Student Profile</th>
                    <th className="py-4 px-6 font-semibold text-sm text-slate-600">Password</th>
                    <th className="py-4 px-6 font-semibold text-sm text-slate-600 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <AnimatePresence>
                    {studentUsers.map(u => (
                      <motion.tr
                        key={u.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="hover:bg-purple-50/30 transition-colors"
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-slate-800">{u.name}</div>
                              <div className="text-sm text-slate-500">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 font-mono text-sm text-slate-500">{u.password}</td>
                        <td className="py-4 px-6">
                          <div className="flex justify-end gap-2 items-center">
                            {/* Portal */}
                            <button
                              onClick={() => handleAccessAccount(u)}
                              disabled={!!accessing}
                              title={`Access ${u.name}'s Account`}
                              className="text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-colors disabled:opacity-60"
                            >
                              {accessing === u.id
                                ? <Loader2 className="animate-spin w-3.5 h-3.5" />
                                : <ExternalLink className="w-3.5 h-3.5" />}
                              Portal
                            </button>
                            {/* Edit */}
                            <button
                              onClick={() => startEdit(u)}
                              title="Edit Details"
                              className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {/* Delete */}
                            <button
                              onClick={() => setDeleteTarget(u)}
                              title="Delete Student"
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>

                  {/* Empty State */}
                  {studentUsers.length === 0 && (
                    <tr>
                      <td colSpan={3}>
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                            <Users className="w-8 h-8 text-slate-300" />
                          </div>
                          <p className="text-lg font-semibold text-slate-600 mb-1">No students yet</p>
                          <p className="text-sm">There are no student accounts in the system.</p>
                          <button
                            onClick={openNewForm}
                            className="mt-4 text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                          >
                            <UserPlus className="w-4 h-4" /> Add a student now
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};
