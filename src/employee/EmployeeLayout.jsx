import { Navigate, Outlet, useLocation } from 'react-router-dom';
import EmployeeSidebar from './components/EmployeeSidebar';
import EmployeeTopbar from './components/EmployeeTopbar';
import WorkflowHelpFab from './components/WorkflowHelpFab';
import { useEmployee } from '../context/EmployeeContext';
import { useAuthStore } from '../store/authStore';
import { DEMO_MODE } from '../config/demoMode';

const titleByPath = {
  '/dashboard': 'Dashboard',
  '/new-case': 'New Case',
  '/my-cases': 'My Cases',
  '/library': 'Library',
  '/subscription': 'Subscription & Billing',
  '/settings': 'Settings',
};

/**
 * Zustand's persist middleware rehydrates synchronously from localStorage,
 * so by the time this component renders the auth state is already available.
 * We only show a brief skeleton if hydration is still pending (edge case).
 */
const EmployeeLayout = () => {
  const { employeeAuth } = useEmployee();
  const { pathname } = useLocation();
  const hasHydrated = useAuthStore.persist?.hasHydrated?.() ?? true;

  if (!hasHydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#050B18]">
        <div className="h-10 w-10 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!DEMO_MODE && !employeeAuth.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="employee-shell flex w-full overflow-x-hidden">
      <EmployeeSidebar />
      <div className="flex-1 min-h-screen min-w-0 lg:pl-[240px]">
        <EmployeeTopbar title={titleByPath[pathname] || 'MyPathFinder'} />
        <main className="p-3 sm:p-4 lg:p-6 max-w-full overflow-x-hidden">
          <Outlet />
        </main>
      </div>
      <WorkflowHelpFab />
    </div>
  );
};

export default EmployeeLayout;
