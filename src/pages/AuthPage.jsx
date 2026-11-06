import { useState } from 'react';
import {
  AlertTriangle, Eye, EyeOff, Lock, Mail, Orbit, Rocket, User, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

/* ── Google colours for the branded button ── */
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    <path fill="none" d="M0 0h48v48H0z"/>
  </svg>
);

/* ── Mock Google sign-in modal ── */
function GoogleModal({ onConfirm, onClose }) {
  const [gForm, setGForm] = useState({ name: '', email: '' });
  const [gErr, setGErr] = useState('');

  const setF = (k) => (e) => setGForm((f) => ({ ...f, [k]: e.target.value }));

  const confirm = () => {
    if (!gForm.name.trim()) { setGErr('Please enter your full name.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gForm.email.trim())) {
      setGErr('Please enter a valid Gmail address.'); return;
    }
    onConfirm({ name: gForm.name.trim(), email: gForm.email.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d0f17] shadow-2xl p-6">
        <button onClick={onClose} className="absolute right-4 top-4 text-slate-500 hover:text-white transition" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow">
            <GoogleIcon />
          </div>
          <p className="text-xs text-slate-400">Sign in with</p>
          <h2 className="text-lg font-bold text-white">Google Account</h2>
          <p className="mt-1 text-xs text-slate-500">Enter the details linked to your Google account</p>
        </div>
        <div className="space-y-3">
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input className="input-dark" placeholder="Full name" value={gForm.name} onChange={setF('name')} autoFocus />
          </div>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input className="input-dark" type="email" placeholder="Gmail address" value={gForm.email} onChange={setF('email')} />
          </div>
          {gErr && (
            <p className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{gErr}
            </p>
          )}
          <button type="button" onClick={confirm} className="mt-1 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#4285F4] hover:bg-[#3367d6] px-4 py-2.5 text-sm font-semibold text-white transition">
            <GoogleIcon /> Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Password strength indicator ── */
function PasswordStrength({ password }) {
  if (!password) return null;
  const len = password.length;
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const score = (len >= 6 ? 1 : 0) + (len >= 10 ? 1 : 0) + (hasUpper ? 1 : 0) + (hasNumber ? 1 : 0) + (hasSpecial ? 1 : 0);
  const levels = [
    { label: 'Too short', color: '#ef4444' },
    { label: 'Weak', color: '#f97316' },
    { label: 'Fair', color: '#eab308' },
    { label: 'Good', color: '#22c55e' },
    { label: 'Strong', color: '#10b981' },
    { label: 'Very strong', color: '#10b981' },
  ];
  const lvl = levels[Math.min(score, 5)];
  return (
    <div className="mt-1 space-y-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-1 flex-1 rounded-full transition-all" style={{ background: i < score ? lvl.color : '#1e2030' }} />
        ))}
      </div>
      <p className="text-[11px]" style={{ color: lvl.color }}>{lvl.label}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main AuthPage
   ═══════════════════════════════════════════════════════════════════════════ */
export default function AuthPage() {
  const { login, signup, loginWithGoogle } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showGoogle, setShowGoogle] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(form);
      } else {
        await signup(form);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = (googleUser) => {
    setShowGoogle(false);
    loginWithGoogle(googleUser);
  };

  return (
    <>
      {showGoogle && <GoogleModal onConfirm={handleGoogle} onClose={() => setShowGoogle(false)} />}

      <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
        <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-blood-red/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-nasa-blue/10 blur-3xl" />

        <div className="panel relative w-full max-w-md p-5 sm:p-8 shadow-2xl shadow-black">
          {/* Brand */}
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-green/40 bg-black shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              <Orbit className="h-7 w-7 text-emerald-green" />
            </div>
            <h1 className="font-heading text-3xl font-bold tracking-wide text-white">ASTRA</h1>
            <p className="mt-1 text-sm text-slate-400">Explore the Universe. Discover the Unknown.</p>
          </div>

          {/* Mode tabs */}
          <div className="mb-6 grid grid-cols-2 rounded-lg border border-white/10 bg-black/50 p-1 text-sm font-semibold">
            {['login', 'signup'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(''); }}
                className={`rounded-md py-2 transition ${mode === m ? 'bg-blood-red text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {m === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          {/* Google sign-in button */}
          <button
            type="button"
            onClick={() => setShowGoogle(true)}
            className="mb-4 w-full inline-flex items-center justify-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          {/* Divider */}
          <div className="relative mb-4 flex items-center gap-3">
            <div className="flex-1 border-t border-white/10" />
            <span className="text-[11px] text-slate-500 uppercase tracking-widest">or</span>
            <div className="flex-1 border-t border-white/10" />
          </div>

          {/* Form */}
          <form onSubmit={submit} className="space-y-4">
            {mode === 'signup' && (
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  className="input-dark"
                  placeholder="Full name"
                  value={form.name}
                  onChange={set('name')}
                  autoComplete="name"
                  required
                />
              </div>
            )}

            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className="input-dark"
                type="email"
                placeholder="Email address"
                value={form.email}
                onChange={set('email')}
                autoComplete="email"
                required
              />
            </div>

            <div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  className="input-dark pr-10"
                  type={show ? 'text' : 'password'}
                  placeholder={mode === 'signup' ? 'Password (min 6 characters)' : 'Password'}
                  value={form.password}
                  onChange={set('password')}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  minLength={mode === 'signup' ? 6 : 1}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {mode === 'signup' && <PasswordStrength password={form.password} />}
            </div>

            {mode === 'signup' && (
              <ul className="text-[11px] text-slate-500 space-y-0.5 list-disc list-inside">
                <li>Valid email address required</li>
                <li>Full name required</li>
                <li>Minimum 6 characters password</li>
                <li>Registration confirmation sent to your email</li>
              </ul>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-crimson-red/40 bg-crimson-red/10 px-3 py-2 text-sm text-red-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={busy}>
              <Rocket className="h-4 w-4" />
              {busy ? 'Please wait…' : mode === 'login' ? 'Launch Dashboard' : 'Create Account & Launch'}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-500">
            Accounts are stored securely in your browser using SHA-256 hashing.
          </p>
        </div>
      </div>
    </>
  );
}
