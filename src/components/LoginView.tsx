import { useState, type FormEvent } from 'react';
import { ShieldCheck, LogIn, KeyRound, Loader2 } from 'lucide-react';
import { login, changePassword, type AuthUser } from '../lib/api';

interface LoginViewProps {
  onLoggedIn: (user: AuthUser) => void;
}

/**
 * Full-screen authentication gate. Handles normal login and the forced
 * password change on a first-time (default) admin account.
 */
export default function LoginView({ onLoggedIn }: LoginViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Forced password-change flow (default admin on first login)
  const [mustChange, setMustChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const submitLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await login(username.trim(), password);
      if (user.mustChangePassword) setMustChange(true);
      else onLoggedIn(user);
    } catch (err: any) {
      setError(err?.message || 'Login failed.');
    } finally {
      setBusy(false);
    }
  };

  const submitNewPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) { setError('New password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      await changePassword(password, newPassword);
      const user = await login(username.trim(), newPassword); // re-login with the new password
      onLoggedIn(user);
    } catch (err: any) {
      setError(err?.message || 'Could not update password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen w-screen bg-gradient-to-br from-[#0b1c30] via-[#132a45] to-[#0b1c30] text-[#0b1c30] p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-7 py-6 bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
          <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">EduAdmin Pro</h1>
            <p className="text-xs text-white/75">School Administration — Secure Sign In</p>
          </div>
        </div>

        {!mustChange ? (
          <form onSubmit={submitLogin} className="px-7 py-7 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Username</label>
              <input
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-sm"
                placeholder="admin"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-sm"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

            <button
              type="submit"
              disabled={busy || !username || !password}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold text-sm transition-colors"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              {busy ? 'Signing in…' : 'Sign In'}
            </button>

            <p className="text-[11px] text-slate-400 text-center pt-1">
              First run? Default login is <span className="font-semibold">admin / admin123</span> — you'll be asked to change it.
            </p>
          </form>
        ) : (
          <form onSubmit={submitNewPassword} className="px-7 py-7 space-y-4">
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <KeyRound className="w-4 h-4 shrink-0" />
              Set a new password before continuing.
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">New password</label>
              <input
                type="password"
                autoFocus
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-sm"
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-sm"
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />
            </div>

            {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

            <button
              type="submit"
              disabled={busy || !newPassword || !confirmPassword}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold text-sm transition-colors"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              {busy ? 'Updating…' : 'Update Password & Continue'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
