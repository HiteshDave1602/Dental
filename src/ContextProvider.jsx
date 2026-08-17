import { createContext, useContext, useEffect, useState } from 'react';
import api from './Script/api';
import { DEMO_ADMIN, DEMO_MODE } from './config/demoMode';

export const ContextProvider = createContext();

export const ContextProviderClass = ({ children }) => {
  const [user, setUser] = useState(DEMO_MODE ? DEMO_ADMIN : null);
  const [adminToken, setAdminToken] = useState(null);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const tokenFromSession = sessionStorage.getItem('token');
    setAdminToken(tokenFromSession || null);
  }, []);

  useEffect(() => {
    const tokenFromSession = sessionStorage.getItem('token');
    if (tokenFromSession !== adminToken) {
      setAdminToken(tokenFromSession || null);
    }
  });

  const refreshCurrentAdmin = async (token = adminToken) => {
    if (DEMO_MODE) {
      setUser(DEMO_ADMIN);
      setError(null);
      return DEMO_ADMIN;
    }

    if (!token) {
      setUser(null);
      return null;
    }

    try {
      setIsProcessing(true);
      const response = await api.admin.getCurrentAdmin(token);
      const payload = response.data || response;
      setUser(payload);
      setError(null);
      return payload;
    } catch {
      setUser(null);
      setError('Error fetching user data');
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (!DEMO_MODE) {
      refreshCurrentAdmin(adminToken);
    }
  }, [adminToken]);

  return (
    <ContextProvider.Provider value={{
      user,
      setUser,
      error,
      setError,
      adminToken,
      setAdminToken,
      isProcessing,
      setIsProcessing,
      refreshCurrentAdmin,
    }}>
      {children}
    </ContextProvider.Provider>
  );
};

export const useContextProvider = () => {
  const context = useContext(ContextProvider);
  if (!context) {
    throw new Error('useContextProvider must be used within ContextProviderClass');
  }
  return context;
};
