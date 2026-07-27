import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEMO_ADMIN, DEMO_MODE } from '../config/demoMode';

const GlobalContext = createContext();

// No placeholder identity. This returned a fictional "Dr. Jane Smith / Main
// Dentist" when logged out, which rendered briefly on load and in any state
// where the real profile had not arrived yet.
const getStoredAuth = () => {
    const token = sessionStorage.getItem('token');
    return {
        auth: { isAuthenticated: DEMO_MODE || Boolean(token), token: token || null },
        user: DEMO_MODE ? DEMO_ADMIN : { name: '', role: '' },
    };
};

export const GlobalProvider = ({ children }) => {
    const storedState = getStoredAuth();
    const [user, setUser] = useState(storedState.user);
    const [auth, setAuth] = useState(storedState.auth);
    // Zeroed, not invented. These were seeded with realistic-looking figures
    // (1250 patients, $4,250 revenue) that displayed as though they were this
    // deployment's real numbers until — or unless — an API call replaced them.
    const [dashboardStats, setDashboardStats] = useState({
        totalPatients: 0,
        appointmentsToday: 0,
        revenue: null,
        newInquiries: 0,
    });

    useEffect(() => {
        if (auth.token) {
            sessionStorage.setItem('token', auth.token);
        } else {
            sessionStorage.removeItem('token');
        }
    }, [auth.token]);

    useEffect(() => {
        // Never persist user profile data in browser storage.
        sessionStorage.removeItem('user');
        localStorage.removeItem('user');
    }, []);

    const logout = () => {
        setAuth({ isAuthenticated: DEMO_MODE, token: null });
        setUser(DEMO_MODE ? DEMO_ADMIN : { name: '', role: '' });
        sessionStorage.removeItem('user');
        localStorage.removeItem('user');
    };

    const value = useMemo(() => ({
        user, setUser,
        auth, setAuth,
        dashboardStats, setDashboardStats,
        logout,
    }), [user, auth, dashboardStats]);

    return (
        <GlobalContext.Provider value={value}>
            {children}
        </GlobalContext.Provider>
    );
};

export const useGlobal = () => {
    const context = useContext(GlobalContext);
    if (!context) {
        throw new Error('useGlobal must be used within a GlobalProvider');
    }
    return context;
};
