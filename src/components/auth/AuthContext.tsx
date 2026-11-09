import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi, ApiError, type User } from '../../lib/api';
import { getToken, SESSION_EXPIRED_EVENT, setToken } from '../../lib/session';
import { useToast } from '../ui/Toast';

interface AuthState {
  user: User | null;
  /** True while the saved token is being checked on first load */
  checking: boolean;
  /** `identifier` is the user's email or username */
  login: (identifier: string, password: string) => Promise<User>;
  signup: (name: string, username: string, email: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(() => !!getToken());

  // Restore the session from a saved token
  useEffect(() => {
    if (!getToken()) return;
    authApi
      .me()
      .then(setUser)
      .catch((err) => {
        // Only drop the token if the server rejected it, not if it was unreachable
        if (err instanceof ApiError && err.status === 401) setToken(null);
        else toast(err instanceof ApiError ? err.message : 'Could not restore your session', 'error');
      })
      .finally(() => setChecking(false));
  }, [toast]);

  // Any API call that gets a 401 signs the user out
  useEffect(() => {
    const onExpired = () => {
      setUser((current) => {
        if (current) toast('Your session has expired. Please sign in again.', 'warning');
        return null;
      });
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [toast]);

  const login = useCallback(async (identifier: string, password: string) => {
    const res = await authApi.login(identifier, password);
    setToken(res.access_token);
    setUser(res.user);
    return res.user;
  }, []);

  const signup = useCallback(async (name: string, username: string, email: string, password: string) => {
    const res = await authApi.signup(name, username, email, password);
    setToken(res.access_token);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, checking, login, signup, logout }),
    [user, checking, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
