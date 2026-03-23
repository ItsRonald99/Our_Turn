import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, setToken, setRefreshCallback } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [houses, setHouses] = useState([]);
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
      const fetched = res.data ?? [];
      if (isMounted.current) {
        setHouses(fetched);
        setActiveHouseId(fetched.length > 0 ? fetched[0].id : null);
      }
    } catch {
      if (isMounted.current) {
        setHouses([]);
        setActiveHouseId(null);
      }
    }
  }, []);

  const clearAuth = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setHouses([]);
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
      .catch((err) => {
     



      })
      .finally(() => {



        setIsLoading(false);
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
      const fetched = res.data ?? [];
      setHouses(fetched);
      if (fetched.length > 0) {
        setActiveHouseId((prev) => prev ?? fetched[0].id);
      } else {
        setActiveHouseId(null);
      }
      return fetched;
    } catch {
      return [];
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, accessToken, houses, activeHouseId, setActiveHouseId, isLoading, login, register, logout, refreshHouses }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
