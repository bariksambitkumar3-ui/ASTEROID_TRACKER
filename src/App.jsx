import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { AsteroidProvider } from './context/AsteroidContext.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Header from './components/Header.jsx';
import SolarSystem3D from './components/SolarSystem3D.jsx';

function Shell() {
  const { user, ready } = useAuth();
  const [view, setView] = useState('dashboard');
  const [pendingSection, setPendingSection] = useState(null);

  useEffect(() => {
    if (view === 'solar') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (view === 'dashboard' && pendingSection) {
      document.getElementById(pendingSection)?.scrollIntoView({ behavior: 'smooth' });
      setPendingSection(null);
    }
  }, [view, pendingSection]);

  const navigate = (section) => {
    if (section === 'solar') {
      setView('solar');
      setPendingSection(null);
      return;
    }
    setPendingSection(section);
    setView('dashboard');
  };

  if (!ready) return null;
  if (!user) return <AuthPage />;

  return (
    <div className="app-shell min-h-screen md:flex">
      <Header view={view} onNavigate={navigate} />
      <main className="min-w-0 flex-1">
        {view === 'dashboard' && <Dashboard />}
        {view === 'solar' && (
          <div className="mx-auto max-w-[1600px] px-4 py-6">
            <SolarSystem3D />
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AsteroidProvider>
        <Shell />
      </AsteroidProvider>
    </AuthProvider>
  );
}
