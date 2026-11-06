import { useState } from 'react';
import { Bot, ChartNoAxesColumn, CloudSun, Home, LogOut, Orbit, Sparkles, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const TABS = [
  { id: 'hero', label: 'Dashboard', icon: Home, section: 'hero' },
  { id: 'asteroids', label: 'Asteroids', icon: ChartNoAxesColumn, section: 'asteroid-catalog' },
  { id: 'solar', label: '3D Solar', icon: Orbit },
  { id: 'weather-space', label: 'Weather', icon: CloudSun, section: 'weather-space' },
  { id: 'ai', label: 'ASTRA AI', icon: Bot },
];

export default function Header({ view, onNavigate, onToggleAI, aiOpen }) {
  const { user, logout } = useAuth();
  const [showMobileUser, setShowMobileUser] = useState(false);

  const handleTabClick = (id) => {
    if (id === 'ai') {
      onToggleAI();
    } else if (id === 'solar') {
      onNavigate('solar');
    } else {
      onNavigate(TABS.find((t) => t.id === id)?.section);
    }
  };

  const getIsActive = (id) => {
    if (id === 'ai') return aiOpen;
    if (id === 'solar') return view === 'solar';
    return view === 'dashboard' && id === 'hero';
  };

  return (
    <>
      {/* ══════════════════════════════════════════════════════════════════
          1. MOBILE TOP HEADER (Screens < 768px)
      ══════════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#03060d]/95 px-4 py-2.5 backdrop-blur md:hidden">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-red-500/40 bg-black shadow-[0_0_12px_rgba(239,68,68,0.35)]">
            <Orbit className="h-4 w-4 text-red-500 animate-[spin_12s_linear_infinite]" />
          </div>
          <div>
            <span className="font-heading text-lg font-bold tracking-wider text-white">ASTRA</span>
            <span className="ml-1.5 inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.2 text-[9px] font-semibold text-emerald-400 border border-emerald-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
            </span>
          </div>
        </div>

        {/* Right action pills: AI shortcut + User Profile toggle */}
        <div className="flex items-center gap-2">
          {/* Quick AI button */}
          <button
            onClick={onToggleAI}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
              aiOpen
                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
            }`}
            aria-label="Toggle AI assistant"
          >
            <Sparkles className="h-3 w-3 text-emerald-400" />
            <span>AI</span>
          </button>

          {/* User profile toggle */}
          <div className="relative">
            <button
              onClick={() => setShowMobileUser((s) => !s)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:text-white"
              aria-label="User account"
            >
              <UserIcon className="h-4 w-4" />
            </button>

            {/* Mobile user dropdown menu */}
            {showMobileUser && (
              <div className="absolute right-0 top-10 z-50 w-56 rounded-xl border border-white/15 bg-[#0b0e17] p-3 shadow-2xl backdrop-blur">
                <div className="border-b border-white/10 pb-2 mb-2">
                  <p className="text-xs font-bold text-white truncate">{user?.name || 'Explorer'}</p>
                  <p className="text-[11px] text-slate-400 truncate font-mono">{user?.email}</p>
                </div>
                <button
                  onClick={() => {
                    setShowMobileUser(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════
          2. MOBILE BOTTOM NAVIGATION BAR (Screens < 768px)
      ══════════════════════════════════════════════════════════════════ */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-white/10 bg-[#050811]/95 px-1 py-1.5 backdrop-blur shadow-[0_-8px_20px_rgba(0,0,0,0.7)] md:hidden pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = getIsActive(id);
          const isAI = id === 'ai';

          return (
            <button
              key={id}
              onClick={() => handleTabClick(id)}
              className={`relative flex flex-col items-center justify-center gap-1 rounded-xl px-2.5 py-1.5 transition ${
                isActive
                  ? isAI
                    ? 'text-emerald-400 font-bold bg-emerald-500/15'
                    : 'text-red-400 font-bold bg-red-500/15'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative">
                <Icon className={`h-5 w-5 ${isActive ? (isAI ? 'text-emerald-400' : 'text-red-400') : ''}`} />
                {isAI && (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-[#050811]" />
                )}
              </div>
              <span className="text-[10px] leading-tight">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* ══════════════════════════════════════════════════════════════════
          3. DESKTOP & TABLET SIDEBAR (Screens >= 768px)
      ══════════════════════════════════════════════════════════════════ */}
      <aside className="site-sidebar hidden md:flex">
        <div className="sidebar-inner">
          <div className="brand-lockup">
            <div className="brand-mark">
              <Orbit className="h-7 w-7" aria-hidden="true" />
            </div>
            <div className="brand-name">ASTRA</div>
            <div className="brand-caption">Asteroid Tracker</div>
          </div>

          <nav className="sidebar-nav" aria-label="Main navigation">
            {TABS.map(({ id, label, icon: Icon }) => {
              const isAI = id === 'ai';
              const isActive = getIsActive(id);

              return (
                <button
                  key={id}
                  onClick={() => handleTabClick(id)}
                  className={`sidebar-link ${isActive ? 'is-active' : ''} ${isAI ? 'sidebar-link-ai' : ''}`}
                  aria-label={label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                  {isAI && (
                    <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[9px] font-bold text-emerald-400">
                      AI
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-tagline">Explore <i /> Track <i /> Discover</div>
            <div className="sidebar-user">
              <div className="sidebar-user-name">{user?.name}</div>
              <div className="sidebar-user-email">{user?.email}</div>
            </div>
            <button onClick={logout} className="sidebar-logout" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
