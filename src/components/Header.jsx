import { Bot, ChartNoAxesColumn, CloudSun, Home, LogOut, Orbit } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const TABS = [
  { id: 'hero', label: 'Dashboard', icon: Home, section: 'hero' },
  { id: 'asteroids', label: 'Asteroids', icon: ChartNoAxesColumn, section: 'asteroid-catalog' },
  { id: 'solar', label: '3D Solar System', icon: Orbit },
  { id: 'weather-space', label: 'Weather & Space', icon: CloudSun, section: 'weather-space' },
  { id: 'ai', label: 'AI Assistant', icon: Bot },
];

export default function Header({ view, onNavigate, onToggleAI, aiOpen }) {
  const { user, logout } = useAuth();
  return (
    <aside className="site-sidebar">
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
            const isSolar = id === 'solar';
            const isActive =
              isAI
                ? aiOpen
                : (isSolar && view === 'solar') ||
                  (!isSolar && view === 'dashboard' && id === 'hero');

            return (
              <button
                key={id}
                onClick={() => {
                  if (isAI) {
                    onToggleAI();
                  } else if (isSolar) {
                    onNavigate('solar');
                  } else {
                    onNavigate(TABS.find((t) => t.id === id)?.section);
                  }
                }}
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
  );
}
