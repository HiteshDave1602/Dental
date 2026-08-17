import { createContext, useContext, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { DEMO_EMPLOYEE, DEMO_MODE } from '../config/demoMode';

/**
 * EmployeeContext is now a thin wrapper over the Zustand authStore.
 * All state is persisted in localStorage via Zustand's persist middleware,
 * so user data survives page refreshes without any extra work.
 *
 * Public interface is intentionally unchanged so existing consumers
 * (Sidebar, Topbar, Layout, Auth page) need no modifications.
 */
const EmployeeContext = createContext();

export const EmployeeProvider = ({ children }) => {
  const { token, user, setSession, logout, updateUser } = useAuthStore();

  const setEmployeeSession = (nextToken, nextUser) => {
    if (nextToken) {
      setSession(nextToken, nextUser ?? { name: '', email: '', plan: 'free' });
    } else {
      logout();
    }
  };

  const value = useMemo(
    () => ({
      employeeAuth: {
        isAuthenticated: DEMO_MODE || Boolean(token),
        token,
      },
      employeeUser: user ?? (DEMO_MODE ? DEMO_EMPLOYEE : { name: '', email: '', plan: 'free' }),
      setEmployeeSession,
      logoutEmployee: logout,
      updateEmployeeUser: updateUser,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, user]
  );

  return <EmployeeContext.Provider value={value}>{children}</EmployeeContext.Provider>;
};

export const useEmployee = () => {
  const ctx = useContext(EmployeeContext);
  if (!ctx) throw new Error('useEmployee must be used within EmployeeProvider');
  return ctx;
};
