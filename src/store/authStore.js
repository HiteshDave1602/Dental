import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const EMPLOYEE_TOKEN_KEY = 'employee_token';

/**
 * Employee session.
 *
 * Persisted to sessionStorage, deliberately. Zustand's `persist` defaults to
 * localStorage, which meant the bearer token was written there permanently
 * while `api.js` read it from sessionStorage — so opening a new tab rehydrated
 * the store (the UI looked logged in) but every request went out without a
 * token and 401'd. Same storage on both sides, and the session ends with the
 * tab, which is the right lifetime for a clinical login.
 */
export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      user: null,   // { name, email, plan }

      setSession: (token, user) => {
        sessionStorage.setItem(EMPLOYEE_TOKEN_KEY, token);
        set({ token, user });
      },

      updateUser: (user) => set({ user }),

      logout: () => {
        sessionStorage.removeItem(EMPLOYEE_TOKEN_KEY);
        set({ token: null, user: null });
      },
    }),
    {
      name: 'mpf-employee-auth',
      storage: createJSONStorage(() => sessionStorage),
      // Only persist token + user — anything else is transient
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);
