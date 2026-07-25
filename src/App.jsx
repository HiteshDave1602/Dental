import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { GlobalProvider, useGlobal } from './context/GlobalContext';
import DashboardLayout from './components/layout/DashboardLayout';
import { ToastContainer } from 'react-toastify';
import { ContextProviderClass } from './ContextProvider';
import { EmployeeProvider, useEmployee } from './context/EmployeeContext';
import './employee/employee.css';
import EmployeeLayout from './employee/EmployeeLayout';
import EmployeeAuth from './employee/pages/EmployeeAuth';
import EmployeeDashboard from './employee/pages/EmployeeDashboard';
import EmployeeNewCase from './employee/pages/EmployeeNewCase';
import EmployeeMyCases from './employee/pages/EmployeeMyCases';
import EmployeeLibrary from './employee/pages/EmployeeLibrary';
import EmployeeSubscription from './employee/pages/EmployeeSubscription';
import EmployeeSettings from './employee/pages/EmployeeSettings';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
// ToleranceConfig removed: a static page with hardcoded vendor names, a
// "± %" input (tolerance is measured in degrees), no state and a Save button
// with no handler. Tolerance is configured per implant library, in degrees,
// on the library form — this duplicated that concept in the wrong unit.
const UserManagement = lazy(() => import('./pages/UserManagement'));
const Billing = lazy(() => import('./pages/Billing'));
const UpdateLibrary = lazy(() => import('./pages/UpdateLibrary'));
const LibraryManagement = lazy(() => import('./pages/LibraryManagement'));
const SubscriptionPlans = lazy(() => import('./pages/SubscriptionPlans'));
const AccountSettings = lazy(() => import('./pages/AccountSettings'));

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-full min-h-[400px]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-clinical-blue"></div>
  </div>
);

const AdminAppRouter = () => {
  const { auth } = useGlobal();

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {!auth.isAuthenticated ? (
          <>
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : (
          <>
            <Route path="/" element={<DashboardLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="library" element={<LibraryManagement />} />
              <Route path="library/edit/:id" element={<UpdateLibrary />} />
              <Route path="payments" element={<Billing />} />
              <Route path="plans" element={<SubscriptionPlans />} />
              <Route path="settings" element={<AccountSettings />} />
            </Route>
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </Suspense>
  );
};

const EmployeeAppRouter = () => {
  const { employeeAuth } = useEmployee();

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {!employeeAuth.isAuthenticated ? (
          <>
            <Route path="/login" element={<EmployeeAuth />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : (
          <>
            <Route path="/" element={<EmployeeLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<EmployeeDashboard />} />
              <Route path="new-case" element={<EmployeeNewCase />} />
              <Route path="my-cases" element={<EmployeeMyCases />} />
              <Route path="library" element={<EmployeeLibrary />} />
              <Route path="subscription" element={<EmployeeSubscription />} />
              <Route path="settings" element={<EmployeeSettings />} />
            </Route>
            <Route path="/login" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </>
        )}
      </Routes>
    </Suspense>
  );
};

const RootRouter = () => {
  const isAdminHost = typeof window !== 'undefined' && window.location.hostname.startsWith('admin.');

  useEffect(() => {
    document.body.classList.toggle('employee-theme', !isAdminHost);
    return () => {
      document.body.classList.remove('employee-theme');
    };
  }, [isAdminHost]);

  if (isAdminHost) {
    return (
      <GlobalProvider>
        <ContextProviderClass>
          <AdminAppRouter />
        </ContextProviderClass>
      </GlobalProvider>
    );
  }

  return (
    <EmployeeProvider>
      <EmployeeAppRouter />
    </EmployeeProvider>
  );
};

function App() {
  return (
    <Router>
      <RootRouter />
      <ToastContainer position="bottom-right" autoClose={4000} />
    </Router>
  );
}

export default App;
