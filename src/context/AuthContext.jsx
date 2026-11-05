import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

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

  // Strong sign-up validation: valid email, min 6 characters password, full name required
  const signup = useCallback(async ({ name, email, password }) => {
    const cleanName = (name || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanName) {
      throw new Error('Please enter your full name.');
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error('Please enter a valid email address (e.g. user@example.com).');
    }
    if (!password || password.length < 6) {
      throw new Error('Strong password required: minimum 6 characters.');
    }

    const users = readUsers();
    if (users.some((u) => u.email === cleanEmail)) {
      throw new Error('An account with this email already exists. Please sign in instead.');
    }

    const record = { name: cleanName, email: cleanEmail, hash: await hashPassword(password), provider: 'password' };
    localStorage.setItem(USERS_KEY, JSON.stringify([...users, record]));
    const session = { name: record.name, email: record.email, provider: 'password' };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setUser(session);
  }, []);

  // Strong login validation: verifies account exists and password hash matches
  const login = useCallback(async ({ email, password }) => {
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error('Please enter a valid email address.');
    }
    if (!password || password.length < 1) {
      throw new Error('Please enter your password.');
    }

    const users = readUsers();
    const found = users.find((u) => u.email === cleanEmail);

    if (!found) {
      throw new Error('No account found with this email. Please create an account first.');
    }

    const hashed = await hashPassword(password);
    if (found.hash !== hashed) {
      throw new Error('Incorrect password. Please verify your credentials and try again.');
    }

    const session = { name: found.name, email: found.email, provider: found.provider || 'password' };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setUser(session);
  }, []);

  // Google Sign-in / Sign-up option
  const loginWithGoogle = useCallback((googleUser) => {
    const email = (googleUser?.email || 'cosmic.explorer@gmail.com').trim().toLowerCase();
    const name = (googleUser?.name || 'Cosmic Explorer').trim();
    const avatar = googleUser?.avatar || null;

    const users = readUsers();
    const existingIndex = users.findIndex((u) => u.email === email);
    if (existingIndex >= 0) {
      users[existingIndex].provider = 'google';
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } else {
      users.push({ name, email, hash: 'google-oauth', provider: 'google', avatar });
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }

    const session = { name, email, avatar, provider: 'google' };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setUser(session);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, signup, login, loginWithGoogle, logout }),
    [user, ready, signup, login, loginWithGoogle, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
