import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { useEmployee } from '../../context/EmployeeContext';
import api, { notifyError, notifySuccess } from '../../Script/api';
import alignmentVideo from '../../assets/Untitled design.mp4';

const EmployeeAuth = () => {
  const [tab, setTab] = useState('login');
  const { employeeAuth, setEmployeeSession } = useEmployee();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [videoTransition, setVideoTransition] = useState('');
  const transitionTimer = useRef(null);
  const isRegistering = tab === 'register';

  const canRegister = useMemo(() => (
    form.fullName.trim() && form.email.trim() && form.password.length >= 6 && form.confirmPassword === form.password
  ), [form]);

  useEffect(() => () => window.clearTimeout(transitionTimer.current), []);

  if (employeeAuth.isAuthenticated) return <Navigate to="/dashboard" replace />;

  const changeTab = (nextTab) => {
    if (nextTab === tab) return;
    window.clearTimeout(transitionTimer.current);
    setVideoTransition(nextTab === 'register' ? 'md:animate-auth-video-to-register' : 'md:animate-auth-video-to-login');
    setTab(nextTab);
    setShowPassword(false);
    transitionTimer.current = window.setTimeout(() => setVideoTransition(''), 1000);
  };

  const submitLogin = (event) => {
    event.preventDefault();
    setLoading(true);
    setEmployeeSession('local-dashboard-access', { name: form.email || 'Demo Dentist', email: form.email, plan: 'free' });
    notifySuccess('Welcome back!');
    setLoading(false);
  };

  const submitRegister = async (event) => {
    event.preventDefault();
    if (!canRegister) return;
    setLoading(true);
    try {
      const res = await api.employee.auth.register({ full_name: form.fullName, email: form.email, password: form.password });
      const { access_token, user } = res.data?.data || res.data;
      setEmployeeSession(access_token, { name: user.full_name || user.email, email: user.email, plan: user.active_plan || 'free' });
      notifySuccess('Account created successfully!');
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Registration failed.';
      notifyError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  const inputClass = `${isRegistering ? 'h-10 py-2' : 'h-[52px] py-3'} w-full rounded-xl border border-[#c9e5fa] bg-[#f7fbff] px-4 text-[#102e4a] outline-none transition placeholder:text-[#91a9bd] focus:border-[#2d77dc] focus:bg-white focus:shadow-[0_0_0_4px_rgba(104,184,235,0.2)]`;
  const labelClass = `block text-sm font-semibold text-[#12344D] ${isRegistering ? 'mb-1' : 'mb-2'}`;

  return (
    <main className="employee-shell relative flex min-h-screen items-center justify-center overflow-hidden bg-[#061638] px-5 py-10 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_13%_5%,rgba(47,104,235,0.55),transparent_29%),radial-gradient(circle_at_85%_92%,rgba(20,184,166,0.20),transparent_31%),linear-gradient(128deg,#102d82_0%,#0b2580_37%,#07194a_66%,#030b22_100%)]" />
      <div className="absolute inset-0 opacity-[0.09] [background-image:linear-gradient(rgba(174,220,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(174,220,255,0.8)_1px,transparent_1px)] [background-size:72px_72px]" />

      <section className="relative z-10 w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/20 bg-white shadow-2xl shadow-black/30 md:min-h-[590px]">
        <aside className={`relative z-20 min-h-[330px] overflow-hidden p-8 shadow-2xl shadow-[#061638]/35 will-change-[left,width,border-radius] md:absolute md:inset-y-0 md:w-1/2 md:p-10 motion-reduce:animate-none ${videoTransition || (isRegistering ? 'md:left-1/2 md:rounded-l-[48%] md:rounded-r-none' : 'md:left-0 md:rounded-r-[48%]')}`}>
          <video className="absolute inset-0 h-full w-full object-cover" src={alignmentVideo} autoPlay muted loop playsInline aria-label="Dental alignment preview" />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(16,45,130,0.92),rgba(18,60,199,0.76),rgba(3,11,34,0.46))]" />
          <div className="relative h-full">
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <div className="max-w-xs">
              <p className="mb-3 text-sm font-semibold text-[#c1e5ff]">{isRegistering ? 'Already a member?' : 'New to MyPathFinder?'}</p>
              <h1 className="employee-heading text-4xl font-bold leading-tight tracking-[-0.04em]">{isRegistering ? 'Welcome back.' : 'The clarity to plan every smile.'}</h1>
              <p className="mt-4 text-sm leading-6 text-white/80">{isRegistering ? 'Sign in to continue your secure dental planning workflow.' : 'Create your account and turn every scan into a confident clinical decision.'}</p>
              <button type="button" onClick={() => changeTab(isRegistering ? 'login' : 'register')} className="mt-7 rounded-xl border border-white/75 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-white hover:text-[#123cc7] focus:outline-none focus:ring-4 focus:ring-white/30">
                {isRegistering ? 'Login' : 'Register'}
              </button>
              </div>
            </div>
          </div>
        </aside>

        <section className={`relative z-10 flex items-center justify-center px-7 text-[#102e4a] will-change-transform sm:px-12 md:absolute md:inset-y-0 md:right-0 md:w-1/2 md:px-14 md:transition-transform md:duration-[1000ms] md:[transition-timing-function:cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none ${isRegistering ? 'py-5 md:py-6 md:-translate-x-full' : 'py-10 md:translate-x-0'}`}>
          <div className="w-full max-w-sm">
            <div className={isRegistering ? 'mb-4' : 'mb-8'}>
              <div className="mb-5 flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f6ff] text-[#1746c7]"><ShieldCheck size={21} /></span>
                <span className="text-xs font-semibold text-[#57718a]">Secure clinical portal</span>
              </div>
              <h2 className={`employee-heading font-bold tracking-[-0.035em] ${isRegistering ? 'text-[28px]' : 'text-3xl'}`}>{isRegistering ? 'Create your access' : 'Welcome back'}</h2>
              <p className={`${isRegistering ? 'mt-1 leading-5' : 'mt-2 leading-6'} text-sm text-[#57718a]`}>{isRegistering ? 'Set up secure access for your planning workspace.' : 'Sign in to continue your aligner planning workflow.'}</p>
            </div>

            <form className={isRegistering ? 'space-y-2' : 'space-y-4'} onSubmit={isRegistering ? submitRegister : submitLogin}>
              {isRegistering && <label className="block"><span className={labelClass}>Full name</span><div className="relative"><UserRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6ab0e3]" /><input className={`${inputClass} pl-12`} placeholder="Dr. Jordan Lee" value={form.fullName} onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))} required /></div></label>}
              <label className="block"><span className={labelClass}>Email</span><div className="relative"><Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6ab0e3]" /><input className={`${inputClass} pl-12`} type="email" placeholder="name@clinic.com" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} required /></div></label>
              <label className="block"><span className={labelClass}>Password</span><div className="relative"><Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6ab0e3]" /><input className={`${inputClass} pl-12 pr-12`} type={showPassword ? 'text' : 'password'} placeholder="Enter your password" value={form.password} onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))} required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7892a8] hover:text-[#123cc7]">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
              {isRegistering && <label className="block"><span className={labelClass}>Confirm password</span><input className={inputClass} type={showPassword ? 'text' : 'password'} placeholder="Repeat your password" value={form.confirmPassword} onChange={(e) => setForm((s) => ({ ...s, confirmPassword: e.target.value }))} required /></label>}
              {!isRegistering && <div className="flex items-center justify-between pt-1 text-sm text-[#57718a]"><label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 rounded border-[#b6d8ef] text-[#123cc7] focus:ring-[#73bfed]" />Remember me</label><button type="button" className="font-bold text-[#123cc7] hover:text-[#0b2b86]">Forgot password?</button></div>}
              <button type="submit" disabled={(isRegistering && !canRegister) || loading} className="group flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(110deg,#123cc7,#1359d4)] px-5 py-3 font-bold text-white shadow-[0_14px_26px_rgba(18,60,199,0.27)] transition hover:-translate-y-0.5 disabled:opacity-40"><span>{loading ? 'Please wait...' : isRegistering ? 'Create account' : 'Sign in'}</span><ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></button>
            </form>
            <p className={`${isRegistering ? 'mt-4' : 'mt-7'} text-center text-sm text-[#57718a]`}>{isRegistering ? 'Already have an account?' : "Don't have an account?"} <button type="button" onClick={() => changeTab(isRegistering ? 'login' : 'register')} className="font-bold text-[#123cc7] hover:underline">{isRegistering ? 'Login' : 'Register'}</button></p>
          </div>
        </section>
      </section>
    </main>
  );
};

export default EmployeeAuth;
