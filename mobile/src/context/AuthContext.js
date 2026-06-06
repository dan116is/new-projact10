// Holds the auth token + current user, persisted to AsyncStorage.
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api';

const TOKEN_KEY = 'pk_token';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore a saved session on launch.
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(TOKEN_KEY);
        if (saved) {
          const { user } = await api.me(saved);
          setToken(saved);
          setUser(user);
        }
      } catch {
        await AsyncStorage.removeItem(TOKEN_KEY);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = useCallback(async (tok, usr) => {
    setToken(tok);
    setUser(usr);
    await AsyncStorage.setItem(TOKEN_KEY, tok);
  }, []);

  const login = useCallback(
    async (email, password) => {
      const { token, user } = await api.login({ email, password });
      await persist(token, user);
    },
    [persist]
  );

  const register = useCallback(
    async (payload) => {
      const { token, user } = await api.register(payload);
      await persist(token, user);
    },
    [persist]
  );

  const logout = useCallback(async () => {
    setToken(null);
    setUser(null);
    await AsyncStorage.removeItem(TOKEN_KEY);
  }, []);

  // Re-fetch the current user (e.g. after a subscription changes).
  const refreshUser = useCallback(async () => {
    if (!token) return null;
    const { user } = await api.me(token);
    setUser(user);
    return user;
  }, [token]);

  const updateProfile = useCallback(
    async (payload) => {
      const { user } = await api.updateMe(payload, token);
      setUser(user);
      return user;
    },
    [token]
  );

  return (
    <AuthContext.Provider
      value={{ token, user, loading, login, register, logout, refreshUser, updateProfile, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
