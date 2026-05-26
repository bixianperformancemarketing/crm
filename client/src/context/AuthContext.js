import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [org, setOrg] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    sessionStorage.clear();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('workspaceId');
    setUser(null);
    setOrg(null);
    setWorkspace(null);
    window.location.href = '/login';
  }, []);

  const setAuthData = useCallback((token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    if (userData.workspaceId) localStorage.setItem('workspaceId', userData.workspaceId);
    setUser(userData);
    setOrg(userData.organization || null);
    setWorkspace(userData.workspace || null);
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await authAPI.login({ email, password });
    setAuthData(data.token, data.user);
    return data;
  }, [setAuthData]);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await authAPI.getMe();
      setUser(data.user);
      setOrg(data.user.organization || null);
      setWorkspace(data.user.workspace || null);
    } catch {
      logout();
    }
  }, [logout]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    authAPI.getMe()
      .then(({ data }) => {
        setUser(data.user);
        setOrg(data.user.organization || null);
        setWorkspace(data.user.workspace || null);
      })
      .catch(() => { localStorage.removeItem('token'); })
      .finally(() => setLoading(false));
  }, []);

  const hasFeature = useCallback((feature) => {
    if (!org) return false;
    return !!org[feature];
  }, [org]);

  const isRole = useCallback((...roles) => {
    if (!user) return false;
    return roles.includes(user.role);
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user, org, workspace, loading,
      login, logout, setAuthData, refreshUser,
      hasFeature, isRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export default AuthContext;
