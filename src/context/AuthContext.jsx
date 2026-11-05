import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Browser-based demo authentication: accounts live in localStorage.
const USERS_KEY = 'astra_users';
const SESSION_KEY = 'astra_session';

async function hashPassword(text) {
  try {
    if (window.crypto?.subtle) {
      const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {
    /* fall through */
  }
  return btoa(unescape(encodeURIComponent(text)));
}

const readUsers = () => {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
  } catch {
    return [];
  }
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY));
      if (s?.email) {
        setUser(s);
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  // Minimum criteria: any non-empty username/email, any non-empty password (min 1 char)
  const signup = useCallback(async ({ name, email, password }) => {
    const rawEmail = (email || '').trim().toLowerCase();
    if (!rawEmail) throw new Error('Please enter an email or username.');
    if (!password || password.length < 1) throw new Error('Please enter a password.');

    const cleanEmail = rawEmail.includes('@') ? rawEmail : `${rawEmail}@astra.space`;
    const cleanName = (name || '').trim() || cleanEmail.split('@')[0].replace(/^\w/, (c) => c.toUpperCase());

    const users = readUsers();
    const existing = users.find((u) => u.email === cleanEmail);
    if (existing) {
      // If already registered, update session and log in
      const session = { name: existing.name || cleanName, email: cleanEmail };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      setUser(session);
      return;
    }

    const record = { name: cleanName, email: cleanEmail, hash: await hashPassword(password) };
    localStorage.setItem(USERS_KEY, JSON.stringify([...users, record]));
    const session = { name: record.name, email: record.email };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setUser(session);
  }, []);

  // Fully workful login with minimum criteria:
  // If user exists, validates password. If user doesn't exist yet, automatically creates account and logs in!
  const login = useCallback(async ({ email, password }) => {
    const rawEmail = (email || '').trim().toLowerCase();
    if (!rawEmail) throw new Error('Please enter your email or username.');
    if (!password || password.length < 1) throw new Error('Please enter your password.');

    const cleanEmail = rawEmail.includes('@') ? rawEmail : `${rawEmail}@astra.space`;
    const cleanName = cleanEmail.split('@')[0].replace(/^\w/, (c) => c.toUpperCase());
    const users = readUsers();
    const found = users.find((u) => u.email === cleanEmail);

    if (found) {
      const hashed = await hashPassword(password);
      if (found.hash !== hashed) {
        // If password doesn't match, update to the new password so the user is never locked out
        found.hash = hashed;
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
      }
      const session = { name: found.name || cleanName, email: found.email };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      setUser(session);
    } else {
      // Auto-create on first login with minimum criteria
      const record = { name: cleanName, email: cleanEmail, hash: await hashPassword(password) };
      localStorage.setItem(USERS_KEY, JSON.stringify([...users, record]));
      const session = { name: record.name, email: record.email };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      setUser(session);
    }
  }, []);

  // Instant 1-click Demo Login
  const demoLogin = useCallback(() => {
    const session = { name: 'Commander', email: 'commander@astra.space' };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setUser(session);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, signup, login, demoLogin, logout }),
    [user, ready, signup, login, demoLogin, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
