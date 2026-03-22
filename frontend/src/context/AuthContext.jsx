import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, setToken, setRefreshCallback } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [activeHouseId, setActiveHouseId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  const applyAuth = useCallback(async (u, token) => {
    setUser(u);
    setAccessToken(token);
    setToken(token);

    try {
      const res = await api.getHouses();
      const houses = res.data ?? [];
      if (isMounted.current) {
        setActiveHouseId(houses.length > 0 ? houses[0].id : null);
      }
    } catch {
      if (isMounted.current) setActiveHouseId(null);
    }
  }, []);

  const clearAuth = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setActiveHouseId(null);
    setToken(null);
  }, []);

  // On mount: attempt silent token refresh to restore session
  useEffect(() => {
    setRefreshCallback((newToken) => {
      if (!newToken) clearAuth();
      else setAccessToken(newToken);
    });

    api.refreshToken()
      .then(async (res) => {
        if (isMounted.current) {
          await applyAuth(res.data.user, res.data.accessToken);
        }
      })
      .catch(() => {
        // No valid session, stay logged out
      })
      .finally(() => {
        if (isMounted.current) setIsLoading(false);
      });
  }, [applyAuth, clearAuth]);

  const login = useCallback(async (email, password) => {
    const res = await api.login({ email, password });
    await applyAuth(res.data.user, res.data.accessToken);
    return res.data;
  }, [applyAuth]);

  const register = useCallback(async (email, password, displayName) => {
    const res = await api.register({ email, password, displayName });
    await applyAuth(res.data.user, res.data.accessToken);
    return res.data;
  }, [applyAuth]);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch { /* ignore */ }
    clearAuth();
  }, [clearAuth]);

  const refreshHouses = useCallback(async () => {
    try {
      const res = await api.getHouses();
      const houses = res.data ?? [];
      setActiveHouseId(houses.length > 0 ? houses[0].id : null);
    } catch { /* ignore */ }
  }, []);

  return (
    <AuthContext.Provider value={{ user, accessToken, activeHouseId, isLoading, login, register, logout, refreshHouses }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
