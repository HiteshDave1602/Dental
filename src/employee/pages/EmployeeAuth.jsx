import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Check, Eye, EyeOff, Lock, Mail, ScanLine, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { useEmployee } from '../../context/EmployeeContext';
import api, { notifyError, notifySuccess } from '../../Script/api';
import alignmentVideo from '../../assets/Untitled design.mp4';

const EmployeeAuth = () => {
  const [tab, setTab] = useState('login');
  const { employeeAuth, setEmployeeSession } = useEmployee();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const canRegister = useMemo(() => (
    form.fullName.trim() &&
    form.email.trim() &&
    form.password.length >= 6 &&
    form.confirmPassword === form.password
  ), [form]);

  if (employeeAuth.isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const submitLogin = (event) => {
    event.preventDefault();
    setLoading(true);
    setEmployeeSession('local-dashboard-access', {
      name: form.email || 'Demo Dentist',
      email: form.email,
      plan: 'free',
    });
    notifySuccess('Welcome back!');
    setLoading(false);
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
    <div className="employee-shell relative min-h-screen overflow-hidden bg-[#061638] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_13%_5%,rgba(47,104,235,0.55),transparent_29%),radial-gradient(circle_at_85%_92%,rgba(20,184,166,0.20),transparent_31%),linear-gradient(128deg,#102d82_0%,#0b2580_37%,#07194a_66%,#030b22_100%)]" />
      <div className="absolute -left-20 top-[32%] h-80 w-80 rounded-full bg-[#55c7ff]/15 blur-[120px]" />
      <div className="absolute inset-0 opacity-[0.09] [background-image:linear-gradient(rgba(174,220,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(174,220,255,0.8)_1px,transparent_1px)] [background-size:72px_72px]" />

      <main className="relative z-10 mx-auto grid min-h-screen max-w-[1600px] items-center gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[1.3fr_0.7fr] lg:px-12 xl:gap-16 xl:px-16">
        <section className="flex items-center">
          <div className="w-full max-w-[1010px]">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-[#e6f5ff] shadow-[0_10px_30px_rgba(2,13,47,0.2)] backdrop-blur-md">
              <Sparkles size={16} className="text-[#c1e5ff]" />
              ImplaScan · Advanced 3D Intelligence
            </div>

            <div className="mt-6 overflow-hidden rounded-[32px] border border-white/15 bg-white/[0.075] p-3 shadow-[0_28px_80px_rgba(2,12,45,0.35)] backdrop-blur-xl sm:p-5">
              <div className="grid gap-6 xl:grid-cols-[0.43fr_0.57fr] xl:items-stretch">
                <div className="order-2 flex flex-col justify-center xl:order-1">
                  <div className="mb-5 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-[#98dfff]"><span className="h-px w-9 bg-[#6dd2ff]" /> Planning, made precise</div>
                  <h1 className="employee-heading text-4xl font-bold leading-[1.04] tracking-[-0.04em] text-white sm:text-5xl xl:text-[3.7rem]">
                    The clarity to plan every smile.
                  </h1>
                  <p className="mt-5 max-w-xl text-base leading-7 text-[#e8f6ff]/72 sm:text-lg">
                    Turn complex dental scans into confident decisions with a clinical workspace designed around precision.
                  </p>

                  <div className="mt-8 grid grid-cols-3 gap-3">
                    {[
                      ['3D', 'Scan review'],
                      ['AI', 'Guided plans'],
                      ['Secure', 'Patient safe'],
                    ].map(([value, label]) => (
                      <div key={value} className="rounded-2xl border border-white/15 bg-[#09236a]/45 px-3 py-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] transition-colors hover:bg-[#123a92]/60">
                        <div className="employee-heading text-xl font-bold text-[#d8f4ff]">{value}</div>
                        <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#e8f6ff]/55">{label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex items-center gap-3 border-t border-white/10 pt-5 text-xs text-[#d7eeff]/70">
                    <div className="flex -space-x-2">{['#9be6ff', '#6cb9ff', '#9a9bff'].map((colour) => <span key={colour} className="h-7 w-7 rounded-full border-2 border-[#14357f]" style={{ backgroundColor: colour }} />)}</div>
                    <span><strong className="font-semibold text-white">Built for clinicians</strong> from scan to approved plan.</span>
                  </div>
                </div>

                <div className="order-1 xl:order-2">
                  <div className="relative min-h-[330px] overflow-hidden rounded-[25px] border border-white/20 bg-[#03153f] shadow-2xl shadow-[#03153f]/55 sm:min-h-[440px] xl:min-h-[530px]">
                    <video
                      className="absolute inset-0 h-full w-full object-cover opacity-95"
                      src={alignmentVideo}
                      autoPlay
                      muted
                      loop
                      playsInline
                      aria-label="Precision dental alignment preview"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,38,110,0.02)_30%,rgba(2,12,42,0.82)_100%)]" />
                    <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(90deg,transparent_49.7%,rgba(161,229,255,0.35)_50%,transparent_50.3%),linear-gradient(transparent_49.7%,rgba(161,229,255,0.35)_50%,transparent_50.3%)] [background-size:100%_100%]" />
                    <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full border border-white/20 bg-[#061638]/55 px-3 py-1.5 text-[11px] font-semibold text-white/90 backdrop-blur-md">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#5eead4] shadow-[0_0_10px_#5eead4]" />
                      Live visualisation
                    </div>
                    <div className="absolute right-5 top-5 hidden rounded-xl border border-white/15 bg-[#061638]/55 px-3 py-2.5 text-right backdrop-blur-md sm:block">
                      <div className="flex items-center justify-end gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#a9dcf7]"><ScanLine size={12} /> Scan quality</div>
                      <div className="mt-1 text-sm font-bold text-white">98.6% <span className="font-medium text-[#71e2c4]">optimal</span></div>
                    </div>
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3">
                      <div className="rounded-full border border-white/20 bg-[#061638]/70 px-3 py-2 text-xs font-semibold text-[#e8f6ff] backdrop-blur-md">
                        Treatment simulation <span className="ml-1 text-[#72ddff]">24 stages</span>
                      </div>
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d8f4ff] text-[#0b2b86] shadow-lg shadow-[#9cd5ff]/25">
                        <BadgeCheck size={18} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center lg:justify-end">
        <div className="w-full max-w-[460px] rounded-[30px] border border-white/70 bg-white/[0.97] p-5 text-[#102e4a] shadow-[0_24px_65px_rgba(0,8,35,0.38)] backdrop-blur-2xl sm:p-6 lg:p-7">
          <div className="mb-6">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f6ff] text-[#1746c7]">
                <ShieldCheck size={21} />
              </div>
              <span className="text-xs font-semibold text-[#57718a]">Secure clinical portal</span>
            </div>
            <div className="mb-4 inline-flex rounded-full border border-[#b8ddfa] bg-[#eff8ff] p-1">
            {['login', 'register'].map((currentTab) => (
              <button
                key={currentTab}
                type="button"
                onClick={() => setTab(currentTab)}
                  className={`rounded-full px-5 py-2 text-sm font-bold transition-all ${tab === currentTab ? 'bg-[#123cc7] text-white shadow-md shadow-[#123cc7]/25' : 'text-[#57718a] hover:text-[#123cc7]'}`}
              >
                {currentTab === 'login' ? 'Login' : 'Register'}
              </button>
            ))}
            </div>
            <h2 className="employee-heading text-[2rem] font-bold tracking-[-0.035em] text-[#102e4a]">
              {tab === 'login' ? 'Welcome back' : 'Create your access'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#57718a]">
              {tab === 'login' ? 'Sign in to continue your aligner planning workflow.' : 'Set up secure access for your dental planning workspace.'}
            </p>
          </div>

          <form className="space-y-4" onSubmit={tab === 'login' ? submitLogin : submitRegister}>
            {tab === 'register' ? (
              <div>
                <label className="text-sm font-semibold text-[#12344D]">Full Name</label>
                <div className="relative mt-2">
                  <UserRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6ab0e3]" />
                  <input placeholder="Dr. Jordan Lee" className="h-[50px] w-full rounded-xl border border-[#c9e5fa] bg-[#f7fbff] px-4 py-3 pl-12 text-[#102e4a] outline-none transition-all placeholder:text-[#91a9bd] focus:border-[#2d77dc] focus:bg-white focus:shadow-[0_0_0_4px_rgba(104,184,235,0.2)]" value={form.fullName} onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))} required />
                </div>
              </div>
            ) : null}

            <div>
              <label className="text-sm font-semibold text-[#12344D]">Email</label>
              <div className="relative mt-2">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6ab0e3]" />
                <input type="email" placeholder="name@clinic.com" className="h-[50px] w-full rounded-xl border border-[#c9e5fa] bg-[#f7fbff] px-4 py-3 pl-12 text-[#102e4a] outline-none transition-all placeholder:text-[#91a9bd] focus:border-[#2d77dc] focus:bg-white focus:shadow-[0_0_0_4px_rgba(104,184,235,0.2)]" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} required />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-[#12344D]">Password</label>
              <div className="relative mt-2">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6ab0e3]" />
                <input type={showPassword ? 'text' : 'password'} placeholder="Enter your password" className="h-[50px] w-full rounded-xl border border-[#c9e5fa] bg-[#f7fbff] px-4 py-3 pl-12 pr-12 text-[#102e4a] outline-none transition-all placeholder:text-[#91a9bd] focus:border-[#2d77dc] focus:bg-white focus:shadow-[0_0_0_4px_rgba(104,184,235,0.2)]" value={form.password} onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))} required />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7892a8] transition-colors hover:text-[#123cc7]" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {tab === 'register' ? (
              <div>
                <label className="text-sm font-semibold text-[#12344D]">Confirm Password</label>
                <input type={showPassword ? 'text' : 'password'} placeholder="Repeat your password" className="mt-2 h-[50px] w-full rounded-xl border border-[#c9e5fa] bg-[#f7fbff] px-4 py-3 text-[#102e4a] outline-none transition-all placeholder:text-[#91a9bd] focus:border-[#2d77dc] focus:bg-white focus:shadow-[0_0_0_4px_rgba(104,184,235,0.2)]" value={form.confirmPassword} onChange={(e) => setForm((s) => ({ ...s, confirmPassword: e.target.value }))} required />
              </div>
            ) : null}

            <div className="flex items-center justify-between pt-1 text-sm text-[#57718a]">
              {tab === 'login' ? <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 rounded border-[#b6d8ef] text-[#123cc7] focus:ring-[#73bfed]" />Remember me</label> : <span>Create secure access</span>}
              <button type="button" className="font-bold text-[#123cc7] hover:text-[#0b2b86]">{tab === 'login' ? 'Forgot password?' : 'Help'}</button>
            </div>

            <button
              type="submit"
              disabled={(tab === 'register' && !canRegister) || loading}
              className="group flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(110deg,#123cc7,#1359d4)] px-5 py-3 font-bold text-white shadow-[0_14px_26px_rgba(18,60,199,0.27)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_32px_rgba(18,60,199,0.34)] active:translate-y-0 active:scale-[0.99] disabled:opacity-40"
            >
              <span>{loading ? 'Please wait...' : tab === 'login' ? 'Sign In' : 'Create Account'}</span>
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </button>
          </form>
          <div className="mt-6 flex items-center justify-center gap-2 border-t border-[#e2eef7] pt-4 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7892a8]">
            <Check size={13} className="text-[#16a394]" /> Encrypted &amp; HIPAA-ready workspace
          </div>
        </div>
      </section>
      </main>
    </div>
  );
};

export default EmployeeAuth;
