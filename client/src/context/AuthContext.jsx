import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { login as apiLogin, getMe } from '../api/auth';
import { tokenStore, UNAUTHORIZED_EVENT } from '../api/client';

const AuthContext = createContext(null);

// status: 'loading' | 'authenticated' | 'guest' | 'error'
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(() => (tokenStore.get() ? 'loading' : 'guest'));
  const [notice, setNotice] = useState('');
  // After a session expiry we send the user back to the page they were on; after a
  // manual sign-out we don't, so the next person starts on their own dashboard.
  const [keepReturnPath, setKeepReturnPath] = useState(true);

  // `message` is shown on the login page; passing one marks an automatic sign-out (e.g. expiry).
  const logout = useCallback((message = '') => {
    tokenStore.clear();
    setUser(null);
    setStatus('guest');
    setNotice(message);
    setKeepReturnPath(Boolean(message));
  }, []);

  const loadUser = useCallback(async () => {
    setStatus('loading');
    try {
      const { user: me } = await getMe();
      setUser(me);
      setStatus('authenticated');
    } catch (err) {
      // 401 is handled by the UNAUTHORIZED_EVENT listener; other errors (server down) keep the token.
      if (err.status !== 401) setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (tokenStore.get()) loadUser();
  }, [loadUser]);

  useEffect(() => {
    const onUnauthorized = () => logout('Your session has expired. Please sign in again.');
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [logout]);

  const login = useCallback(async (email, password) => {
    const { token } = await apiLogin(email, password);
    tokenStore.set(token);
    const { user: me } = await getMe();
    setUser(me);
    setStatus('authenticated');
    setNotice('');
    setKeepReturnPath(true);
    return me;
  }, []);

  // Re-fetches the current user (e.g. to get an updated leave balance).
  const refreshUser = useCallback(async () => {
    const { user: me } = await getMe();
    setUser(me);
    return me;
  }, []);

  const value = useMemo(
    () => ({ user, status, notice, keepReturnPath, login, logout, refreshUser, retry: loadUser }),
    [user, status, notice, keepReturnPath, login, logout, refreshUser, loadUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
