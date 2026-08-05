import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Lock, Mail, UserRound } from 'lucide-react';
import { useEmployee } from '../../context/EmployeeContext';
import api, { notifyError, notifySuccess } from '../../Script/api';

const EmployeeAuth = () => {
  const [tab, setTab] = useState('login');
  const { employeeAuth, setEmployeeSession } = useEmployee();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);

  const canRegister = useMemo(() => (
    form.fullName.trim() &&
    form.email.trim() &&
    form.password.length >= 6 &&
    form.confirmPassword === form.password
  ), [form]);

  if (employeeAuth.isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const submitLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const res = await api.employee.auth.login({ email: form.email, password: form.password });
      const { access_token, user } = res.data?.data || res.data;
      setEmployeeSession(access_token, {
        name: user.full_name || user.email,
        email: user.email,
        plan: user.active_plan || 'free',
      });
      notifySuccess('Welcome back!');
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Login failed. Please check your credentials.';
      notifyError(typeof msg === 'string' ? msg : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const submitRegister = async (event) => {
    event.preventDefault();
    if (!canRegister) return;
    setLoading(true);
    try {
      const res = await api.employee.auth.register({
        full_name: form.fullName,
        email: form.email,
        password: form.password,
      });
      const { access_token, user } = res.data?.data || res.data;
      setEmployeeSession(access_token, {
        name: user.full_name || user.email,
        email: user.email,
        plan: user.active_plan || 'free',
      });
      notifySuccess('Account created successfully!');
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Registration failed.';
      notifyError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="employee-shell min-h-screen grid lg:grid-cols-2 px-4 py-8 lg:px-16 text-[#12344D]">
      <section className="hidden lg:flex flex-col justify-center pr-10">
        <div className="glass-card p-10 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(106,176,227,0.2),transparent_40%)]" />
          <h1 className="employee-heading text-4xl text-[#12344D] relative">Precision Dental Alignment</h1>
          <p className="text-[#12344D]/70 mt-4 relative">Powered by Advanced 3D Algorithms ✦</p>
          <div className="mt-8 h-64 rounded-2xl border border-[#6ab0e3]/50 bg-gradient-to-br from-[#c1e5ff]/50 to-[#9cd5ff]/40 relative">
            <div className="absolute inset-0 animate-pulse opacity-70 [background:radial-gradient(circle_at_40%_30%,rgba(106,176,227,0.25),transparent_45%)]" />
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center">
        <div className="glass-card w-full max-w-[520px] p-6 lg:p-8">
          <div className="flex gap-2 mb-6">
            {['login', 'register'].map((currentTab) => (
              <button
                key={currentTab}
                type="button"
                onClick={() => setTab(currentTab)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border ${tab === currentTab ? 'bg-[#072ac8] border-[#072ac8] text-white' : 'border-[#9cd5ff] text-[#12344D]/60 hover:bg-[#c1e5ff]/40'}`}
              >
                {currentTab === 'login' ? 'Login' : 'Register'}
              </button>
            ))}
          </div>

          <form className="space-y-4" onSubmit={tab === 'login' ? submitLogin : submitRegister}>
            {tab === 'register' ? (
              <div>
                <label className="text-sm text-[#12344D]/80">Full Name</label>
                <div className="relative mt-1">
                  <UserRound size={16} className="absolute top-3 left-3 text-[#12344D]/50" />
                  <input className="glass-input h-11 w-full pl-9 pr-3" value={form.fullName} onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))} required />
                </div>
              </div>
            ) : null}

            <div>
              <label className="text-sm text-[#12344D]/80">Email</label>
              <div className="relative mt-1">
                <Mail size={16} className="absolute top-3 left-3 text-[#12344D]/50" />
                <input type="email" className="glass-input h-11 w-full pl-9 pr-3" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} required />
              </div>
            </div>

            <div>
              <label className="text-sm text-[#12344D]/80">Password</label>
              <div className="relative mt-1">
                <Lock size={16} className="absolute top-3 left-3 text-[#12344D]/50" />
                <input type="password" className="glass-input h-11 w-full pl-9 pr-3" value={form.password} onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))} required />
              </div>
            </div>

            {tab === 'register' ? (
              <div>
                <label className="text-sm text-[#12344D]/80">Confirm Password</label>
                <input type="password" className="glass-input h-11 w-full px-3 mt-1" value={form.confirmPassword} onChange={(e) => setForm((s) => ({ ...s, confirmPassword: e.target.value }))} required />
              </div>
            ) : null}

            <div className="flex items-center justify-between text-sm text-[#12344D]/60 pt-1">
              <span>{tab === 'login' ? 'Forgot Password?' : 'Create secure access'}</span>
              <span className="text-[#072ac8] font-semibold">Help</span>
            </div>

            <button
              type="submit"
              disabled={(tab === 'register' && !canRegister) || loading}
              className="gradient-btn h-11 w-full text-white font-semibold disabled:opacity-40"
            >
              {loading ? 'Please wait...' : tab === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};

export default EmployeeAuth;
