import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Compass, Loader2 } from 'lucide-react';

export const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email,   setEmail]   = useState('');
  const [pass,    setPass]    = useState('');
  const [name,    setName]    = useState('');
  const [role,    setRole]    = useState<Role>('student');
  const [branch,  setBranch]  = useState('Hospitality');
  const [error,   setError]   = useState('');
  const [busy,    setBusy]    = useState(false);

  const { login, registerAccount } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      if (isLogin) {
        const ok = await login(email, pass);
        if (ok) {
          navigate('/dashboard');
        } else {
          setError('Invalid email or password. Please try again.');
        }
      } else {
        const ok = await registerAccount(name, email, pass, role, role === 'student' ? branch : undefined);
        if (ok) {
          navigate('/dashboard');
        } else {
          setError('Email already exists. Please use a different email.');
        }
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-800 p-8 rounded-2xl shadow-xl max-w-md w-full border border-slate-700"
      >
        <div className="flex justify-center mb-6">
          <Compass className="w-12 h-12 text-blue-500" />
        </div>
        <h1 className="text-3xl font-bold text-white text-center mb-2">Career Path Navigator</h1>
        <p className="text-slate-400 text-center mb-6">
          {isLogin ? 'Sign in to your account' : 'Create a new account'}
        </p>
        
        {error && <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded mb-4 text-center">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Full Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500" required />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Account Type</label>
                <select value={role} onChange={e => setRole(e.target.value as Role)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500">
                  <option value="student">Student</option>
                  <option value="councilor">Career Councilor</option>
                  <option value="superadmin">Super Admin</option>
                </select>
              </div>

              {role === 'student' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Academic Branch</label>
                  <select value={branch} onChange={e => setBranch(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500">
                    <option>Hospitality</option>
                    <option>Fine Arts</option>
                    <option>Psychology</option>
                    <option>Business Administration</option>
                    <option>Design</option>
                  </select>
                </div>
              )}
            </>
          )}
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
            <input type="password" value={pass} onChange={e => setPass(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500" required />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white font-medium py-2 px-4 rounded-lg transition-colors mt-2 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {busy ? 'Please wait…' : isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>
        
        <div className="mt-6 text-center text-sm text-slate-400">
          {isLogin ? (
            <p>New here? <button type="button" onClick={() => { setIsLogin(false); setError(''); }} className="text-blue-400 hover:underline">Create an account</button></p>
          ) : (
            <p>Already have an account? <button type="button" onClick={() => { setIsLogin(true); setError(''); }} className="text-blue-400 hover:underline">Sign in</button></p>
          )}
        </div>
      </motion.div>
    </div>
  );
};
