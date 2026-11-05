import { useState } from 'react';
import { AlertTriangle, Eye, EyeOff, Lock, Mail, Orbit, Rocket, Sparkles, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function AuthPage() {
  const { login, signup, demoLogin } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(form);
      else await signup(form);
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-blood-red/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-nasa-blue/10 blur-3xl" />

      <div className="panel relative w-full max-w-md p-8 shadow-2xl shadow-black">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-green/40 bg-black shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            <Orbit className="h-7 w-7 text-emerald-green" />
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-wide text-white">ASTRA</h1>
          <p className="mt-1 text-sm text-slate-400">Explore the Universe. Discover the Unknown.</p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-lg border border-white/10 bg-black/50 p-1 text-sm font-semibold">
          {['login', 'signup'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError('');
              }}
              className={`rounded-md py-2 transition ${
                mode === m ? 'bg-blood-red text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {m === 'login' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === 'signup' && (
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className="input-dark"
                placeholder="Full name (optional)"
                value={form.name}
                onChange={set('name')}
                autoComplete="name"
              />
            </div>
          )}
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              className="input-dark"
              type="text"
              placeholder="Username or Email"
              value={form.email}
              onChange={set('email')}
              autoComplete="username"
              required
            />
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              className="input-dark pr-10"
              type={show ? 'text' : 'password'}
              placeholder="Password"
              value={form.password}
              onChange={set('password')}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
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

          <p className="text-[11px] text-slate-500">
            Minimum criteria: Any username/email and any password (min 1 char).
          </p>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-crimson-red/40 bg-crimson-red/10 px-3 py-2 text-sm text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            <Rocket className="h-4 w-4" />
            {busy ? 'Please wait…' : mode === 'login' ? 'Launch dashboard' : 'Create account & launch'}
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-white/10 text-center">
          <button
            type="button"
            onClick={demoLogin}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition"
          >
            <Sparkles className="h-4 w-4" />
            <span>Instant Access (1-Click Demo Login)</span>
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          Demo authentication: accounts are stored locally in this browser.
        </p>
      </div>
    </div>
  );
}
