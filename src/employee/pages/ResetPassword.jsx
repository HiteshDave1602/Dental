import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Lock } from 'lucide-react';
import api, { notifyError, notifySuccess } from '../../Script/api';
import pathfinderLogo from '../../assets/images/MY PATHFINDER LOGO.JPG.jpeg';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const minLength = 8;
  const isInvalid = form.newPassword.length < minLength || form.confirmPassword !== form.newPassword;

  const inputClass = 'h-[52px] w-full rounded-xl border border-[#c9e5fa] bg-[#f7fbff] px-4 text-[#102e4a] outline-none transition placeholder:text-[#91a9bd] focus:border-[#2d77dc] focus:bg-white focus:shadow-[0_0_0_4px_rgba(104,184,235,0.2)]';

  const submitReset = async (event) => {
    event.preventDefault();
    if (!token) {
      notifyError('Invalid or missing reset token.');
      return;
    }
    if (isInvalid) {
      notifyError(`Password must be at least ${minLength} characters and match the confirmation.`);
      return;
    }
    setLoading(true);
    try {
      await api.employee.auth.resetPassword({ token, new_password: form.newPassword });
      notifySuccess('Password reset successful. Please login with your new password.');
      navigate('/login');
    } catch (err) {
      const detail = err?.response?.data?.detail;
      notifyError(typeof detail === 'string' ? detail : 'Unable to reset password. The link may be invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="employee-shell relative flex min-h-screen items-center justify-center overflow-hidden bg-[#061638] px-5 py-10 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_13%_5%,rgba(47,104,235,0.55),transparent_29%),radial-gradient(circle_at_85%_92%,rgba(20,184,166,0.20),transparent_31%),linear-gradient(128deg,#102d82_0%,#0b2580_37%,#07194a_66%,#030b22_100%)]" />
      <div className="absolute inset-0 opacity-[0.09] [background-image:linear-gradient(rgba(174,220,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(174,220,255,0.8)_1px,transparent_1px)] [background-size:72px_72px]" />

      <section className="relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] border border-white/20 bg-white p-8 text-[#102e4a] shadow-2xl shadow-black/30 sm:p-10">
        <div className="mb-6 flex justify-center">
          <img src={pathfinderLogo} alt="My Pathfinder" className="h-16 w-16 rounded-2xl bg-white object-contain p-1 shadow-lg" />
        </div>

        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="grid h-10 w-10 place-content-center rounded-xl bg-[#c1e5ff] text-[#072ac8]">
            <KeyRound size={20} />
          </span>
        </div>

        <h2 className="employee-heading text-center text-[28px] font-bold tracking-[-0.035em]">
          Set a new password
        </h2>
        <p className="mt-2 text-center text-sm leading-5 text-[#57718a]">
          {token
            ? 'Choose a strong password for your account. The link expires in 30 minutes.'
            : 'This reset link is invalid or incomplete. Request a new one from the login page.'}
        </p>

        {token ? (
          <form onSubmit={submitReset} className="mt-7 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#12344D]">New password</span>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6ab0e3]" />
                <input
                  className={`${inputClass} pl-12 pr-12`}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimum 8 characters"
                  value={form.newPassword}
                  onChange={(e) => setForm((s) => ({ ...s, newPassword: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7892a8] hover:text-[#123cc7]"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[#12344D]">Confirm new password</span>
              <div className="relative">
                <CheckCircle2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6ab0e3]" />
                <input
                  className={`${inputClass} pl-12`}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Repeat your new password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm((s) => ({ ...s, confirmPassword: e.target.value }))}
                  required
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="flex h-[52px] w-full items-center justify-center rounded-xl bg-[linear-gradient(110deg,#123cc7,#1359d4)] px-5 py-3 font-bold text-white shadow-[0_14px_26px_rgba(18,60,199,0.27)] transition hover:-translate-y-0.5 disabled:opacity-40"
            >
              {loading ? 'Please wait...' : 'Reset password'}
            </button>
          </form>
        ) : (
          <Link
            to="/login"
            className="mt-7 flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(110deg,#123cc7,#1359d4)] px-5 py-3 font-bold text-white shadow-[0_14px_26px_rgba(18,60,199,0.27)] transition hover:-translate-y-0.5"
          >
            <ArrowLeft size={18} />
            Back to login
          </Link>
        )}

        <p className="mt-6 text-center text-sm text-[#57718a]">
          <Link to="/login" className="font-bold text-[#123cc7] hover:underline">
            <ArrowLeft size={14} className="mr-1 inline" />
            Back to login
          </Link>
        </p>
      </section>
    </main>
  );
};

export default ResetPassword;